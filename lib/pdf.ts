import pdfParse from "pdf-parse";
import { parseEpubFile, isEpubFile } from "./epub-parser";

const MAX_PAGES = 500;

export interface TextWithLocations {
  text: string;
  locations: Array<{
    start: number;
    end: number;
    page?: number;
    line?: number;
    chapter?: string;
  }>;
}

export async function extractTextFromFile(file: File | Blob): Promise<TextWithLocations> {
  const mimeType = file.type || "application/pdf";
  const arrayBuffer = await file.arrayBuffer();

  if (mimeType === "application/pdf" || file.name?.endsWith(".pdf")) {
    return extractTextFromPdfBuffer(arrayBuffer);
  }

  if (isEpubFile(file as File)) {
    return extractTextFromEpubFile(file as File);
  }

  // For TXT files, track line numbers
  const decoder = new TextDecoder("utf-8");
  const text = decoder.decode(arrayBuffer);
  return extractTextWithLineNumbers(text);
}

export async function extractTextFromPdfBuffer(buffer: ArrayBuffer | Buffer): Promise<TextWithLocations> {
  const data = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer.byteLength ? buffer : new ArrayBuffer(0));

  const pages: string[] = [];
  const result = await pdfParse(data, {
    max: MAX_PAGES,
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      // Extract text more accurately, preserving word boundaries
      const pageText = textContent.items
        .map((item) => {
          if (typeof item === "string") return item;
          // Handle text items with transform information
          if (item.str) {
            // Add space before/after if transform indicates new word
            return item.str;
          }
          return "";
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push(pageText);
      return pageText;
    },
  });

  // Use the pages array we built instead of result.text for consistency
  // This ensures we're counting words from the exact text we extracted
  const fullText = normalizeWhitespace(pages.join(" "));
  
  // Build locations array tracking page numbers
  const locations: TextWithLocations["locations"] = [];
  let currentPos = 0;
  
  for (let pageNum = 0; pageNum < pages.length; pageNum++) {
    const pageText = pages[pageNum];
    const startPos = currentPos;
    const endPos = currentPos + pageText.length;
    
    locations.push({
      start: startPos,
      end: endPos,
      page: pageNum + 1, // 1-indexed pages
    });
    
    currentPos = endPos + 1; // +1 for separator/newline
  }

  return {
    text: fullText,
    locations,
  };
}

function extractTextWithLineNumbers(text: string): TextWithLocations {
  const lines = text.split(/\r?\n/);
  const fullText = normalizeWhitespace(text);
  const locations: TextWithLocations["locations"] = [];
  
  let currentPos = 0;
  lines.forEach((line, index) => {
    if (line.trim()) {
      const startPos = currentPos;
      const endPos = currentPos + line.length;
      
      locations.push({
        start: startPos,
        end: endPos,
        line: index + 1, // 1-indexed lines
      });
      
      currentPos = endPos + 1; // +1 for newline
    } else {
      currentPos += 1; // Empty line
    }
  });

  return {
    text: fullText,
    locations,
  };
}

export async function extractTextFromEpubFile(file: File): Promise<TextWithLocations> {
  try {
    const epubBook = await parseEpubFile(file);
    const fullText = normalizeWhitespace(epubBook.fullText);
    
    // Build locations array tracking chapter information
    const locations: TextWithLocations["locations"] = [];
    let currentPos = 0;
    
    epubBook.chapters.forEach((chapter, index) => {
      const chapterText = chapter.content;
      const startPos = currentPos;
      const endPos = currentPos + chapterText.length;
      
      locations.push({
        start: startPos,
        end: endPos,
        chapter: chapter.title,
      });
      
      currentPos = endPos + 2; // +2 for "\n\n" separator
    });

    return {
      text: fullText,
      locations,
    };
  } catch (error) {
    console.error("Error extracting text from EPUB:", error);
    throw new Error(`Failed to extract text from EPUB file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function normalizeWhitespace(text: string) {
  return text.replace(/\r?\n+/g, "\n").replace(/\s{2,}/g, " ").trim();
}

/**
 * Find the location (page/line/chapter) for a given text position
 */
export function findLocationForPosition(
  position: number,
  locations: TextWithLocations["locations"]
): { page?: number; line?: number; chapter?: string } | null {
  for (const loc of locations) {
    if (position >= loc.start && position <= loc.end) {
      return {
        page: loc.page,
        line: loc.line,
        chapter: loc.chapter,
      };
    }
  }
  return null;
}

/**
 * Find the location for a quote text within the original text
 */
export function findQuoteLocation(
  quote: string,
  fullText: string,
  locations: TextWithLocations["locations"]
): { page?: number; line?: number; chapter?: string } | null {
  // Normalize both texts for comparison
  const normalizedQuote = quote.trim().replace(/\s+/g, " ");
  const normalizedText = fullText.replace(/\s+/g, " ");
  
  // Find the quote position in the text
  const index = normalizedText.indexOf(normalizedQuote);
  if (index === -1) {
    // Try a fuzzy match - find first 20 characters
    const quoteStart = normalizedQuote.substring(0, 50);
    const fuzzyIndex = normalizedText.indexOf(quoteStart);
    if (fuzzyIndex !== -1) {
      return findLocationForPosition(fuzzyIndex, locations);
    }
    return null;
  }
  
  return findLocationForPosition(index, locations);
}

