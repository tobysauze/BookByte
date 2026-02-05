import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { rawTextSummarySchema, summarySchema } from "@/lib/schemas";
import { canEditBook } from "@/lib/user-roles";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { calculateBookMetadata } from "@/lib/metadata-utils";
import { maybeGenerateAndSaveCover } from "@/lib/cover-generator";

export const runtime = "nodejs";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_PARSER_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-4o";

const OPENAI_CLIENT = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const GEMINI_CLIENT = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const OPENROUTER_CLIENT = OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "BookByte",
      },
    })
  : null;

function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Split on paragraph boundaries first to preserve readability.
  const paragraphs = normalized.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    // If a single paragraph is huge, hard-split it.
    if (p.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < p.length; i += maxChars) {
        chunks.push(p.slice(i, i + maxChars));
      }
      continue;
    }

    const next = current ? `${current}\n\n${p}` : p;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) chunks.push(current);
      current = p;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function buildFullSummaryChapters(summaryText: string): Array<{ title: string; summary: string }> {
  // `chapterSummarySchema.summary` allows up to 100000 chars. Keep some headroom.
  const MAX_CHARS = 90000;
  const chunks = splitTextIntoChunks(summaryText, MAX_CHARS);
  if (chunks.length === 0) return [];

  if (chunks.length === 1) {
    return [{ title: "Full Summary (pasted)", summary: chunks[0] }];
  }

  return chunks.map((chunk, idx) => ({
    title: `Full Summary (pasted) — Part ${idx + 1}/${chunks.length}`,
    summary: chunk,
  }));
}

function extractChapterBlocks(summaryText: string): Array<{ title: string; body: string }> {
  const text = summaryText.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines = text.split("\n");

  const wordNumbers =
    "(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)";

  const headingRegexes: RegExp[] = [
    // "Chapter 1: Title" / "CHAPTER 1 - Title"
    new RegExp(`^\\s*(chapter|ch\\.)\\s+\\d+\\b.*$`, "i"),
    // "Chapter One: Title"
    new RegExp(`^\\s*(chapter|ch\\.)\\s+${wordNumbers}\\b.*$`, "i"),
    // "Part 1: Title"
    new RegExp(`^\\s*part\\s+\\d+\\b.*$`, "i"),
    // "Part One: Title"
    new RegExp(`^\\s*part\\s+${wordNumbers}\\b.*$`, "i"),
  ];

  const isHeadingLine = (line: string) => headingRegexes.some((re) => re.test(line));

  const headingIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line) continue;
    if (isHeadingLine(line)) headingIndices.push(i);
  }

  // Need at least 1 heading to segment. If none, return empty (caller will fall back).
  if (headingIndices.length < 1) return [];

  const blocks: Array<{ title: string; body: string }> = [];

  // Preserve any intro text before the first detected heading.
  const firstHeadingIndex = headingIndices[0]!;
  if (firstHeadingIndex > 0) {
    const introBody = lines.slice(0, firstHeadingIndex).join("\n").trim();
    if (introBody) {
      blocks.push({
        title: "Introduction (pasted)",
        body: introBody,
      });
    }
  }

  for (let h = 0; h < headingIndices.length; h++) {
    const start = headingIndices[h]!;
    const end = h + 1 < headingIndices.length ? headingIndices[h + 1]! : lines.length;

    const title = (lines[start] ?? "").trim();
    const body = lines
      .slice(start + 1, end)
      .join("\n")
      .trim();

    // Keep even short bodies, but never empty.
    blocks.push({
      title: title || `Chapter ${h + 1}`,
      body: body || "Content not available for this chapter.",
    });
  }

  return blocks;
}

function buildChapterTextChapters(summaryText: string): Array<{ title: string; summary: string }> {
  // `chapterSummarySchema.summary` allows up to 100000 chars. Keep headroom.
  const MAX_CHARS = 90000;
  const blocks = extractChapterBlocks(summaryText);
  if (blocks.length === 0) return [];

  const chapters: Array<{ title: string; summary: string }> = [];
  for (const block of blocks) {
    const chunks = splitTextIntoChunks(block.body, MAX_CHARS);
    if (chunks.length <= 1) {
      chapters.push({
        title: block.title,
        summary: chunks[0] ?? block.body,
      });
      continue;
    }

    chunks.forEach((chunk, idx) => {
      chapters.push({
        title: `${block.title} — Part ${idx + 1}/${chunks.length}`,
        summary: chunk,
      });
    });
  }

  return chapters;
}

