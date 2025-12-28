import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { summarySchema, type SummaryPayload } from "@/lib/schemas";
import { getUserRole } from "@/lib/user-roles";
import { canEditBook } from "@/lib/user-roles";
import { extractTextFromFile } from "@/lib/pdf";
import { generateStructuredSummary } from "@/lib/openrouter";

// Type guard for structured summaries
function isStructuredSummary(summary: SummaryPayload): summary is z.infer<typeof summarySchema> {
  return 'quick_summary' in summary && typeof summary.quick_summary === 'string';
}

export const runtime = "nodejs";

/**
 * Generate a summary for a single chapter
 */
async function summarizeChapter(
  chapterText: string,
  chapterNumber: number,
  chapterName: string,
  bookTitle: string,
  bookAuthor?: string
): Promise<SummaryPayload> {
  const chapterPrompt = `You are analyzing Chapter ${chapterNumber}${chapterName ? `: "${chapterName}"` : ""} from the book "${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ""}.

This is ONE chapter from a larger book. Your task is to create a comprehensive summary for THIS CHAPTER ONLY.

IMPORTANT INSTRUCTIONS:
1. Create a detailed chapter summary that captures all major ideas, concepts, and details from this chapter
2. Extract key ideas specific to this chapter
3. Identify actionable insights from this chapter
4. Find memorable quotes from this chapter
5. The short_summary should be a brief 1-2 sentence overview of THIS CHAPTER (MAX 200 characters)
6. The quick_summary should be a comprehensive overview of THIS CHAPTER (3-4 paragraphs)
7. Include chapter-specific key_ideas, actionable_insights, and quotes

Chapter Content:
${chapterText.trim()}

Return ONLY valid JSON matching this exact structure (no markdown formatting, no code blocks):
{
  "short_summary": "Brief chapter overview (MAX 200 characters)",
  "quick_summary": "Comprehensive chapter summary",
  "key_ideas": [
    {"title": "Key Idea Title", "text": "Detailed explanation"}
  ],
  "chapters": [
    {"title": "${chapterName || `Chapter ${chapterNumber}`}", "summary": "Detailed chapter summary"}
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

  try {
    // Use OpenRouter with custom prompt
    return await generateStructuredSummary({
      text: chapterText,
      title: bookTitle,
      author: bookAuthor,
      customPrompt: chapterPrompt,
    });
  } catch (error) {
    console.error(`Error summarizing chapter ${chapterNumber}:`, error);
    throw error;
  }
}

/**
 * Combine multiple chapter summaries into one comprehensive book summary
 */
function combineChapterSummaries(
  chapterSummaries: SummaryPayload[],
  bookTitle: string,
  bookAuthor?: string
): SummaryPayload {
  // All chapter summaries should be structured (they come from generateStructuredSummary)
  const structuredSummaries = chapterSummaries.filter(isStructuredSummary);
  
  if (structuredSummaries.length === 0) {
    throw new Error("No valid structured summaries to combine");
  }
  
  // Combine all chapters
  const allChapters = structuredSummaries.flatMap((cs) => cs.chapters);
  
  // Combine all key ideas (deduplicate by title)
  const keyIdeasMap = new Map<string, { title: string; text: string }>();
  structuredSummaries.forEach((cs) => {
    cs.key_ideas.forEach((ki) => {
      if (!keyIdeasMap.has(ki.title)) {
        keyIdeasMap.set(ki.title, ki);
      } else {
        // Merge if duplicate
        const existing = keyIdeasMap.get(ki.title)!;
        existing.text += "\n\n" + ki.text;
      }
    });
  });
  
  // Combine all actionable insights (deduplicate)
  const actionableInsightsSet = new Set<string>();
  structuredSummaries.forEach((cs) => {
    cs.actionable_insights.forEach((ai) => actionableInsightsSet.add(ai));
  });
  
  // Combine all quotes (deduplicate)
  const quotesSet = new Set<string>();
  structuredSummaries.forEach((cs) => {
    cs.quotes.forEach((q) => quotesSet.add(q));
  });
  
  // Create overall quick summary from all chapter quick summaries
  const combinedQuickSummary = structuredSummaries
    .map((cs, idx) => {
      const chapterTitle = cs.chapters[0]?.title || `Chapter ${idx + 1}`;
      return `## ${chapterTitle}\n\n${cs.quick_summary}`;
    })
    .join("\n\n");
  
  // Create overall short summary from first chapter or combine
  let shortSummary = structuredSummaries.length > 0 
    ? structuredSummaries[0].short_summary 
    : `${bookTitle}${bookAuthor ? ` by ${bookAuthor}` : ""} - A comprehensive exploration of key concepts and insights.`;

  // If we have multiple chapters, try to create a better overall summary
  if (structuredSummaries.length > 1) {
    // Use the first chapter's short summary but mention it's multi-chapter
    const firstShort = structuredSummaries[0].short_summary;
    if (firstShort.length < 150) {
      // Add note about multiple chapters if there's room
      const note = ` (${structuredSummaries.length} chapters)`;
      const enhanced = firstShort + note;
      if (enhanced.length <= 200) {
        shortSummary = enhanced;
      }
    }
  }

  // Ensure short_summary is within character limit
  const finalShortSummary = shortSummary.length > 200 
    ? shortSummary.substring(0, 197) + "..."
    : shortSummary;

  return {
    ai_provider: structuredSummaries[0]?.ai_provider || "Unknown",
    short_summary: finalShortSummary,
    quick_summary: combinedQuickSummary,
    key_ideas: Array.from(keyIdeasMap.values()),
    chapters: allChapters,
    actionable_insights: Array.from(actionableInsightsSet),
    quotes: Array.from(quotesSet),
  };
}

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
        { error: "You must be logged in to upload chapters." },
        { status: 401 },
      );
    }

    // Check if user is an editor
    const userRole = await getUserRole();
    if (userRole !== "editor") {
      return NextResponse.json(
        { error: "Only editors can upload chapters." },
        { status: 403 },
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

    // Parse FormData
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "At least one file is required." },
        { status: 400 },
      );
    }

    console.log(`📚 Processing ${files.length} chapters for book: ${book.title}`);

    // Process each chapter sequentially
    const chapterSummaries: SummaryPayload[] = [];
    const errors: string[] = [];

    // Helper function to clean chapter names (remove underscores, numbers, etc.)
    const cleanChapterName = (filename: string, index: number): string => {
      // Remove file extension
      let name = filename.replace(/\.[^/.]+$/, "").trim();
      
      // Replace underscores with spaces
      name = name.replace(/_/g, " ");
      
      // Handle patterns like "04_chapter_1_ugh_small_talk" or "chapter_1_ugh_small_talk"
      // Extract chapter number if present
      const chapterMatch = name.match(/\b(chapter|ch)\s*(\d+)\b/i);
      if (chapterMatch) {
        const chapterNum = chapterMatch[2];
        const matchIndex = name.toLowerCase().indexOf(chapterMatch[0].toLowerCase());
        // Get everything after "chapter X"
        const afterChapter = name.substring(matchIndex + chapterMatch[0].length).trim();
        // Clean up the rest - remove any duplicate chapter numbers
        const cleanedRest = afterChapter
          .split(/\s+/)
          .filter(w => w.length > 0)
          .map(word => {
            // Skip if it's just a number that matches the chapter number
            if (/^\d+$/.test(word) && word === chapterNum) return "";
            // Skip if it's just a number (already handled)
            if (/^\d+$/.test(word)) return "";
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          })
          .filter(w => w.length > 0)
          .join(" ");
        
        if (cleanedRest) {
          return `Chapter ${chapterNum}: ${cleanedRest}`;
        }
        return `Chapter ${chapterNum}`;
      }
      
      // Handle leading numbers (e.g., "04_something" -> "Something")
      name = name.replace(/^\d+\s*/, "");
      
      // Capitalize first letter of each word
      name = name.split(/\s+/)
        .filter(w => w.length > 0)
        .map(word => {
          // Skip standalone numbers
          if (/^\d+$/.test(word)) return word;
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
      
      // Clean up multiple spaces
      name = name.replace(/\s+/g, " ").trim();
      
      // If empty or just numbers, use default
      if (!name || /^\d+$/.test(name)) {
        return `Chapter ${index + 1}`;
      }
      
      return name;
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const chapterNumber = i + 1;
      const chapterName = cleanChapterName(file.name, i);

      try {
        console.log(`📖 Processing chapter ${chapterNumber}/${files.length}: ${chapterName}`);

        // Extract text from file
        const extractedData = await extractTextFromFile(file);
        const chapterText = extractedData.text;

        if (!chapterText.trim()) {
          errors.push(`Chapter ${chapterNumber} (${chapterName}): No readable text found`);
          continue;
        }

        // Summarize the chapter
        const chapterSummary = await summarizeChapter(
          chapterText,
          chapterNumber,
          chapterName,
          book.title || "Unknown Book",
          book.author || undefined
        );

        chapterSummaries.push(chapterSummary);
        console.log(`✅ Chapter ${chapterNumber} summarized successfully`);
      } catch (error) {
        console.error(`❌ Error processing chapter ${chapterNumber}:`, error);
        errors.push(`Chapter ${chapterNumber} (${chapterName}): ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    if (chapterSummaries.length === 0) {
      return NextResponse.json(
        { error: "Failed to process any chapters. Errors: " + errors.join("; ") },
        { status: 500 },
      );
    }

    // Combine all chapter summaries into one comprehensive summary
    console.log("🔗 Combining chapter summaries...");
    const combinedSummary = combineChapterSummaries(
      chapterSummaries,
      book.title || "Unknown Book",
      book.author || undefined
    );

    // Update the book with the combined summary
    const { error: updateError } = await supabase
      .from("books")
      .update({
        summary: combinedSummary,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating book summary:", updateError);
      return NextResponse.json(
        { error: "Failed to save combined summary." },
        { status: 500 },
      );
    }

    const result = NextResponse.json({
      success: true,
      message: `Successfully processed ${chapterSummaries.length} chapter(s).`,
      summary: combinedSummary,
      processed: chapterSummaries.length,
      total: files.length,
      errors: errors.length > 0 ? errors : undefined,
    });

    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error("Error in upload-chapters route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

