import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { summarySchema, type SummaryPayload } from "@/lib/schemas";
import { getUserRole } from "@/lib/user-roles";
import { canEditBook } from "@/lib/user-roles";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const OPENAI_CLIENT = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const GEMINI_CLIENT = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

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

    // Check if user is an editor
    const userRole = await getUserRole();
    if (userRole !== "editor") {
      return NextResponse.json(
        { error: "Only editors can upload summaries." },
        { status: 403 },
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

    // Get the book
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id, title, author, user_id, is_public")
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

    // Use AI to parse the summary text into structured format
    console.log("📝 Parsing uploaded summary text...");
    
    let parsedSummary: z.infer<typeof summarySchema>;
    try {
      const parsePrompt = `You are organizing a book summary that was written elsewhere. Your task is to parse the following text and organize it into the required JSON structure.

IMPORTANT INSTRUCTIONS:
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

      // Try Gemini first, fallback to OpenAI
      if (GEMINI_CLIENT) {
        try {
          const model = GEMINI_CLIENT.getGenerativeModel({
            model: process.env.GEMINI_SUMMARY_MODEL || "gemini-2.5-pro",
            systemInstruction: {
              role: "system",
              parts: [{ text: "You are a helpful assistant that organizes book summaries into structured JSON format." }],
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
        } catch (geminiError) {
          console.error("Gemini parsing failed, trying OpenAI:", geminiError);
          if (!OPENAI_CLIENT) throw new Error("No AI provider available");
          
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
      } else if (OPENAI_CLIENT) {
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
      } else {
        throw new Error("No AI provider configured");
      }

      // Ensure short_summary is within character limit
      if (parsedSummary.short_summary.length > 200) {
        parsedSummary.short_summary = parsedSummary.short_summary.substring(0, 197) + "...";
      }

      // Update the book with the parsed summary
      const { error: updateError } = await supabase
        .from("books")
        .update({
          summary: parsedSummary,
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

