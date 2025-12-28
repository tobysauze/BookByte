import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

import { extractTextFromFile } from "@/lib/pdf";
import { generateGeminiSummary, isGeminiConfigured } from "@/lib/gemini";
import { detectGaps, type Gap, type GapReport } from "@/lib/gap-detection";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { canEditBook } from "@/lib/user-roles";
import type { SummaryPayload } from "@/lib/schemas";
import OpenAI from "openai";

export const runtime = "nodejs";

type EnhancementRequest = {
  mode: "all" | "selected" | "section";
  gapIds?: string[]; // For "selected" mode
  section?: string; // For "section" mode
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: EnhancementRequest = await request.json();
    const { mode, gapIds = [], section, preview = false } = body as EnhancementRequest & { preview?: boolean };

    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to enhance summaries." },
        { status: 401 },
      );
    }

    // Check if Gemini is configured
    if (!isGeminiConfigured) {
      return NextResponse.json(
        { error: "Gemini API is not configured. Enhancement requires Gemini." },
        { status: 500 },
      );
    }

    // Get the book details
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("*")
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
        { error: "You don't have permission to enhance this book." },
        { status: 403 },
      );
    }

    // Check if we have a local file path
    if (!book.local_file_path) {
      return NextResponse.json(
        { error: "Original file not available for enhancement." },
        { status: 400 },
      );
    }

    // Read the original file
    let originalText: string;
    let locations: Array<{
      start: number;
      end: number;
      page?: number;
      line?: number;
      chapter?: string;
    }> = [];
    try {
      const fileBuffer = await readFile(book.local_file_path);
      const file = new File([fileBuffer], book.title || "book", {
        type: getMimeTypeFromPath(book.local_file_path),
      });
      const extractedData = await extractTextFromFile(file);
      originalText = extractedData.text;
      locations = extractedData.locations;
    } catch (fileError) {
      console.error("Error reading original file:", fileError);
      return NextResponse.json(
        { error: "Could not read the original file." },
        { status: 500 },
      );
    }

    if (!originalText.trim()) {
      return NextResponse.json(
        { error: "No readable text found in the original file." },
        { status: 400 },
      );
    }

    // Detect gaps
    const currentSummary = book.summary as SummaryPayload;
    const gapReport = detectGaps(
      originalText,
      currentSummary,
      book.title || undefined,
      book.author || undefined
    );

    // Filter gaps based on mode
    let gapsToEnhance: Gap[] = [];
    
    if (mode === "all") {
      gapsToEnhance = gapReport.gaps.filter(g => g.severity === "high" || g.severity === "medium");
    } else if (mode === "selected") {
      gapsToEnhance = gapReport.gaps.filter(g => gapIds.includes(g.id));
    } else if (mode === "section") {
      gapsToEnhance = gapReport.gaps.filter(g => g.section === section);
    }

    if (gapsToEnhance.length === 0) {
      return NextResponse.json(
        { error: "No gaps selected for enhancement." },
        { status: 400 },
      );
    }

    // Enhance the summary
    console.log(`Starting enhancement for ${gapsToEnhance.length} gaps... (preview: ${preview})`);
    
    // Check if Gemini API key is configured (without making a test call to avoid wasting quota)
    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
      console.error(`[Enhancement] ERROR: Gemini API key NOT configured!`);
      return NextResponse.json(
        { 
          error: "Gemini API key is not configured. Please set GEMINI_API_KEY in your environment variables.",
          preview: true,
          changes: [],
          warnings: ["Gemini API key is missing. Cannot perform enhancements."]
        },
        { status: 500 },
      );
    }
    
    let enhancedSummary: SummaryPayload;
    let changes: Array<{
      gapId: string;
      type: string;
      section: string;
      title: string;
      original?: string;
      enhanced: string;
      action: "added" | "modified";
    }> = [];
    
    try {
      enhancedSummary = await enhanceSummary(
        originalText,
        currentSummary,
        gapsToEnhance,
        book.title || undefined,
        book.author || undefined,
        changes // Pass changes array to track what was modified
      );
      
      // Validate the enhanced summary structure
      if (!enhancedSummary || typeof enhancedSummary !== 'object') {
        throw new Error("Enhanced summary is invalid");
      }

      // Ensure all required fields exist
      if (!enhancedSummary.quick_summary) enhancedSummary.quick_summary = currentSummary.quick_summary || "";
      if (!enhancedSummary.short_summary) enhancedSummary.short_summary = currentSummary.short_summary || "";
      if (!enhancedSummary.key_ideas) enhancedSummary.key_ideas = currentSummary.key_ideas || [];
      if (!enhancedSummary.chapters) enhancedSummary.chapters = currentSummary.chapters || [];
      if (!enhancedSummary.actionable_insights) enhancedSummary.actionable_insights = currentSummary.actionable_insights || [];
      if (!enhancedSummary.quotes) enhancedSummary.quotes = currentSummary.quotes || [];
      
      console.log(`Summary enhanced successfully. ${changes.length} changes tracked.`);
      
      // If preview mode, return preview data without saving
      if (preview) {
        // Log detailed information about changes
        console.log(`[Preview Mode] Changes breakdown:`);
        changes.forEach((change, idx) => {
          console.log(`  ${idx + 1}. ${change.action} ${change.section}: ${change.title} (${change.enhanced.length} chars)`);
        });
        
        if (changes.length === 0) {
          console.warn(`[Preview Mode] No changes were generated. This might indicate:`);
          console.warn(`  - Gemini API calls failed`);
          console.warn(`  - Context was too short or empty`);
          console.warn(`  - All enhancement attempts returned null`);
        }
        
        const result = NextResponse.json({
          success: true,
          preview: true,
          message: changes.length > 0 
            ? `Generated preview for ${gapsToEnhance.length} gap(s) with ${changes.length} change(s)`
            : `Enhancement attempted for ${gapsToEnhance.length} gap(s) but no changes were generated. Check server logs for details.`,
          enhancedSummary,
          originalSummary: currentSummary,
          changes,
          enhancedGaps: gapsToEnhance.map(g => g.id),
          warnings: changes.length === 0 ? [
            "No changes were generated. This might indicate:",
            "- Gemini API calls failed or returned empty responses",
            "- Context was too short or empty",
            "- Rate limiting or API errors",
            "Check server logs for detailed error messages."
          ] : [],
        });

        // Merge auth cookies into response
        authResponse.cookies.getAll().forEach((cookie) => {
          result.cookies.set(cookie);
        });

        return result;
      }
      
      // Otherwise, save immediately (backward compatibility)
      console.log("Saving enhanced summary to database...");
    } catch (enhanceError) {
      console.error("Error during enhancement:", enhanceError);
      
      // Handle rate limit errors specifically
      if (enhanceError instanceof Error && 
          (enhanceError.name === "RateLimitError" || 
           enhanceError.message.includes("rate limit") || 
           enhanceError.message.includes("quota") ||
           enhanceError.message.includes("429"))) {
        return NextResponse.json(
          { 
            error: `Gemini API rate limit exceeded. You've reached the free tier limit of 50 requests per day. ` +
                   `Please wait 24 hours for your quota to reset, or upgrade your Gemini API plan for higher limits. ` +
                   `You can check your usage at: https://ai.dev/usage?tab=rate-limit`,
            preview: true,
            changes: [],
            warnings: [
              "Rate limit exceeded - Cannot process enhancements right now",
              "Free tier: 50 requests per day limit",
              "Wait 24 hours for quota reset or upgrade your plan",
              `Error: ${enhanceError.message}`
            ]
          },
          { status: 429 },
        );
      }
      
      return NextResponse.json(
        { 
          error: `Enhancement failed: ${enhanceError instanceof Error ? enhanceError.message : "Unknown error"}`,
          preview: true,
          changes: [],
          warnings: [
            "Enhancement failed",
            `Error: ${enhanceError instanceof Error ? enhanceError.message : "Unknown error"}`
          ]
        },
        { status: 500 },
      );
    }

    // Update the book in the database (only if not preview mode)
    const { error: updateError } = await supabase
      .from("books")
      .update({
        summary: enhancedSummary,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating book summary:", updateError);
      console.error("Update error details:", JSON.stringify(updateError, null, 2));
      return NextResponse.json(
        { error: `Failed to save enhanced summary: ${updateError.message || "Database error"}` },
        { status: 500 },
      );
    }

    const result = NextResponse.json({
      success: true,
      message: `Successfully enhanced ${gapsToEnhance.length} gap(s)`,
      enhancedGaps: gapsToEnhance.map(g => g.id),
      gapReport: {
        remainingGaps: gapReport.gaps.filter(g => !gapsToEnhance.some(e => e.id === g.id)).length,
      },
    });

    // Merge auth cookies into response
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error("Enhancement error:", error);
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error name:", error.name);
      if (error.stack) {
        console.error("Error stack:", error.stack);
      }
    } else {
      console.error("Non-Error object:", JSON.stringify(error, null, 2));
    }
    
    // Handle rate limit errors at the top level too
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit = errorMessage.includes("429") || 
                        errorMessage.includes("rate limit") || 
                        errorMessage.includes("quota") ||
                        (error instanceof Error && error.name === "RateLimitError");
    
    return NextResponse.json(
      { 
        error: isRateLimit 
          ? `Gemini API rate limit exceeded. Free tier limit: 50 requests/day. Please wait 24 hours or upgrade your plan.`
          : errorMessage || "Enhancement failed. Check server logs for details.",
        preview: true,
        changes: [],
        warnings: [
          "An error occurred during enhancement",
          isRateLimit 
            ? "Rate limit exceeded - Cannot process enhancements right now"
            : "Check server logs for detailed error information",
          `Error: ${errorMessage}`
        ]
      },
      { status: isRateLimit ? 429 : 500 },
    );
  }
}

