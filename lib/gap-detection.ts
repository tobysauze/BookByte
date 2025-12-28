import { z } from "zod";
import type { SummaryPayload } from "@/lib/schemas";
import { summarySchema } from "@/lib/schemas";

// Type guard for structured summaries
function isStructuredSummary(summary: SummaryPayload): summary is z.infer<typeof summarySchema> {
  return summary && typeof summary === 'object' && 'quick_summary' in summary && typeof (summary as Record<string, unknown>).quick_summary === 'string';
}

export type GapType = 
  | "missing_chapter"
  | "shallow_chapter"
  | "missing_key_idea"
  | "shallow_key_idea"
  | "missing_insight"
  | "missing_quote"
  | "shallow_summary";

export type Gap = {
  id: string;
  type: GapType;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  section: string;
  currentValue?: string;
  suggestedLength?: number;
  bookContext?: string; // Relevant book passages for enhancement
};

export type GapReport = {
  totalGaps: number;
  gapsBySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  gaps: Gap[];
  recommendations: string[];
  estimatedEnhancementTime: number; // in minutes
};

/**
 * Analyzes book structure and compares with current summary to identify gaps
 */
export function detectGaps(
  bookText: string,
  currentSummary: SummaryPayload,
  bookTitle?: string,
  bookAuthor?: string
): GapReport {
  const gaps: Gap[] = [];

  // Extract book structure
  const bookStructure = extractBookStructure(bookText, bookTitle);
  
  // Ensure summary is structured
  if (!isStructuredSummary(currentSummary)) {
    // For raw text summaries, return empty gap report
    return {
      totalGaps: 0,
      gapsBySeverity: { high: 0, medium: 0, low: 0 },
      gaps: [],
      recommendations: ["Summary is in raw text format. Gap detection requires structured format."],
      estimatedEnhancementTime: 0,
    };
  }
  
  // Check for missing or shallow chapters
  const chapterGaps = detectChapterGaps(
    bookStructure,
    currentSummary.chapters || [],
    bookText
  );
  gaps.push(...chapterGaps);

  // Check for missing or shallow key ideas
  const keyIdeaGaps = detectKeyIdeaGaps(
    bookText,
    currentSummary.key_ideas || []
  );
  gaps.push(...keyIdeaGaps);

  // Check for missing actionable insights
  const insightGaps = detectInsightGaps(
    bookText,
    currentSummary.actionable_insights || []
  );
  gaps.push(...insightGaps);

  // Check for missing quotes
  const quoteGaps = detectQuoteGaps(
    bookText,
    currentSummary.quotes || []
  );
  gaps.push(...quoteGaps);

  // Check if quick summary is shallow
  const summaryGaps = detectSummaryGaps(
    bookText,
    currentSummary.quick_summary
  );
  gaps.push(...summaryGaps);

  // Calculate severity distribution
  const gapsBySeverity = {
    high: gaps.filter(g => g.severity === "high").length,
    medium: gaps.filter(g => g.severity === "medium").length,
    low: gaps.filter(g => g.severity === "low").length,
  };

  // Generate recommendations
  const recommendations = generateRecommendations(gaps, gapsBySeverity);

  // Estimate enhancement time (rough estimate: 2-3 minutes per gap)
  const estimatedEnhancementTime = Math.ceil(
    gaps.length * 2.5 + gapsBySeverity.high * 1.5
  );

  return {
    totalGaps: gaps.length,
    gapsBySeverity,
    gaps,
    recommendations,
    estimatedEnhancementTime,
  };
}