/**
 * Parse and organize an uploaded summary text into structured format
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to upload summaries." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { summaryText } = body;

    if (!summaryText || typeof summaryText !== "string" || summaryText.trim().length === 0) {
      return NextResponse.json(
        { error: "Summary text is required." },
        { status: 400 },
      );
    }

    // If the user pasted an already-structured deep-dive (PART 1..8), keep it lossless as raw_text.
    // This avoids the AI "re-organizing" and accidentally dropping sections.
    const looksLikeDeepDivePromptOutput = (() => {
      const t = summaryText.toLowerCase();
      return (
        /\bpart\s+1\s*:/i.test(t) &&
        /\bpart\s+2\s*:/i.test(t) &&
        /\bpart\s+8\s*:/i.test(t) &&
        (t.includes("chapter-by-chapter") || t.includes("chapter by chapter"))
      );
    })();

    // Get the book
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, title, author, user_id, is_public, cover_url")
      .eq("id", id)
      .single();

    if (bookError || !book) {
      return NextResponse.json(
        { error: "Book not found." },
        { status: 404 },
      );
    }

    // Check if user can edit this book
    const canEdit = await canEditBook(book.user_id, book.is_public);
    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to edit this book." },
        { status: 403 },
      );
    }

    if (looksLikeDeepDivePromptOutput) {
      const raw = rawTextSummarySchema.parse({
        raw_text: summaryText.trim(),
        ai_provider: "pasted_deep_dive",
      });

      const metadata = calculateBookMetadata(raw);
      const { error: updateError } = await supabase
        .from("books")
        .update({
          summary: raw,
          ...metadata,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error updating book summary:", updateError);
        return NextResponse.json(
          { error: "Failed to save summary." },
          { status: 500 },
        );
      }

      const result = NextResponse.json({
        success: true,
        message: "Summary uploaded successfully.",
        summary: raw,
      });

      authResponse.cookies.getAll().forEach((cookie) => {
        result.cookies.set(cookie);
      });

      // Auto-generate a cartoony cover after upload (best-effort).
      try {
        await maybeGenerateAndSaveCover({
          bookId: id,
          userId: book.user_id,
          title: book.title || "Untitled",
          author: book.author,
          description: metadata.description,
          category: metadata.category,
          existingCoverUrl: book.cover_url,
        });
      } catch (e) {
        console.error("Auto cover generation failed:", e);
      }

      return result;
    }

    // Use AI to parse the summary text into structured format
    console.log("📝 Parsing uploaded summary text...");

    // Lossless chapter capture:
    // If the pasted text includes explicit "Chapter X" headings, store each chapter's full text
    // directly into `chapters[].summary` (not a re-summarized version).
    const chapterTextChapters = buildChapterTextChapters(summaryText);
    
    let parsedSummary: z.infer<typeof summarySchema> | null = null;
    try {
      const parsePrompt = `You are organizing a book summary that was written elsewhere. Your task is to organize the following text into the required JSON structure.

IMPORTANT INSTRUCTIONS:
0. Do NOT invent content. Do NOT omit major content. Preserve as much of the original wording as possible.
   - If something doesn't clearly fit, include it under "chapters" (as a section) rather than dropping it.
   - Ensure the *entire* summary is represented across the output fields.
1. Extract or create a "short_summary" - a 1-2 sentence summary (MAX 200 characters). Count characters carefully!
2. Extract or create a "quick_summary" - a comprehensive 3-4 paragraph executive overview
3. Extract "key_ideas" - look for numbered lists, bullet points, or sections that describe key concepts/principles. Each should have a title and detailed text (at least 3).
4. Extract "chapters" - look for chapter titles, sections, or headings. Create chapter summaries from the content (at least 1).
5. Extract "actionable_insights" - look for action items, steps, recommendations, or "how to" content (at least 3).
6. Extract "quotes" - look for quoted text, memorable statements, or emphasized passages (at least 3).

If a section doesn't exist in the text, create a minimal placeholder that can be edited later.
If there are additional sections in the text that don't fit the standard structure, try to map them appropriately:
- "Introduction", "Overview", "Summary" → quick_summary
- "Main Points", "Principles", "Concepts", "Key Takeaways" → key_ideas
- "Chapter 1", "Part 1", numbered sections, section headings → chapters
- "Action Items", "Steps", "Recommendations", "How to", "Takeaways" → actionable_insights
- Quoted text, memorable statements, passages in quotes → quotes

Book Title: ${book.title || "Unknown"}
${book.author ? `Author: ${book.author}` : ""}

Summary Text to Parse:
${summaryText.trim()}

Return ONLY valid JSON matching this exact structure (no markdown formatting, no code blocks):
{
  "short_summary": "1-2 sentence summary (MAX 200 characters)",
  "quick_summary": "Comprehensive executive summary",
  "key_ideas": [
    {"title": "Key Idea Title", "text": "Detailed explanation"}
  ],
  "chapters": [
    {"title": "Chapter Title", "summary": "Chapter summary text"}
  ],
  "actionable_insights": [
    "Actionable insight 1",
    "Actionable insight 2"
  ],
  "quotes": [
    "Quote 1",
    "Quote 2"
  ]
}`;

      // Prefer OpenRouter (matches rest of app), fallback to Gemini, then OpenAI.
      if (!parsedSummary && OPENROUTER_CLIENT) {
        try {
          const completion = await OPENROUTER_CLIENT.chat.completions.create({
            model: OPENROUTER_MODEL,
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful assistant that organizes book summaries into structured JSON format.",
              },
              {
                role: "user",
                content: parsePrompt,
              },
            ],
            max_completion_tokens: 8000,
          });

          const content = completion.choices[0]?.message?.content;
          if (!content) throw new Error("OpenRouter did not return any content");
          const parsed = JSON.parse(content);
          parsedSummary = summarySchema.parse(parsed);
        } catch (openRouterError) {
          console.error("OpenRouter parsing failed, trying Gemini/OpenAI:", openRouterError);
        }
      }

      if (!parsedSummary && GEMINI_CLIENT) {
        const model = GEMINI_CLIENT.getGenerativeModel({
          model: process.env.GEMINI_SUMMARY_MODEL || "gemini-2.5-pro",
          systemInstruction: {
            role: "system",
            parts: [
              {
                text: "You are a helpful assistant that organizes book summaries into structured JSON format.",
              },
            ],
          },
        });

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: parsePrompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        });

        const textResponse = result.response.text();
        const parsed = JSON.parse(textResponse);
        parsedSummary = summarySchema.parse(parsed);
      }

      if (!parsedSummary && OPENAI_CLIENT) {
        const completion = await OPENAI_CLIENT.chat.completions.create({
          model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o",
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that organizes book summaries into structured JSON format.",
            },
            {
              role: "user",
              content: parsePrompt,
            },
          ],
          max_completion_tokens: 8000,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("OpenAI did not return any content");
        
        const parsed = JSON.parse(content);
        parsedSummary = summarySchema.parse(parsed);
      }

      if (!parsedSummary) {
        throw new Error(
          "No AI provider configured. Set OPENROUTER_API_KEY (recommended) or OPENAI_API_KEY / GEMINI_API_KEY.",
        );
      }

      // Ensure short_summary is within character limit
      if (parsedSummary.short_summary.length > 200) {
        parsedSummary.short_summary =
          parsedSummary.short_summary.substring(0, 197) + "...";
      }

      // Ensure short_summary meets min length (schema requires >= 20)
      if (parsedSummary.short_summary.length < 20) {
        const fallback = summaryText.trim().replace(/\s+/g, " ");
        parsedSummary.short_summary = (fallback.length > 200 ? fallback.slice(0, 197) + "..." : fallback).slice(0, 200);
        if (parsedSummary.short_summary.length < 20) {
          parsedSummary.short_summary = "A detailed summary is available below.";
        }
      }

      // Lossless: attach the full pasted summary text as additional chapter(s),
      // so nothing can be missing even if parsing is imperfect.
      const fullSummaryChapters = buildFullSummaryChapters(summaryText);
      if (chapterTextChapters.length > 0) {
        // Prefer verbatim chapter text extracted from headings.
        parsedSummary.chapters = chapterTextChapters;
      }

      // Always include the full original pasted summary as its own selectable entry.
      if (fullSummaryChapters.length > 0) {
        parsedSummary.chapters = [...parsedSummary.chapters, ...fullSummaryChapters];
      }

      // Update the book with the parsed summary
      const metadata = calculateBookMetadata(parsedSummary);
      const { error: updateError } = await supabase
        .from("books")
        .update({
          summary: parsedSummary,
          ...metadata,
        })
        .eq("id", id);

      if (updateError) {
        console.error("Error updating book summary:", updateError);
        return NextResponse.json(
          { error: "Failed to save parsed summary." },
          { status: 500 },
        );
      }

      const result = NextResponse.json({
        success: true,
        message: "Summary uploaded and organized successfully.",
        summary: parsedSummary,
      });

      authResponse.cookies.getAll().forEach((cookie) => {
        result.cookies.set(cookie);
      });

      // Auto-generate a cartoony cover after upload (best-effort).
      try {
        await maybeGenerateAndSaveCover({
          bookId: id,
          userId: book.user_id,
          title: book.title || "Untitled",
          author: book.author,
          description: metadata.description,
          category: metadata.category,
          existingCoverUrl: book.cover_url,
        });
      } catch (e) {
        console.error("Auto cover generation failed:", e);
      }

      return result;
    } catch (error) {
      console.error("Error parsing summary:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to parse summary." },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error in upload-summary route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

