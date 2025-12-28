import { GoogleGenerativeAI } from "@google/generative-ai";

// Use the same detailed prompt as OpenAI for consistency
const GEMINI_SYSTEM_PROMPT = `You are BookByte — an advanced AI trained to produce comprehensive, in-depth book summaries that take 20+ minutes to read thoroughly. Think of this as creating a detailed study guide or comprehensive book analysis.

You are analyzing a full non-fiction book in the domains of self-improvement, health, finance, business, psychology, productivity, or science.

Your goal is to write an EXTENSIVE, detailed educational summary that:
- Captures EVERY major idea, sub-idea, and nuance from the book
- Explains both **principles** (core truths) and **tactics** (how to apply them) in great detail
- Provides **multiple real-world examples** and case studies for each principle
- Includes **detailed explanations** of complex concepts with analogies and metaphors
- Organizes ideas with clear headings, subheadings, bullet lists, and numbered steps
- Reads like a comprehensive study guide — thorough, educational, and practical
- Aims for 20+ minutes of reading time for the average reader

CRITICAL: The short_summary must be EXACTLY 1-2 sentences and NO MORE than 200 characters total. Count your characters carefully!

CITATION REQUIREMENTS:
- When including direct quotes from the book text, you MUST cite them using Harvard referencing style
- Format: (Author, Year, p. XX) for single pages or (Author, Year, pp. XX-YY) for multiple pages
- For EPUB/line-numbered sources: (Author, Year, line XX) or (Author, Year, lines XX-YY)
- For chapter-based sources: (Author, Year, Chapter: Chapter Name)
- Use the current year if publication year is not provided
- Example: "The key to success is consistency" (Smith, 2024, p. 15)
- Example for multi-page: "This principle applies across all domains" (Smith, 2024, pp. 15-16)
- Example for lines: "Remember this important detail" (Smith, 2024, line 120)
- IMPORTANT: Only cite direct quotes that appear verbatim in the original text. Do not cite paraphrased content.

Return the summary in this JSON structure:
{
  "short_summary": "A concise 1-2 sentence summary (MAX 200 characters) that captures the book's main value proposition and key benefit for readers",
  "quick_summary": "Comprehensive 3-4 paragraph executive overview with 8-12 key takeaways, including specific examples and actionable insights",
  "key_ideas": [
    {
      "title": "Detailed Principle Name",
      "text": "EXTENSIVE explanation (8-12 paragraphs) including: principles, tactics, multiple real-world examples, case studies, step-by-step implementation guides, common pitfalls to avoid, and how this connects to other ideas in the book"
    }
  ],
  "chapters": [
    {
      "title": "Chapter/Section Title",
      "summary": "COMPREHENSIVE breakdown (10-15 paragraphs) including: detailed principles, multiple tactics, extensive examples, key quotes with analysis, implementation strategies, related concepts, and practical applications"
    }
  ],
  "actionable_insights": [
    "Detailed step-by-step action items with specific instructions, timelines, and success metrics",
    "Multiple implementation strategies for different situations",
    "Common mistakes to avoid and how to overcome them",
    "How to measure progress and adjust your approach"
  ],
  "quotes": [
    "Most powerful and memorable quotes with detailed context and analysis, INCLUDING Harvard-style citations with page/line numbers",
    "Format: 'Quote text here' (Author Last Name, Year, p. XX) or (Author Last Name, Year, line XX) or (Author Last Name, Year, Chapter: Chapter Name)",
    "Include why each quote matters and how it applies to real life",
    "Connect quotes to specific principles and actionable insights",
    "ALL quotes must include proper citations"
  ]
}

Style: Write like a comprehensive study guide or detailed book analysis. Be thorough, educational, and practical. Use multiple examples, detailed explanations, and step-by-step guidance. Aim for depth over brevity. Include specific, actionable advice that readers can immediately implement.`;
import { summarySchema, type SummaryPayload } from "@/lib/schemas";

const { GEMINI_API_KEY, GEMINI_SUMMARY_MODEL } = process.env;

const GEMINI_MODEL = GEMINI_SUMMARY_MODEL ?? "gemini-2.5-pro";

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export const isGeminiConfigured = Boolean(client);

export type GenerateGeminiSummaryParams = {
  text: string;
  title?: string;
  author?: string;
  signal?: AbortSignal;
  publicationYear?: number;
  locations?: Array<{
    start: number;
    end: number;
    page?: number;
    line?: number;
    chapter?: string;
  }>;
};

