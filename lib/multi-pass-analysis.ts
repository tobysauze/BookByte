import { generateStructuredSummary } from "./openrouter";
import { z } from "zod";
import { summarySchema, type SummaryPayload } from "./schemas";

function isStructuredSummary(
  summary: SummaryPayload,
): summary is z.infer<typeof summarySchema> {
  return (
    typeof summary === "object" &&
    summary !== null &&
    "quick_summary" in summary &&
    typeof (summary as Record<string, unknown>).quick_summary === "string"
  );
}

export interface BookStructure {
  title: string;
  author?: string;
  chapters: Array<{
    number?: string;
    title: string;
    pageRange?: string;
    subsections?: string[];
  }>;
  totalChapters: number;
  hasTableOfContents: boolean;
}

export interface AnalysisResult {
  structure: BookStructure;
  summary: SummaryPayload;
  coverage: {
    chaptersCovered: string[];
    chaptersMissing: string[];
    coveragePercentage: number;
    needsAdditionalPass: boolean;
  };
}

/**
 * Multi-pass book analysis system that ensures comprehensive coverage
 */
export class MultiPassBookAnalyzer {
  private text: string;
  private title: string;
  private author?: string;
  private model?: string;
  private locations?: Array<{
    start: number;
    end: number;
    page?: number;
    line?: number;
    chapter?: string;
  }>;

  constructor(
    text: string, 
    title: string, 
    author?: string,
    locations?: Array<{
      start: number;
      end: number;
      page?: number;
      line?: number;
      chapter?: string;
    }>,
    model?: string
  ) {
    this.text = text;
    this.title = title;
    this.author = author;
    this.locations = locations;
    this.model = model;
  }

  /**
   * Main analysis method that orchestrates the multi-pass process
   */
  async analyze(): Promise<AnalysisResult> {
    console.log("🔍 Starting multi-pass book analysis...");
    
    try {
      // Pass 1: Analyze table of contents and book structure
      const structure = await this.analyzeBookStructure();
      console.log(`📚 Found ${structure.totalChapters} chapters in book structure`);

      // Pass 2: Generate initial comprehensive summary
      const initialSummary = await this.generateInitialSummary(structure);
      console.log("📝 Generated initial comprehensive summary");

      // Pass 3: Cross-reference with TOC to identify gaps
      const coverage = this.analyzeCoverage(structure, initialSummary);
      console.log(`📊 Coverage analysis: ${coverage.coveragePercentage}% complete`);

      // Pass 4: Fill gaps if needed
      let finalSummary = initialSummary;
      if (coverage.needsAdditionalPass) {
        console.log("🔄 Additional pass needed - filling gaps...");
        finalSummary = await this.fillGaps(structure, initialSummary, coverage);
        console.log("✅ Gap filling completed");
      }

      return {
        structure,
        summary: finalSummary,
        coverage: this.analyzeCoverage(structure, finalSummary)
      };
    } catch (error) {
      console.error("❌ Multi-pass analysis failed:", error);
      
      // Fallback to simple analysis if multi-pass fails
      console.log("🔄 Falling back to simple analysis...");
      try {
        const fallbackSummary = await this.generateFallbackSummary();
        return {
          structure: {
            title: this.title,
            author: this.author,
            chapters: [],
            totalChapters: 0,
            hasTableOfContents: false
          },
          summary: fallbackSummary,
          coverage: {
            chaptersCovered: [],
            chaptersMissing: [],
            coveragePercentage: 100,
            needsAdditionalPass: false
          }
        };
      } catch (fallbackError) {
        console.error("❌ Fallback analysis also failed:", fallbackError);
        throw new Error("Unable to analyze the book. Please try again.");
      }
    }
  }