/**
 * Get gap report without enhancing
 */
export async function GET(
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
        { error: "You must be logged in to analyze summaries." },
        { status: 401 },
      );
    }

    // Get the book details
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("*")
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
        { error: "You don't have permission to analyze this book." },
        { status: 403 },
      );
    }

    // Check if we have a local file path
    if (!book.local_file_path) {
      return NextResponse.json(
        { error: "Original file not available for analysis." },
        { status: 400 },
      );
    }

    // Read the original file
    let originalText: string;
    try {
      const fileBuffer = await readFile(book.local_file_path);
      const file = new File([fileBuffer], book.title || "book", {
        type: getMimeTypeFromPath(book.local_file_path),
      });
      originalText = await extractTextFromFile(file);
    } catch (fileError) {
      console.error("Error reading original file:", fileError);
      return NextResponse.json(
        { error: "Could not read the original file." },
        { status: 500 },
      );
    }

    // Detect gaps
    const currentSummary = book.summary as SummaryPayload;
    const gapReport = detectGaps(
      originalText,
      currentSummary,
      book.title || undefined,
      book.author || undefined
    );

    const result = NextResponse.json({
      success: true,
      gapReport,
    });

    // Merge auth cookies into response
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error("Gap analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 },
    );
  }
}

async function enhanceSummary(
  bookText: string,
  currentSummary: SummaryPayload,
  gaps: Gap[],
  bookTitle: string | undefined,
  bookAuthor: string | undefined,
  changes: Array<{
    gapId: string;
    type: string;
    section: string;
    title: string;
    original?: string;
    enhanced: string;
    action: "added" | "modified";
  }>
): Promise<SummaryPayload> {
  const enhancedSummary = { ...currentSummary };

  // Group gaps by section for more efficient processing
  const gapsBySection = gaps.reduce((acc, gap) => {
    if (!acc[gap.section]) {
      acc[gap.section] = [];
    }
    acc[gap.section].push(gap);
    return acc;
  }, {} as Record<string, Gap[]>);

  // Enhance each section
  for (const [section, sectionGaps] of Object.entries(gapsBySection)) {
    if (section === "chapters") {
      await enhanceChapters(bookText, enhancedSummary, sectionGaps, bookTitle, bookAuthor, changes);
    } else if (section === "key_ideas") {
      await enhanceKeyIdeas(bookText, enhancedSummary, sectionGaps, bookTitle, bookAuthor, changes);
    } else if (section === "actionable_insights") {
      await enhanceInsights(bookText, enhancedSummary, sectionGaps, bookTitle, bookAuthor, changes);
    } else if (section === "quotes") {
      await enhanceQuotes(bookText, enhancedSummary, sectionGaps, bookTitle, bookAuthor, changes);
    } else if (section === "quick_summary") {
      await enhanceQuickSummary(bookText, enhancedSummary, sectionGaps, bookTitle, bookAuthor, changes);
    }
  }

  return enhancedSummary;
}