export async function generateGeminiSummary({
  text,
  title,
  author,
  signal,
  publicationYear,
  locations,
}: GenerateGeminiSummaryParams): Promise<SummaryPayload> {
  if (!client) {
    throw new Error("Gemini client is not configured. Set GEMINI_API_KEY.");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No text content extracted from the provided file.");
  }

  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: {
      role: "system",
      parts: [{ text: GEMINI_SYSTEM_PROMPT }],
    },
  });

  // Build citation instructions
  const citationInstructions = [];
  if (author) {
    const year = publicationYear || new Date().getFullYear();
    citationInstructions.push(`\n\nCITATION GUIDELINES:`);
    citationInstructions.push(`- Author: ${author}`);
    citationInstructions.push(`- Year: ${year}`);
    if (locations && locations.length > 0) {
      const hasPages = locations.some(loc => loc.page);
      const hasLines = locations.some(loc => loc.line);
      const hasChapters = locations.some(loc => loc.chapter);
      
      if (hasPages) {
        citationInstructions.push(`- This book has page numbers. Use format: (${author.split(' ').pop()}, ${year}, p. XX) for single pages or (${author.split(' ').pop()}, ${year}, pp. XX-YY) for multiple pages`);
      } else if (hasLines) {
        citationInstructions.push(`- This book uses line numbers. Use format: (${author.split(' ').pop()}, ${year}, line XX) for single lines or (${author.split(' ').pop()}, ${year}, lines XX-YY) for multiple lines`);
      } else if (hasChapters) {
        citationInstructions.push(`- This book uses chapters. Use format: (${author.split(' ').pop()}, ${year}, Chapter: Chapter Name)`);
      }
    }
    citationInstructions.push(`- For any direct quote, append the citation immediately after the quote`);
    citationInstructions.push(`- Example: "Quote text here" (${author.split(' ').pop()}, ${year}, p. 15)`);
  }

  const promptSections = [
    title ? `Title: ${title}` : "",
    author ? `Author: ${author}` : "",
    publicationYear ? `Publication Year: ${publicationYear}` : "",
    ...citationInstructions,
    "Summarize the following book content:",
    trimmed,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: promptSections }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      responseMimeType: "application/json",
    },
    safetySettings: [],
    // @google/generative-ai doesn't accept AbortSignal directly; if provided, race it
  });

  if (signal?.aborted) {
    throw new Error("Gemini summary was aborted.");
  }

  const textResponse = result.response.text();

  if (!textResponse) {
    throw new Error("Gemini did not return any summary content.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(textResponse);
  } catch (error) {
    console.error("Failed to parse Gemini response", error, textResponse);
    throw new Error("Unable to parse summary response from Gemini.");
  }

  // Handle different quote formats from Gemini
  if (parsed && typeof parsed === 'object' && 'quotes' in parsed) {
    const parsedObj = parsed as Record<string, unknown>;
    const quotes = parsedObj.quotes;
    if (Array.isArray(quotes)) {
      parsedObj.quotes = quotes.map(quote => {
        if (typeof quote === 'string') {
          return quote;
        } else if (typeof quote === 'object' && quote !== null) {
          // Try different possible properties
          const quoteObj = quote as Record<string, unknown>;
          return quoteObj.text || quoteObj.quote || quoteObj.content || String(quote);
        }
        return String(quote);
      });
    }
  }

  // Handle different actionable_insights formats from Gemini
  if (parsed && typeof parsed === 'object' && 'actionable_insights' in parsed) {
    const parsedObj = parsed as Record<string, unknown>;
    const insights = parsedObj.actionable_insights;
    if (Array.isArray(insights)) {
      parsedObj.actionable_insights = insights.map(insight => {
        if (typeof insight === 'string') {
          return insight;
        } else if (typeof insight === 'object' && insight !== null) {
          // Try different possible properties
          const insightObj = insight as Record<string, unknown>;
          return insightObj.text || insightObj.insight || insightObj.content || String(insight);
        }
        return String(insight);
      });
    }
  }

  // Add AI provider information
  if (parsed && typeof parsed === 'object') {
    (parsed as Record<string, unknown>).ai_provider = 'Google Gemini 2.5 Pro';
  }

  // Safety check: truncate short_summary if it's too long
  if (parsed && typeof parsed === 'object' && 'short_summary' in parsed) {
    const shortSummary = (parsed as Record<string, unknown>).short_summary;
    if (typeof shortSummary === 'string' && shortSummary.length > 200) {
      (parsed as Record<string, unknown>).short_summary = shortSummary.substring(0, 197) + '...';
    }
  }

  return summarySchema.parse(parsed);
}