  /**
   * Pass 1: Analyze table of contents and book structure
   */
  private async analyzeBookStructure(): Promise<BookStructure> {
    // First, try to find a table of contents section
    const tocSection = this.findTableOfContents();
    
    const tocPrompt = `Analyze the following book text and extract the complete table of contents structure. Look for:

1. Chapter titles and numbers (including variations like "Chapter 1", "1.", "One", etc.)
2. Page ranges for each chapter
3. Subsections within chapters
4. Any other structural elements
5. Look through the ENTIRE text, not just the beginning

Book Title: ${this.title}
${this.author ? `Author: ${this.author}` : ''}

IMPORTANT: Make sure to find ALL chapters in the book. Look for patterns like:
- "Chapter 1", "Chapter 2", etc.
- "1.", "2.", etc.
- "One", "Two", "Three", etc.
- Roman numerals: "I", "II", "III", etc.
- Any other chapter numbering systems

Return a JSON structure like this:
{
  "title": "Book Title",
  "author": "Author Name",
  "chapters": [
    {
      "number": "1",
      "title": "Chapter Title",
      "pageRange": "1-25",
      "subsections": ["Section 1", "Section 2"]
    }
  ],
  "totalChapters": 10,
  "hasTableOfContents": true
}

${tocSection ? `Table of Contents Section Found:\n${tocSection}\n\n` : ''}

Book Text (first 20k chars for analysis):
${this.text.substring(0, 20000)}
`;

    try {
      // Use OpenRouter for TOC analysis
      const { OPENROUTER_API_KEY, OPENROUTER_MODEL } = process.env;
      const modelToUse = this.model || OPENROUTER_MODEL || "openai/gpt-4o";
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [{ role: "user", content: tocPrompt }],
          temperature: 0.1,
          response_format: { type: "json_object" },
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      const responseText = data.choices?.[0]?.message?.content || "";
      console.log("OpenRouter TOC response:", responseText.substring(0, 500));

      // Clean up the response to ensure it's valid JSON
      const cleanedResponse = this.cleanJsonResponse(responseText);
      const structure = JSON.parse(cleanedResponse);
      
      // Validate the structure has required fields
      if (!structure.chapters || !Array.isArray(structure.chapters)) {
        structure.chapters = [];
      }
      if (typeof structure.totalChapters !== 'number') {
        structure.totalChapters = structure.chapters.length;
      }

      // Additional validation: check if we found a reasonable number of chapters
      if (structure.chapters.length === 0) {
        console.log("⚠️ No chapters found in TOC analysis, trying alternative detection...");
        const alternativeChapters = this.detectChaptersAlternative();
        if (alternativeChapters.length > 0) {
          structure.chapters = alternativeChapters;
          structure.totalChapters = alternativeChapters.length;
          console.log(`✅ Found ${alternativeChapters.length} chapters using alternative detection`);
        }
      }
      
      return structure as BookStructure;
    } catch (error) {
      console.error("Error analyzing book structure:", error);
      // Fallback: create a basic structure
      return {
        title: this.title,
        author: this.author,
        chapters: [],
        totalChapters: 0,
        hasTableOfContents: false
      };
    }
  }

  /**
   * Pass 2: Generate initial comprehensive summary
   */
  private async generateInitialSummary(structure: BookStructure): Promise<SummaryPayload> {
    const enhancedPrompt = `You are analyzing a book with the following structure:

${JSON.stringify(structure, null, 2)}

Your task is to create a comprehensive summary that covers ALL chapters and sections identified in the structure above. For each chapter, provide detailed analysis including:

1. Key principles and concepts
2. Practical applications and tactics
3. Real-world examples and case studies
4. Implementation strategies
5. Connections to other chapters

Make sure to reference specific chapters by name/number in your analysis.

Book Text:
${this.text}`;

    try {
      return await generateStructuredSummary({
        text: enhancedPrompt,
        title: this.title,
        author: this.author,
        locations: this.locations,
        model: this.model,
        customPrompt: enhancedPrompt,
      });
    } catch (error) {
      console.error("Error generating initial summary:", error);
      throw error;
    }
  }

