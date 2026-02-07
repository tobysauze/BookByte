import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { z } from "zod";

import { chunkText, mergeChunks } from "@/lib/chunk-merge";
import { extractTextFromFile } from "@/lib/pdf";
import { generateStructuredSummary } from "@/lib/openrouter";
import { analyzeBookWithMultiPass } from "@/lib/multi-pass-analysis";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { summarySchema, type SummaryPayload } from "@/lib/schemas";

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
  bookAuthor?: string,
  customPromptTemplate?: string,
  model?: string
): Promise<SummaryPayload> {
  // Use custom prompt template if provided, otherwise use default
  let chapterPrompt: string;
  
  if (customPromptTemplate) {
    // Replace placeholders in custom prompt
    chapterPrompt = customPromptTemplate
      .replace("{CHAPTER_NAME}", chapterName || `Chapter ${chapterNumber}`)
      .replace("{CHAPTER_TEXT}", chapterText.trim())
      .replace("{CHAPTER_NUMBER}", chapterNumber.toString())
      .replace("{BOOK_TITLE}", bookTitle)
      .replace("{BOOK_AUTHOR}", bookAuthor || "");
  } else {
    // Default prompt
    chapterPrompt = `You are analyzing Chapter ${chapterNumber}${chapterName ? `: "${chapterName}"` : ""} from the book "${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ""}.

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
  }

  try {
    // Use OpenRouter with custom prompt
    return await generateStructuredSummary({
      text: chapterText,
      title: bookTitle,
      author: bookAuthor,
      customPrompt: chapterPrompt,
      model: model,
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
  const structuredSummaries: z.infer<typeof summarySchema>[] = chapterSummaries.filter(isStructuredSummary);
  
  if (structuredSummaries.length === 0) {
    throw new Error("No valid structured summaries to combine");
  }
  
  // Combine all chapters
  const allChapters = structuredSummaries.flatMap((cs: z.infer<typeof summarySchema>) => cs.chapters);
  
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
    const firstShort = structuredSummaries[0].short_summary;
    if (firstShort.length < 150) {
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

/**
 * Handle multiple files (chapter-by-chapter processing)
 */
async function handleMultipleFiles(
  request: NextRequest,
  files: File[],
  providedTitle?: string,
  providedAuthor?: string,
  customPromptTemplate?: string,
  model?: string
) {
  const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to summarize books." },
      { status: 401 },
    );
  }

  // Derive title from first file if not provided
  const title = providedTitle ?? deriveTitle(files[0].name);
  const author = providedAuthor ?? null;

  console.log(`📚 Processing ${files.length} chapters for book: ${title}`);

  // Process each chapter sequentially
  const chapterSummaries: SummaryPayload[] = [];
  const errors: string[] = [];
  const originalTexts: string[] = []; // Store original chapter texts for expansion

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
      
      // Store original text for expansion
      originalTexts.push(chapterText);

      if (!chapterText.trim()) {
        errors.push(`Chapter ${chapterNumber} (${chapterName}): No readable text found`);
        continue;
      }

      // Summarize the chapter
      const chapterSummary = await summarizeChapter(
        chapterText,
        chapterNumber,
        chapterName,
        title,
        author || undefined,
        customPromptTemplate,
        model
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
    title,
    author || undefined
  );

    // Don't auto-save - return summary for user to preview first
    // User can save via the preview dialog
    const result = NextResponse.json({
      bookId: null, // Not saved yet - user will decide in preview
      summary: combinedSummary,
      metadata: {
        title,
        author: author ?? null,
        coverUrl: null,
      },
      analysis: {
        coverage: 100, // Multiple chapters processed individually
        chaptersCovered: chapterSummaries.length,
        chaptersMissing: 0,
        totalChapters: files.length,
        hasTableOfContents: false,
      },
      // Include original text for expansion purposes
      // For multiple files, combine all chapter texts
      _originalText: originalTexts.join('\n\n---\n\n'),
    });

  // merge auth cookies into response
  authResponse.cookies.getAll().forEach((cookie) => {
    result.cookies.set(cookie);
  });

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Check if multiple files were uploaded
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    const singleFile = formData.get("file") as File;
    const providedTitle = formData.get("title")?.toString();
    const providedAuthor = formData.get("author")?.toString();
    const originalFilename = formData.get("filename")?.toString();
    const customPrompt = formData.get("customPrompt")?.toString();
    const selectedModel = formData.get("model")?.toString();

    // Handle multiple files (chapter-by-chapter processing)
    // IMPORTANT: This saves the book automatically, so no need to call /api/library
    if (files.length > 0) {
      console.log(`📚 Processing ${files.length} files as chapters`);
      return await handleMultipleFiles(request, files, providedTitle, providedAuthor, customPrompt, selectedModel);
    }

    // Handle single file (existing logic)
    if (!(singleFile instanceof File)) {
      return NextResponse.json(
        { error: "A PDF, EPUB, or text file is required." },
        { status: 400 },
      );
    }

    const file = singleFile; // Use consistent variable name

    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to summarize books." },
        { status: 401 },
      );
    }

    const extractedData = await extractTextFromFile(file);
    const extractedText = extractedData.text;
    const locations = extractedData.locations;
    
    const chunks = chunkText(extractedText, { maxChunks: 5 });

    if (!chunks.length) {
      return NextResponse.json(
        { error: "No readable text found in the uploaded file. Try another file." },
        { status: 400 },
      );
    }

    const preparedText = mergeChunks(chunks);

    const title = providedTitle ?? deriveTitle(originalFilename ?? file.name);
    const author = providedAuthor ?? null;

    // Use multi-pass analysis for comprehensive book coverage
    console.log("🔍 Starting multi-pass book analysis...");
    let analysisResult;
    let summary: SummaryPayload;
    
    try {
      // Pass the selected model to multi-pass analysis
      analysisResult = await analyzeBookWithMultiPass(
        preparedText,
        title,
        author ?? undefined,
        locations, // Pass location data for citation support
        selectedModel // Pass selected model
      );
      
      console.log(`✅ Multi-pass analysis complete. Coverage: ${analysisResult.coverage.coveragePercentage}%`);
      
      if (analysisResult.coverage.chaptersMissing.length > 0) {
        console.log(`⚠️  Missing chapters: ${analysisResult.coverage.chaptersMissing.join(", ")}`);
      }
      
      summary = analysisResult.summary;
    } catch (error) {
      console.error("❌ Multi-pass analysis failed, falling back to simple analysis:", error);
      
      // Fallback to simple analysis using OpenRouter
      console.log("🔄 Falling back to simple analysis...");
      summary = await generateStructuredSummary({
        text: preparedText,
        title,
        author: author ?? undefined,
        locations,
        model: selectedModel,
      });
      
      // Create a simple analysis result
      analysisResult = {
        structure: {
          title,
          author: author ?? undefined,
          chapters: [],
          totalChapters: 0,
          hasTableOfContents: false
        },
        summary,
        coverage: {
          chaptersCovered: [],
          chaptersMissing: [],
          coveragePercentage: 100,
          needsAdditionalPass: false
        }
      };
    }

    let fileUrl: string | null = null;
    let localFilePath: string | null = null;
    
    if (file.size > 0) {
      // Save to Supabase storage
      const storagePath = `${user.id}/${Date.now()}-${sanitizeFilename(
        originalFilename ?? file.name,
      )}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("book-files")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Failed to upload file to storage", uploadError);
      } else if (uploadData) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("book-files").getPublicUrl(uploadData.path);
        fileUrl = publicUrl;
      }

      // Also save to local storage directory
      try {
        const fileExtension = getFileExtension(file.name);
        const localDir = join(process.cwd(), "storage", "books", fileExtension);
        await mkdir(localDir, { recursive: true });
        
        const localFileName = `${Date.now()}-${sanitizeFilename(originalFilename ?? file.name)}`;
        localFilePath = join(localDir, localFileName);
        
        const fileBuffer = await file.arrayBuffer();
        await writeFile(localFilePath, Buffer.from(fileBuffer));
        
        console.log(`📁 Saved original file to: ${localFilePath}`);
      } catch (localError) {
        console.error("Failed to save file to local storage:", localError);
        // Don't fail the entire operation if local storage fails
      }
    }

    // Don't auto-save book record - return summary for user to preview first
    // Files are saved to storage, but book record creation is deferred until user confirms
    const result = NextResponse.json({
      bookId: null, // Not saved yet - user will decide in preview
      summary,
      metadata: {
        title,
        author: author ?? null,
        coverUrl: null,
      },
      analysis: {
        coverage: analysisResult.coverage.coveragePercentage,
        chaptersCovered: analysisResult.coverage.chaptersCovered.length,
        chaptersMissing: analysisResult.coverage.chaptersMissing.length,
        totalChapters: analysisResult.structure.totalChapters,
        hasTableOfContents: analysisResult.structure.hasTableOfContents,
      },
      // Include file info for saving later
      _fileInfo: {
        fileUrl,
        localFilePath,
      },
      // Include original text for expansion purposes
      _originalText: preparedText,
    });

    // merge auth cookies into response
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

function deriveTitle(filename: string) {
  if (!filename) return "Untitled Book";
  return filename.replace(/[_-]+/g, " ").replace(/\.[^/.]+$/, "").trim() || "Untitled Book";
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-z0-9.\-]/gi, "_");
}

function getFileExtension(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'epub':
      return 'epub';
    case 'txt':
      return 'txt';
    case 'md':
    case 'markdown':
      return 'md';
    default:
      return 'txt'; // Default fallback
  }
}