function extractBookStructure(bookText: string, bookTitle?: string): {
  chapters: Array<{ title: string; startIndex: number; endIndex: number }>;
  estimatedWordCount: number;
} {
  const chapters: Array<{ title: string; startIndex: number; endIndex: number }> = [];
  
  // Pattern matching for chapter titles
  const chapterPatterns = [
    /^Chapter\s+\d+[:\s]+(.+)$/im,
    /^(Chapter\s+\d+)$/im,
    /^Part\s+\d+[:\s]+(.+)$/im,
    /^\d+\.\s+(.+)$/im, // Numbered sections
  ];

  const lines = bookText.split('\n');
  let currentChapterStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    for (const pattern of chapterPatterns) {
      const match = line.match(pattern);
      if (match && line.length < 200) { // Chapter titles are usually short
        if (chapters.length > 0) {
          chapters[chapters.length - 1].endIndex = i;
        }
        chapters.push({
          title: match[1] || match[0],
          startIndex: i,
          endIndex: lines.length,
        });
        currentChapterStart = i;
        break;
      }
    }
  }

  // If no chapters found, estimate based on text length
  if (chapters.length === 0) {
    const wordCount = bookText.split(/\s+/).length;
    const estimatedChapters = Math.max(1, Math.floor(wordCount / 3000)); // Rough estimate: 3000 words per chapter
    
    for (let i = 0; i < estimatedChapters; i++) {
      const startIndex = Math.floor((i / estimatedChapters) * lines.length);
      const endIndex = Math.floor(((i + 1) / estimatedChapters) * lines.length);
      chapters.push({
        title: `Section ${i + 1}`,
        startIndex,
        endIndex,
      });
    }
  }

  return {
    chapters,
    estimatedWordCount: bookText.split(/\s+/).length,
  };
}

function detectChapterGaps(
  bookStructure: { chapters: Array<{ title: string; startIndex: number; endIndex: number }> },
  currentChapters: Array<{ title: string; summary: string }>,
  bookText?: string
): Gap[] {
  const gaps: Gap[] = [];
  const currentChapterTitles = currentChapters.map(c => c.title.toLowerCase());

  // Check for missing chapters
  bookStructure.chapters.forEach((bookChapter, index) => {
    const normalizedTitle = bookChapter.title.toLowerCase();
    const exists = currentChapterTitles.some(
      ct => ct.includes(normalizedTitle) || normalizedTitle.includes(ct)
    );

    if (!exists) {
      let chapterText = "";
      if (bookText) {
        const extracted = extractChapterText(bookText, bookChapter.startIndex, bookChapter.endIndex);
        // Use more context (up to 15000 chars) for better enhancement
        chapterText = extracted || bookText.substring(0, 15000);
      }
      
      gaps.push({
        id: `missing-chapter-${index}`,
        type: "missing_chapter",
        severity: "high",
        title: `Missing Chapter: ${bookChapter.title}`,
        description: `This chapter appears in the book but is not included in the summary.`,
        section: "chapters",
        bookContext: chapterText.substring(0, 15000), // More context for better enhancement
      });
    }
  });

  // Check for shallow chapters (less than 500 characters)
  currentChapters.forEach((chapter, index) => {
    if (chapter.summary.length < 500) {
      gaps.push({
        id: `shallow-chapter-${index}`,
        type: "shallow_chapter",
        severity: chapter.summary.length < 200 ? "high" : "medium",
        title: `Shallow Chapter: ${chapter.title}`,
        description: `This chapter summary is very brief (${chapter.summary.length} characters). Consider adding more detail.`,
        section: "chapters",
        currentValue: chapter.summary,
        suggestedLength: 1500,
      });
    }
  });

  return gaps;
}

function detectKeyIdeaGaps(
  bookText: string,
  currentKeyIdeas: Array<{ title: string; text: string }>
): Gap[] {
  const gaps: Gap[] = [];

  // Estimate expected number of key ideas based on book length
  const wordCount = bookText.split(/\s+/).length;
  const expectedKeyIdeas = Math.max(3, Math.min(15, Math.floor(wordCount / 5000)));
  
  if (currentKeyIdeas.length < expectedKeyIdeas) {
    const missingCount = expectedKeyIdeas - currentKeyIdeas.length;
    for (let i = 0; i < missingCount; i++) {
      gaps.push({
        id: `missing-key-idea-${i}`,
        type: "missing_key_idea",
        severity: missingCount > 3 ? "high" : "medium",
        title: `Missing Key Idea`,
        description: `Based on book length, there should be more key ideas.`,
        section: "key_ideas",
      });
    }
  }

  // Check for shallow key ideas (less than 800 characters)
  currentKeyIdeas.forEach((idea, index) => {
    if (idea.text.length < 800) {
      gaps.push({
        id: `shallow-key-idea-${index}`,
        type: "shallow_key_idea",
        severity: idea.text.length < 400 ? "high" : "medium",
        title: `Shallow Key Idea: ${idea.title}`,
        description: `This key idea needs more detail (${idea.text.length} characters).`,
        section: "key_ideas",
        currentValue: idea.text,
        suggestedLength: 1200,
      });
    }
  });

  return gaps;
}