  /**
   * Pass 3: Analyze coverage against the table of contents
   */
  private analyzeCoverage(structure: BookStructure, summary: SummaryPayload): {
    chaptersCovered: string[];
    chaptersMissing: string[];
    coveragePercentage: number;
    needsAdditionalPass: boolean;
  } {
    const allChapterTitles = structure.chapters.map(ch => ch.title.toLowerCase());
    const summaryText = (() => {
      if (isStructuredSummary(summary)) {
        return [
          summary.quick_summary,
          ...summary.key_ideas.map((ki) => ki.text),
          ...summary.chapters.map((ch) => `${ch.title} ${ch.summary}`),
          ...summary.actionable_insights,
          ...summary.quotes,
        ]
          .join(" ")
          .toLowerCase();
      }

      // Raw-text / custom-prompt summary: fall back to searching whatever text we have.
      const rawText =
        typeof summary === "object" &&
        summary !== null &&
        "raw_text" in summary &&
        typeof (summary as Record<string, unknown>).raw_text === "string"
          ? ((summary as Record<string, unknown>).raw_text as string)
          : JSON.stringify(summary);

      return rawText.toLowerCase();
    })();

    const chaptersCovered: string[] = [];
    const chaptersMissing: string[] = [];

    allChapterTitles.forEach(chapterTitle => {
      // More thorough coverage check
      const titleWords = chapterTitle.split(/\s+/).filter(word => word.length > 2);
      
      // Check multiple ways the chapter might be referenced
      const isCovered = 
        summaryText.includes(chapterTitle) || // Exact title match
        titleWords.some(word => summaryText.includes(word)) || // Key words
        (isStructuredSummary(summary)
          ? summary.chapters.some((ch) =>
              ch.title.toLowerCase().includes(chapterTitle),
            )
          : false) || // In chapter summaries
        this.checkChapterNumberReference(chapterTitle, summaryText, structure); // Chapter number references

      if (isCovered) {
        chaptersCovered.push(chapterTitle);
      } else {
        chaptersMissing.push(chapterTitle);
      }
    });

    const coveragePercentage = allChapterTitles.length > 0 
      ? Math.round((chaptersCovered.length / allChapterTitles.length) * 100)
      : 100;

    // Be more aggressive about gap filling - if we're missing more than 20% of chapters
    const needsAdditionalPass = chaptersMissing.length > 0 && coveragePercentage < 80;

    console.log(`📊 Coverage Analysis Results:`);
    console.log(`   Total chapters: ${allChapterTitles.length}`);
    console.log(`   Covered: ${chaptersCovered.length}`);
    console.log(`   Missing: ${chaptersMissing.length}`);
    console.log(`   Coverage: ${coveragePercentage}%`);
    console.log(`   Missing chapters: ${chaptersMissing.join(", ")}`);

    return {
      chaptersCovered,
      chaptersMissing,
      coveragePercentage,
      needsAdditionalPass
    };
  }

  /**
   * Check if a chapter is referenced by its number in the summary
   */
  private checkChapterNumberReference(chapterTitle: string, summaryText: string, structure: BookStructure): boolean {
    const chapter = structure.chapters.find(ch => ch.title.toLowerCase() === chapterTitle);
    if (!chapter || !chapter.number) return false;

    const numberPatterns = [
      `chapter ${chapter.number}`,
      `chapter ${chapter.number}:`,
      `${chapter.number}.`,
      `chapter ${this.numberToWord(chapter.number)}`,
      `chapter ${this.numberToRoman(chapter.number)}`
    ];

    return numberPatterns.some(pattern => summaryText.includes(pattern.toLowerCase()));
  }

  /**
   * Convert number to word (1 -> one, 2 -> two, etc.)
   */
  private numberToWord(num: string): string {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const n = parseInt(num);
    return n >= 0 && n < words.length ? words[n] : num;
  }

  /**
   * Convert number to roman numeral (1 -> I, 2 -> II, etc.)
   */
  private numberToRoman(num: string): string {
    const n = parseInt(num);
    if (n === 1) return 'I';
    if (n === 2) return 'II';
    if (n === 3) return 'III';
    if (n === 4) return 'IV';
    if (n === 5) return 'V';
    if (n === 6) return 'VI';
    if (n === 7) return 'VII';
    if (n === 8) return 'VIII';
    if (n === 9) return 'IX';
    if (n === 10) return 'X';
    return num;
  }

  /**
   * Pass 4: Fill gaps by analyzing missing chapters in detail
   */
  private async fillGaps(
    structure: BookStructure, 
    currentSummary: SummaryPayload, 
    coverage: { chaptersMissing: string[] }
  ): Promise<SummaryPayload> {
    if (coverage.chaptersMissing.length === 0) {
      return currentSummary;
    }

    console.log(`🔍 Analyzing missing chapters: ${coverage.chaptersMissing.join(", ")}`);

    // Find text sections for missing chapters
    const missingChapters = structure.chapters.filter(ch => 
      coverage.chaptersMissing.includes(ch.title.toLowerCase())
    );

    let additionalContent = "";
    for (const chapter of missingChapters) {
      // Try to find the chapter content in the text
      const chapterContent = this.findChapterContent(chapter);
      if (chapterContent) {
        additionalContent += `\n\n## ${chapter.title}\n${chapterContent}`;
      } else {
        // If we can't find the specific chapter, try to find it by searching the entire text
        console.log(`⚠️ Could not find content for chapter: ${chapter.title}`);
        const fallbackContent = this.findChapterContentFallback(chapter);
        if (fallbackContent) {
          additionalContent += `\n\n## ${chapter.title}\n${fallbackContent}`;
        }
      }
    }

    if (!additionalContent) {
      console.log("⚠️ No additional content found for missing chapters");
      return currentSummary;
    }

    const gapFillingPrompt = `The following chapters were identified as missing from the previous summary. Please analyze them and provide comprehensive coverage:

Missing Chapters: ${coverage.chaptersMissing.join(", ")}

Additional Content:
${additionalContent}

Please provide detailed analysis for these missing chapters, including:
1. Key principles and concepts
2. Practical applications and tactics  
3. Real-world examples and case studies
4. Implementation strategies
5. How they connect to the overall book themes

IMPORTANT: Make sure to create chapter summaries for ALL missing chapters listed above. Each missing chapter should have its own entry in the chapters array.

Return the analysis in the same JSON format as the original summary, but focus only on the missing chapters.`;

    try {
      const gapAnalysis = await generateStructuredSummary({
        text: gapFillingPrompt,
        title: this.title,
        author: this.author,
        locations: this.locations,
        model: this.model,
        customPrompt: gapFillingPrompt,
      });

      // Merge the gap analysis with the current summary
      return this.mergeSummaries(currentSummary, gapAnalysis);
    } catch (error) {
      console.error("Error filling gaps:", error);
      return currentSummary;
    }
  }

