import OpenAI from "openai";

import { summarySchema, type SummaryPayload } from "@/lib/schemas";

const { OPENAI_API_KEY, OPENAI_SUMMARY_MODEL } = process.env;

const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

export const SUMMARY_SYSTEM_PROMPT = `You are BookByte — an advanced AI trained to produce EXTREMELY comprehensive, in-depth book summaries that take AT LEAST 30 minutes to read thoroughly. Think of this as creating a detailed study guide, comprehensive book analysis, or even a condensed version of the book itself.

You are analyzing a full non-fiction book in the domains of self-improvement, health, finance, business, psychology, productivity, or science.

CRITICAL LENGTH REQUIREMENT: Your summary MUST be AT LEAST 5,000 words long (ideally much longer). This is a MINIMUM requirement. The entire summary should take the average reader AT LEAST 30 minutes to read. Aim for comprehensive depth, not brevity.

Your goal is to write an EXTENSIVE, detailed educational summary that:
- Captures EVERY major idea, sub-idea, nuance, and detail from the book
- Explains both **principles** (core truths) and **tactics** (how to apply them) in extensive detail with multiple examples
- Provides **numerous real-world examples** and case studies for each principle (at least 3-5 examples per major idea)
- Includes **detailed explanations** of complex concepts with analogies, metaphors, and step-by-step breakdowns
- Expands on each idea with context, background information, and implications
- Organizes ideas with clear headings, subheadings, bullet lists, and numbered steps
- Reads like a comprehensive study guide or detailed book analysis — thorough, educational, and practical
- Takes AT LEAST 30 minutes to read for the average reader (approximately 250 words per minute reading speed)

LENGTH GUIDELINES FOR EACH SECTION:
- "quick_summary": Should be AT LEAST 1,000 words (8-12 paragraphs minimum) with extensive detail, multiple examples, and comprehensive coverage
- "key_ideas": Each key idea should be AT LEAST 800-1,200 words (15-20 paragraphs minimum). Include extensive explanations, multiple examples, case studies, implementation guides, and detailed analysis
- "chapters": Each chapter summary should be AT LEAST 1,000-1,500 words (20-30 paragraphs minimum). Provide comprehensive breakdowns, extensive examples, detailed analysis, and thorough coverage
- "actionable_insights": Each insight should be AT LEAST 200-300 words with detailed step-by-step instructions, multiple implementation strategies, examples, and comprehensive guidance
- "quotes": Each quote should include extensive context (100-200 words) explaining why it matters, how it applies, and its significance

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
  "quick_summary": "EXTENSIVE executive overview (AT LEAST 1,000 words, 8-12+ paragraphs) with comprehensive coverage, multiple examples, detailed explanations, and thorough analysis",
  "key_ideas": [
    {
      "title": "Detailed Principle Name",
      "text": "EXTENSIVE explanation (AT LEAST 800-1,200 words, 15-20+ paragraphs) including: detailed principles, extensive tactics, multiple real-world examples (3-5+ per idea), case studies, step-by-step implementation guides, common pitfalls to avoid, troubleshooting tips, and how this connects to other ideas in the book"
    }
  ],
  "chapters": [
    {
      "title": "Chapter/Section Title",
      "summary": "COMPREHENSIVE breakdown (AT LEAST 1,000-1,500 words, 20-30+ paragraphs) including: detailed principles, extensive tactics, numerous examples, key quotes with extensive analysis, implementation strategies, related concepts, practical applications, case studies, and thorough coverage"
    }
  ],
  "actionable_insights": [
    "EXTENSIVE step-by-step action items (200-300+ words each) with specific instructions, detailed timelines, success metrics, multiple implementation strategies, examples, troubleshooting guides, and comprehensive guidance"
  ],
  "quotes": [
    "Most powerful and memorable quotes with EXTENSIVE context and analysis (100-200+ words per quote), INCLUDING Harvard-style citations with page/line numbers, detailed explanations of why each quote matters, how it applies to real life, and connections to specific principles"
  ]
}

Style: Write like a comprehensive study guide or detailed book analysis. Be EXTREMELY thorough, educational, and practical. Use multiple examples (3-5+ per major point), detailed explanations, extensive step-by-step guidance, and comprehensive coverage. Aim for MAXIMUM depth and detail. Include specific, actionable advice that readers can immediately implement. Remember: AT LEAST 5,000 words total. More is better.`;

const SUMMARY_MODEL = OPENAI_SUMMARY_MODEL ?? "gpt-4o";

export type GenerateSummaryParams = {
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

export async function generateStructuredSummary({
  text,
  title,
  author,
  signal,
  publicationYear,
  locations,
}: GenerateSummaryParams): Promise<SummaryPayload> {
  if (!client) {
    throw new Error("OpenAI client is not configured. Set OPENAI_API_KEY.");
  }

  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("No text content extracted from the provided file.");
  }

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

  const completion = await client.chat.completions.create({
    model: SUMMARY_MODEL,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: SUMMARY_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          title ? `Title: ${title}` : "",
          author ? `Author: ${author}` : "",
          publicationYear ? `Publication Year: ${publicationYear}` : "",
          ...citationInstructions,
          "Summarize the following book content:",
          trimmed,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    // No max_completion_tokens limit - use API default maximum
  }, {
    signal,
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI did not return any summary content.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse OpenAI response", error, content);
    throw new Error("Unable to parse summary response from OpenAI.");
  }

  // Add AI provider information
  if (parsed && typeof parsed === 'object') {
    (parsed as Record<string, unknown>).ai_provider = 'OpenAI GPT-4o';
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