async function enhanceChapters(
  bookText: string,
  summary: SummaryPayload,
  gaps: Gap[],
  bookTitle: string | undefined,
  bookAuthor: string | undefined,
  changes: Array<{
    gapId: string;
    type: string;
    section: string;
    title: string;
    original?: string;
    enhanced: string;
    action: "added" | "modified";
  }>
) {
  if (!summary.chapters) {
    summary.chapters = [];
  }
  
  console.log(`[enhanceChapters] Processing ${gaps.length} gaps...`);
  
  // Process gaps sequentially to avoid rate limiting
  const DELAY_BETWEEN_GAPS = 1000; // 1 second delay between each gap
  
  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    console.log(`[enhanceChapters] Processing gap ${i + 1} of ${gaps.length}: ${gap.id}`);
    
    try {
      if (gap.type === "missing_chapter") {
        console.log(`[enhanceChapters] Processing missing chapter: ${gap.title}`);
        console.log(`[enhanceChapters] bookContext available: ${!!gap.bookContext}, length: ${gap.bookContext?.length || 0}`);
        console.log(`[enhanceChapters] bookText length: ${bookText.length}`);
        
        // Use bookContext if available, otherwise use a portion of the full book text
        let context = gap.bookContext || "";
        
        // If bookContext is empty or too short, try to extract from book structure
        if (!context || context.length < 500) {
          console.log(`[enhanceChapters] bookContext too short, using book text sample`);
          // Try to get a meaningful chunk from the book
          // For missing chapters, we don't know exactly where they are, so use a general sample
          context = bookText.substring(0, Math.min(15000, bookText.length));
        }
        
        console.log(`[enhanceChapters] Using context length: ${context.length} chars`);
        
        // Generate new chapter summary
        try {
          const chapterSummary = await generateChapterSummary(
            context,
            gap.title,
            bookTitle,
            bookAuthor
          );
          
          if (chapterSummary && chapterSummary.trim()) {
            const chapterTitle = gap.title.replace("Missing Chapter: ", "");
            summary.chapters.push({
              title: chapterTitle,
              summary: chapterSummary.trim(),
            });
            changes.push({
              gapId: gap.id,
              type: gap.type,
              section: gap.section,
              title: chapterTitle,
              enhanced: chapterSummary.trim(),
              action: "added",
            });
            console.log(`[enhanceChapters] ✅ Successfully added chapter: ${gap.title}`);
          } else {
            console.warn(`[enhanceChapters] ❌ Generated summary is empty for chapter: ${gap.title}`);
          }
        } catch (summaryError) {
            console.error(`[enhanceChapters] ❌ Failed to generate summary for chapter ${gap.title} (both Gemini and OpenAI failed):`, summaryError);
            if (summaryError instanceof Error) {
              console.error(`[enhanceChapters] Error details: ${summaryError.message}`);
              // If it's a rate limit error from both APIs, throw it up to stop processing
              // (The functions handle fallback internally, so if we get here, both APIs failed)
              if (summaryError.name === "RateLimitError" || summaryError.message.includes("rate limit") || summaryError.message.includes("quota") || summaryError.message.includes("429")) {
                console.error(`[enhanceChapters] 🛑 Both Gemini and OpenAI failed - stopping all processing`);
                throw summaryError;
              }
            }
            // Continue to next gap for other errors
          }
      } else if (gap.type === "shallow_chapter") {
        // Extract index from gap ID (format: "shallow-chapter-{index}")
        const parts = gap.id.split("-");
        const chapterIndex = parts.length > 2 ? parseInt(parts[parts.length - 1]) : -1;
        
        if (chapterIndex >= 0 && summary.chapters && summary.chapters[chapterIndex]) {
          console.log(`[enhanceChapters] Enhancing shallow chapter at index ${chapterIndex}: ${summary.chapters[chapterIndex].title}`);
          // Use bookContext if available, otherwise use a portion of the full book text
          const context = gap.bookContext || bookText.substring(0, 5000);
          
          try {
            const enhanced = await enhanceChapterDetail(
              bookText,
              summary.chapters[chapterIndex].summary,
              context,
              bookTitle,
              bookAuthor
            );
            
            if (enhanced && enhanced.trim()) {
              const originalSummary = summary.chapters[chapterIndex].summary;
              summary.chapters[chapterIndex].summary = enhanced.trim();
              changes.push({
                gapId: gap.id,
                type: gap.type,
                section: gap.section,
                title: summary.chapters[chapterIndex].title,
                original: originalSummary,
                enhanced: enhanced.trim(),
                action: "modified",
              });
              console.log(`[enhanceChapters] ✅ Successfully enhanced chapter at index ${chapterIndex}`);
            } else {
              console.warn(`[enhanceChapters] ❌ Enhanced summary is empty for chapter at index ${chapterIndex}`);
            }
          } catch (enhanceError) {
            console.error(`[enhanceChapters] ❌ Failed to enhance chapter at index ${chapterIndex} (both Gemini and OpenAI failed):`, enhanceError);
            if (enhanceError instanceof Error) {
              console.error(`[enhanceChapters] Error details: ${enhanceError.message}`);
              // If it's a rate limit error from both APIs, throw it up to stop processing
              // (The functions handle fallback internally, so if we get here, both APIs failed)
              if (enhanceError.name === "RateLimitError" || enhanceError.message.includes("rate limit") || enhanceError.message.includes("quota") || enhanceError.message.includes("429")) {
                console.error(`[enhanceChapters] 🛑 Both Gemini and OpenAI failed - stopping all processing`);
                throw enhanceError;
              }
            }
            // Continue to next gap for other errors
          }
        } else {
          console.warn(`[enhanceChapters] Invalid chapter index: ${chapterIndex} for gap ${gap.id}`);
        }
      }
    } catch (error) {
      console.error(`[enhanceChapters] Error processing gap ${gap.id} (both Gemini and OpenAI failed):`, error);
      if (error instanceof Error) {
        console.error(`[enhanceChapters] Error details: ${error.message}`);
        if (error.stack) {
          console.error(`[enhanceChapters] Stack trace:`, error.stack);
        }
        // If it's a rate limit error from both APIs, throw it up to stop processing immediately
        // (The functions handle fallback internally, so if we get here, both APIs failed)
        if (error.name === "RateLimitError" || error.message.includes("rate limit") || error.message.includes("quota") || error.message.includes("429")) {
          console.error(`[enhanceChapters] 🛑 Both Gemini and OpenAI failed - stopping all processing immediately`);
          throw error;
        }
      }
      // Continue with other gaps even if one fails (for non-rate-limit errors)
    }
    
    // Delay between gaps to avoid rate limiting (except for last gap)
    if (i < gaps.length - 1) {
      console.log(`[enhanceChapters] Waiting ${DELAY_BETWEEN_GAPS}ms before next gap...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_GAPS));
    }
  }
  
  console.log(`[enhanceChapters] Completed. Total changes tracked: ${changes.length}`);
  console.log(`[enhanceChapters] Chapters in summary: ${summary.chapters?.length || 0}`);
}

async function enhanceKeyIdeas(
  bookText: string,
  summary: SummaryPayload,
  gaps: Gap[],
  bookTitle: string | undefined,
  bookAuthor: string | undefined,
  changes: Array<{
    gapId: string;
    type: string;
    section: string;
    title: string;
    original?: string;
    enhanced: string;
    action: "added" | "modified";
  }>
) {
  if (!summary.key_ideas) {
    summary.key_ideas = [];
  }
  // TODO: Implement key ideas enhancement
  // For now, preserve existing data
  console.log(`Key ideas enhancement not yet implemented for ${gaps.length} gaps`);
}

async function enhanceInsights(
  bookText: string,
  summary: SummaryPayload,
  gaps: Gap[],
  bookTitle: string | undefined,
  bookAuthor: string | undefined,
  changes: Array<{
    gapId: string;
    type: string;
    section: string;
    title: string;
    original?: string;
    enhanced: string;
    action: "added" | "modified";
  }>
) {
  if (!summary.actionable_insights) {
    summary.actionable_insights = [];
  }
  // TODO: Implement insights enhancement
  // For now, preserve existing data
  console.log(`Insights enhancement not yet implemented for ${gaps.length} gaps`);
}

async function enhanceQuotes(
  bookText: string,
  summary: SummaryPayload,
  gaps: Gap[],
  bookTitle: string | undefined,
  bookAuthor: string | undefined,
  changes: Array<{
    gapId: string;
    type: string;
    section: string;
    title: string;
    original?: string;
    enhanced: string;
    action: "added" | "modified";
  }>
) {
  if (!summary.quotes) {
    summary.quotes = [];
  }
  // TODO: Implement quotes enhancement
  // For now, preserve existing data
  console.log(`Quotes enhancement not yet implemented for ${gaps.length} gaps`);
}

async function enhanceQuickSummary(
  bookText: string,
  summary: SummaryPayload,
  gaps: Gap[],
  bookTitle: string | undefined,
  bookAuthor: string | undefined,
  changes: Array<{
    gapId: string;
    type: string;
    section: string;
    title: string;
    original?: string;
    enhanced: string;
    action: "added" | "modified";
  }>
) {
  // TODO: Implement quick summary enhancement
  // For now, preserve existing data
  console.log(`Quick summary enhancement not yet implemented for ${gaps.length} gaps`);
}

async function generateChapterSummaryWithOpenAI(
  chapterText: string,
  chapterTitle: string,
  bookTitle?: string,
  bookAuthor?: string
): Promise<string | null> {
  const { OPENAI_API_KEY, OPENAI_SUMMARY_MODEL } = process.env;
  
  if (!OPENAI_API_KEY) {
    console.error("[generateChapterSummaryWithOpenAI] OpenAI API key not configured");
    return null;
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const model = OPENAI_SUMMARY_MODEL || "gpt-4o";

  const prompt = `You are enhancing a book summary. Generate a comprehensive, detailed chapter summary (10-15 paragraphs, 1500+ words) for the following chapter from the book.

Book: ${bookTitle || "Unknown"}
Author: ${bookAuthor || "Unknown"}
Chapter Title: ${chapterTitle}

Chapter Content:
${chapterText.substring(0, 10000)}${chapterText.length > 10000 ? "... (truncated)" : ""}

Generate a detailed summary that includes:
- The main themes and concepts
- Key ideas and principles
- Important examples and case studies
- Practical applications
- Connections to other parts of the book

Write in a comprehensive, educational style suitable for a detailed book summary.`;

  console.log(`[generateChapterSummaryWithOpenAI] Calling OpenAI API...`);
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.35,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_completion_tokens: 4000,
  });

  const response = completion.choices[0]?.message?.content?.trim();
  
  if (!response || response.length < 100) {
    console.warn(`[generateChapterSummaryWithOpenAI] Response too short: ${response?.length || 0} chars`);
    return null;
  }
  
  console.log(`[generateChapterSummaryWithOpenAI] ✅ Successfully generated summary: ${response.substring(0, 100)}...`);
  return response;
}

async function generateChapterSummary(
  chapterText: string,
  chapterTitle: string,
  bookTitle?: string,
  bookAuthor?: string
): Promise<string | null> {
  try {
    console.log(`[generateChapterSummary] Starting for chapter: ${chapterTitle}`);
    console.log(`[generateChapterSummary] Context length: ${chapterText.length} chars`);
    
    if (!chapterText || chapterText.trim().length < 100) {
      console.warn(`[generateChapterSummary] Context too short: ${chapterText.length} chars`);
      return null;
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const { GEMINI_API_KEY, GEMINI_SUMMARY_MODEL } = process.env;
    
    if (!GEMINI_API_KEY) {
      console.log("[generateChapterSummary] Gemini API key not configured, falling back to OpenAI");
      return await generateChapterSummaryWithOpenAI(chapterText, chapterTitle, bookTitle, bookAuthor);
    }

    const client = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = client.getGenerativeModel({
      model: GEMINI_SUMMARY_MODEL || "gemini-2.5-pro",
    });

    const prompt = `You are enhancing a book summary. Generate a comprehensive, detailed chapter summary (10-15 paragraphs, 1500+ words) for the following chapter from the book.

Book: ${bookTitle || "Unknown"}
Author: ${bookAuthor || "Unknown"}
Chapter Title: ${chapterTitle}

Chapter Content:
${chapterText.substring(0, 10000)}${chapterText.length > 10000 ? "... (truncated)" : ""}

Generate a detailed summary that includes:
- The main themes and concepts
- Key ideas and principles
- Important examples and case studies
- Practical applications
- Connections to other parts of the book

Write in a comprehensive, educational style suitable for a detailed book summary.`;

    console.log(`[generateChapterSummary] Calling Gemini API...`);
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 4000,
      },
    });

    const response = result.response.text();
    console.log(`[generateChapterSummary] Got response, length: ${response?.length || 0} chars`);
    
    if (!response || response.trim().length < 100) {
      const errorMsg = `[generateChapterSummary] Response too short or empty. Length: ${response?.length || 0} chars`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    console.log(`[generateChapterSummary] ✅ Successfully generated summary: ${response.substring(0, 100)}...`);
    return response.trim();
  } catch (error) {
    console.error("[generateChapterSummary] ❌ Error generating chapter summary with Gemini:", error);
    
    // Check if it's a rate limit or other error that should trigger fallback
    if (error instanceof Error) {
      const isRateLimit = error.message.includes("429") || error.message.includes("quota") || error.message.includes("rate limit");
      
      if (isRateLimit) {
        console.log(`[generateChapterSummary] Rate limit detected, falling back to OpenAI...`);
      } else {
        console.log(`[generateChapterSummary] Gemini failed, falling back to OpenAI...`);
      }
      
      // Try OpenAI fallback
      try {
        const openAIResult = await generateChapterSummaryWithOpenAI(chapterText, chapterTitle, bookTitle, bookAuthor);
        if (openAIResult) {
          console.log(`[generateChapterSummary] ✅ Successfully generated summary using OpenAI fallback`);
          return openAIResult;
        }
      } catch (openAIError) {
        console.error("[generateChapterSummary] ❌ OpenAI fallback also failed:", openAIError);
      }
      
      // If OpenAI also fails, throw the original error
      if (isRateLimit) {
        const rateLimitError = new Error(
          `Gemini API rate limit exceeded. Tried OpenAI fallback but it also failed. ` +
          `Please wait or upgrade your plan. Error: ${error.message}`
        );
        rateLimitError.name = "RateLimitError";
        throw rateLimitError;
      }
      
      throw error;
    }
    throw new Error(`Unknown error generating chapter summary: ${String(error)}`);
  }
}

async function enhanceChapterDetailWithOpenAI(
  bookText: string,
  currentSummary: string,
  context: string,
  bookTitle?: string,
  bookAuthor?: string
): Promise<string | null> {
  const { OPENAI_API_KEY, OPENAI_SUMMARY_MODEL } = process.env;
  
  if (!OPENAI_API_KEY) {
    console.error("[enhanceChapterDetailWithOpenAI] OpenAI API key not configured");
    return null;
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const model = OPENAI_SUMMARY_MODEL || "gpt-4o";

  const prompt = `You are enhancing an existing book chapter summary. The current summary is too brief and needs more detail.

Book: ${bookTitle || "Unknown"}
Author: ${bookAuthor || "Unknown"}

Current Summary (${currentSummary.length} characters):
${currentSummary}

Relevant Book Context:
${context.substring(0, 5000)}${context.length > 5000 ? "... (truncated)" : ""}

Enhance this summary by:
1. Keeping all existing content
2. Adding significantly more detail (aim for 1500+ characters)
3. Including more examples, explanations, and practical applications
4. Expanding on key concepts mentioned
5. Adding connections to broader themes

Write an enhanced version that is comprehensive and detailed while maintaining the style and quality of the original.`;

  console.log(`[enhanceChapterDetailWithOpenAI] Calling OpenAI API...`);
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.35,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_completion_tokens: 4000,
  });

  const response = completion.choices[0]?.message?.content?.trim();
  
  if (!response || response.length < 100) {
    console.warn(`[enhanceChapterDetailWithOpenAI] Response too short: ${response?.length || 0} chars`);
    return null;
  }
  
  console.log(`[enhanceChapterDetailWithOpenAI] ✅ Successfully enhanced chapter detail: ${response.substring(0, 100)}...`);
  return response;
}

async function enhanceChapterDetail(
  bookText: string,
  currentSummary: string,
  context: string,
  bookTitle?: string,
  bookAuthor?: string
): Promise<string | null> {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const { GEMINI_API_KEY, GEMINI_SUMMARY_MODEL } = process.env;
    
    if (!GEMINI_API_KEY) {
      console.log("[enhanceChapterDetail] Gemini API key not configured, falling back to OpenAI");
      return await enhanceChapterDetailWithOpenAI(bookText, currentSummary, context, bookTitle, bookAuthor);
    }

    const client = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = client.getGenerativeModel({
      model: GEMINI_SUMMARY_MODEL || "gemini-2.5-pro",
    });

    const prompt = `You are enhancing an existing book chapter summary. The current summary is too brief and needs more detail.

Book: ${bookTitle || "Unknown"}
Author: ${bookAuthor || "Unknown"}

Current Summary (${currentSummary.length} characters):
${currentSummary}

Relevant Book Context:
${context.substring(0, 5000)}${context.length > 5000 ? "... (truncated)" : ""}

Enhance this summary by:
1. Keeping all existing content
2. Adding significantly more detail (aim for 1500+ characters)
3. Including more examples, explanations, and practical applications
4. Expanding on key concepts mentioned
5. Adding connections to broader themes

Write an enhanced version that is comprehensive and detailed while maintaining the style and quality of the original.`;

    console.log(`[enhanceChapterDetail] Calling Gemini API...`);
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 4000,
      },
    });

    const response = result.response.text();
    console.log(`[enhanceChapterDetail] Got response, length: ${response?.length || 0} chars`);
    
    if (!response || response.trim().length < 100) {
      const errorMsg = `[enhanceChapterDetail] Response too short or empty. Length: ${response?.length || 0} chars`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    console.log(`[enhanceChapterDetail] ✅ Successfully enhanced chapter detail: ${response.substring(0, 100)}...`);
    return response.trim();
  } catch (error) {
    console.error("[enhanceChapterDetail] ❌ Error enhancing chapter detail with Gemini:", error);
    
    // Check if it's a rate limit or other error that should trigger fallback
    if (error instanceof Error) {
      const isRateLimit = error.message.includes("429") || error.message.includes("quota") || error.message.includes("rate limit");
      
      if (isRateLimit) {
        console.log(`[enhanceChapterDetail] Rate limit detected, falling back to OpenAI...`);
      } else {
        console.log(`[enhanceChapterDetail] Gemini failed, falling back to OpenAI...`);
      }
      
      // Try OpenAI fallback
      try {
        const openAIResult = await enhanceChapterDetailWithOpenAI(bookText, currentSummary, context, bookTitle, bookAuthor);
        if (openAIResult) {
          console.log(`[enhanceChapterDetail] ✅ Successfully enhanced chapter detail using OpenAI fallback`);
          return openAIResult;
        }
      } catch (openAIError) {
        console.error("[enhanceChapterDetail] ❌ OpenAI fallback also failed:", openAIError);
      }
      
      // If OpenAI also fails, throw the original error
      if (isRateLimit) {
        const rateLimitError = new Error(
          `Gemini API rate limit exceeded. Tried OpenAI fallback but it also failed. ` +
          `Please wait or upgrade your plan. Error: ${error.message}`
        );
        rateLimitError.name = "RateLimitError";
        throw rateLimitError;
      }
      
      throw error;
    }
    throw new Error(`Unknown error enhancing chapter detail: ${String(error)}`);
  }
}

function getMimeTypeFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'epub':
      return 'application/epub+zip';
    case 'txt':
      return 'text/plain';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    default:
      return 'text/plain';
  }
}