  /**
   * Fallback method to find chapter content when normal detection fails
   */
  private findChapterContentFallback(chapter: { title: string; number?: string }): string | null {
    // Try more aggressive search patterns
    const searchPatterns = [
      new RegExp(`\\b${chapter.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
      new RegExp(`chapter\\s+${chapter.number}\\b`, 'gi'),
      new RegExp(`\\b${chapter.number}\\.\\s*${chapter.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    ];

    for (const pattern of searchPatterns) {
      const match = pattern.exec(this.text);
      if (match) {
        const start = match.index;
        const nextChapterIndex = this.findNextChapterIndex(start + 1);
        const end = nextChapterIndex !== -1 ? nextChapterIndex : Math.min(start + 8000, this.text.length);
        
        return this.text.substring(start, end);
      }
    }

    return null;
  }

  /**
   * Alternative chapter detection when TOC analysis fails
   */
  private detectChaptersAlternative(): Array<{ number: string; title: string; pageRange?: string; subsections?: string[] }> {
    const chapters: Array<{ number: string; title: string; pageRange?: string; subsections?: string[] }> = [];
    
    // Look for chapter patterns throughout the text
    const chapterPatterns = [
      /^chapter\s+(\d+)[:\.\s]+(.+)$/gim,
      /^(\d+)\.\s+(.+)$/gm,
      /^part\s+([ivx\d]+)[:\.\s]+(.+)$/gim,
      /^section\s+(\d+)[:\.\s]+(.+)$/gim
    ];

    for (const pattern of chapterPatterns) {
      let match;
      while ((match = pattern.exec(this.text)) !== null) {
        const number = match[1];
        const title = match[2].trim();
        
        // Avoid duplicates
        if (!chapters.some(ch => ch.title === title || ch.number === number)) {
          chapters.push({
            number,
            title,
            pageRange: undefined,
            subsections: []
          });
        }
      }
    }

    // Sort by chapter number
    chapters.sort((a, b) => {
      const numA = parseInt(a.number) || 0;
      const numB = parseInt(b.number) || 0;
      return numA - numB;
    });

    return chapters;
  }

  /**
   * Find table of contents section in the text
   */
  private findTableOfContents(): string | null {
    const tocPatterns = [
      /table\s+of\s+contents?/gi,
      /contents?/gi,
      /chapter\s+list/gi,
      /outline/gi
    ];

    for (const pattern of tocPatterns) {
      const match = pattern.exec(this.text);
      if (match) {
        // Extract text from TOC heading to next major section
        const start = match.index;
        const nextSectionPattern = /\n\s*(?:introduction|preface|chapter\s+1|1\.|part\s+i)/gi;
        const nextSectionMatch = nextSectionPattern.exec(this.text.substring(start + 100));
        
        const end = nextSectionMatch ? start + 100 + nextSectionMatch.index : start + 5000;
        return this.text.substring(start, Math.min(end, this.text.length));
      }
    }

    return null;
  }

  /**
   * Find chapter content in the text
   */
  private findChapterContent(chapter: { title: string; number?: string }): string | null {
    const titleVariations = [
      chapter.title,
      `Chapter ${chapter.number}`,
      `Chapter ${chapter.number}: ${chapter.title}`,
      chapter.title.toLowerCase(),
      chapter.title.toUpperCase()
    ];

    for (const variation of titleVariations) {
      const index = this.text.toLowerCase().indexOf(variation.toLowerCase());
      if (index !== -1) {
        // Extract content from this chapter to the next chapter or end
        const start = index;
        const nextChapterIndex = this.findNextChapterIndex(start + 1);
        const end = nextChapterIndex !== -1 ? nextChapterIndex : this.text.length;
        
        return this.text.substring(start, end).substring(0, 5000); // Limit to 5k chars
      }
    }

    return null;
  }

  /**
   * Find the start of the next chapter
   */
  private findNextChapterIndex(startFrom: number): number {
    const chapterPatterns = [
      /\n\s*chapter\s+\d+/gi,
      /\n\s*\d+\.\s*[A-Z]/g,
      /\n\s*[A-Z][A-Z\s]+$/gm,
      /\n\s*part\s+[ivx\d]+/gi,
      /\n\s*section\s+\d+/gi,
      /\n\s*[ivx]+\./gi, // Roman numerals
      /\n\s*\d+\s+[A-Z][a-z]/g // Number followed by title
    ];

    let earliestIndex = -1;
    for (const pattern of chapterPatterns) {
      const match = pattern.exec(this.text.substring(startFrom));
      if (match && (earliestIndex === -1 || match.index < earliestIndex)) {
        earliestIndex = startFrom + match.index;
      }
    }

    return earliestIndex;
  }

  /**
   * Generate a fallback summary when multi-pass analysis fails
   */
  private async generateFallbackSummary(): Promise<SummaryPayload> {
    console.log("🔄 Generating fallback summary...");
    
    try {
      return await generateStructuredSummary({
        text: this.text,
        title: this.title,
        author: this.author,
        locations: this.locations,
        model: this.model,
      });
    } catch (error) {
      console.error("Fallback summary generation failed:", error);
      throw error;
    }
  }

  /**
   * Clean and validate JSON response from AI
   */
  private cleanJsonResponse(response: string): string {
    // Remove any markdown code blocks
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    
    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();
    
    // If the response doesn't start with {, try to find the JSON object
    if (!cleaned.startsWith('{')) {
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
    }
    
    return cleaned;
  }

  /**
   * Merge two summaries together
   */
  private mergeSummaries(original: SummaryPayload, additional: SummaryPayload): SummaryPayload {
    if (isStructuredSummary(original) && isStructuredSummary(additional)) {
      return {
        ai_provider: original.ai_provider ?? additional.ai_provider,
        short_summary: original.short_summary,
        quick_summary: `${original.quick_summary}\n\n${additional.quick_summary}`,
        key_ideas: [...original.key_ideas, ...additional.key_ideas],
        chapters: [...original.chapters, ...additional.chapters],
        actionable_insights: [
          ...original.actionable_insights,
          ...additional.actionable_insights,
        ],
        quotes: [...original.quotes, ...additional.quotes],
      };
    }

    // Fallbacks for raw-text / custom-prompt summaries.
    if (isStructuredSummary(original)) return original;
    if (isStructuredSummary(additional)) return additional;

    const originalRaw =
      typeof original === "object" &&
      original !== null &&
      "raw_text" in original &&
      typeof (original as Record<string, unknown>).raw_text === "string"
        ? ((original as Record<string, unknown>).raw_text as string)
        : JSON.stringify(original);

    const additionalRaw =
      typeof additional === "object" &&
      additional !== null &&
      "raw_text" in additional &&
      typeof (additional as Record<string, unknown>).raw_text === "string"
        ? ((additional as Record<string, unknown>).raw_text as string)
        : JSON.stringify(additional);

    return {
      raw_text: `${originalRaw}\n\n${additionalRaw}`.trim(),
      ai_provider:
        (typeof original === "object" &&
        original !== null &&
        "ai_provider" in original
          ? ((original as Record<string, unknown>).ai_provider as string | undefined)
          : undefined) ??
        (typeof additional === "object" &&
        additional !== null &&
        "ai_provider" in additional
          ? ((additional as Record<string, unknown>).ai_provider as string | undefined)
          : undefined),
    };
  }
}

/**
 * Main function to analyze a book with multi-pass approach
 */
export async function analyzeBookWithMultiPass(
  text: string,
  title: string,
  author?: string,
  locations?: Array<{
    start: number;
    end: number;
    page?: number;
    line?: number;
    chapter?: string;
  }>,
  model?: string
): Promise<AnalysisResult> {
  const analyzer = new MultiPassBookAnalyzer(text, title, author, locations, model);
  return await analyzer.analyze();
}
