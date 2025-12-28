import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/pdf";

export const runtime = "nodejs";

// Count words in text - more accurate algorithm
function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  
  // Normalize whitespace first
  const normalized = text.replace(/\s+/g, " ").trim();
  
  // Split by whitespace and filter out empty strings
  // This handles multiple spaces, tabs, newlines correctly
  const words = normalized.split(/\s+/).filter(word => {
    // Filter out empty strings
    if (word.length === 0) return false;
    // Include words that contain at least one letter or number
    // This handles hyphenated words correctly (e.g., "well-known" counts as one word)
    // Also handles Unicode characters (non-English languages)
    return /[\w\u00C0-\u1FFF\u2C00-\uD7FF]/.test(word);
  });
  
  return words.length;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided." },
        { status: 400 }
      );
    }

    let totalWords = 0;
    const fileWordCounts: Array<{ filename: string; words: number; warning?: string }> = [];

    for (const file of files) {
      try {
        // Extract text from file (works for PDF, EPUB, and text files)
        const extractedData = await extractTextFromFile(file);
        
        // Check if extraction seems successful (has meaningful text)
        const wordCount = countWords(extractedData.text);
        
        // Warn if PDF has very few words (might be scanned/image-based)
        let warning: string | undefined;
        if (file.name.toLowerCase().endsWith('.pdf') && wordCount < 100 && file.size > 100000) {
          warning = "Low word count detected. This PDF may be image-based (scanned). OCR not available.";
        }
        
        totalWords += wordCount;
        fileWordCounts.push({
          filename: file.name,
          words: wordCount,
          ...(warning && { warning }),
        });
      } catch (error) {
        console.error(`Error analyzing ${file.name}:`, error);
        fileWordCounts.push({
          filename: file.name,
          words: 0,
          warning: `Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        // Continue with other files even if one fails
      }
    }

    return NextResponse.json({
      totalWords,
      fileWordCounts,
    });
  } catch (error) {
    console.error("Error in POST /api/analyze-word-count:", error);
    return NextResponse.json(
      { error: "Failed to analyze word count." },
      { status: 500 }
    );
  }
}