function detectInsightGaps(
  bookText: string,
  currentInsights: string[]
): Gap[] {
  const gaps: Gap[] = [];
  const wordCount = bookText.split(/\s+/).length;
  const expectedInsights = Math.max(3, Math.min(10, Math.floor(wordCount / 5000)));

  if (currentInsights.length < expectedInsights) {
    const missingCount = expectedInsights - currentInsights.length;
    for (let i = 0; i < missingCount; i++) {
      gaps.push({
        id: `missing-insight-${i}`,
        type: "missing_insight",
        severity: missingCount > 3 ? "medium" : "low",
        title: `Missing Actionable Insight`,
        description: `Could add more actionable insights based on book content.`,
        section: "actionable_insights",
      });
    }
  }

  return gaps;
}

function detectQuoteGaps(
  bookText: string,
  currentQuotes: string[]
): Gap[] {
  const gaps: Gap[] = [];
  
  // Detect potential quotes in the text (text in quotes, commonly quoted phrases)
  const quotePatterns = [
    /"[^"]{20,200}"/g,
    /'[^']{20,200}'/g,
  ];

  const potentialQuotes: string[] = [];
  quotePatterns.forEach(pattern => {
    const matches = bookText.match(pattern);
    if (matches) {
      potentialQuotes.push(...matches.slice(0, 10)); // Limit to 10
    }
  });

  const expectedQuotes = Math.max(3, Math.min(potentialQuotes.length, 10));

  if (currentQuotes.length < expectedQuotes) {
    const missingCount = expectedQuotes - currentQuotes.length;
    for (let i = 0; i < missingCount; i++) {
      gaps.push({
        id: `missing-quote-${i}`,
        type: "missing_quote",
        severity: "low",
        title: `Missing Quote`,
        description: `Could add more memorable quotes from the book.`,
        section: "quotes",
      });
    }
  }

  return gaps;
}

function detectSummaryGaps(
  bookText: string,
  currentSummary: string
): Gap[] {
  const gaps: Gap[] = [];
  const wordCount = bookText.split(/\s+/).length;
  
  // For a comprehensive summary, we expect at least 500 words for a substantial book
  const expectedSummaryLength = Math.max(500, Math.min(3000, wordCount / 10));
  
  if (currentSummary.length < expectedSummaryLength * 5) { // Rough estimate: 5 chars per word
    gaps.push({
      id: "shallow-summary",
      type: "shallow_summary",
      severity: currentSummary.length < expectedSummaryLength * 3 ? "high" : "medium",
      title: "Quick Summary Could Be More Comprehensive",
      description: `The quick summary is shorter than expected for a book of this length.`,
      section: "quick_summary",
      currentValue: currentSummary,
      suggestedLength: expectedSummaryLength * 5,
    });
  }

  return gaps;
}

function extractChapterText(bookText: string, startIndex: number, endIndex: number): string {
  const lines = bookText.split('\n');
  const chapterLines = lines.slice(startIndex, endIndex);
  return chapterLines.join('\n');
}

function generateRecommendations(
  gaps: Gap[],
  gapsBySeverity: { high: number; medium: number; low: number }
): string[] {
  const recommendations: string[] = [];

  if (gapsBySeverity.high > 0) {
    recommendations.push(
      `Priority: ${gapsBySeverity.high} high-priority gaps should be addressed first.`
    );
  }

  const missingChapters = gaps.filter(g => g.type === "missing_chapter").length;
  if (missingChapters > 0) {
    recommendations.push(
      `Found ${missingChapters} missing chapters. Consider adding these for completeness.`
    );
  }

  const shallowChapters = gaps.filter(g => g.type === "shallow_chapter").length;
  if (shallowChapters > 0) {
    recommendations.push(
      `${shallowChapters} chapters could use more detail. Enhancing these will improve the summary quality.`
    );
  }

  if (gaps.length === 0) {
    recommendations.push("Summary looks comprehensive! No major gaps detected.");
  }

  return recommendations;
}

