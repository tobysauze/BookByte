import { summarySchema, type SummaryPayload } from "@/lib/schemas";

const { OPENROUTER_API_KEY, OPENROUTER_MODEL } = process.env;

export const SUMMARY_SYSTEM_PROMPT = `You are BookByte — an advanced AI trained to produce EXTREMELY comprehensive, in-depth book summaries that take AT LEAST 30 minutes to read thoroughly.

You are analyzing a full non-fiction book in the domains of self-improvement, health, finance, business, psychology, productivity, or science.

CRITICAL LENGTH REQUIREMENT: Your summary MUST be AT LEAST 10,000 words long (ideally 12,000-15,000 words). This is a MINIMUM requirement. The entire summary should take the average reader AT LEAST 30 minutes to read. Aim for comprehensive depth, not brevity.

Your goal is to write an EXTENSIVE, detailed educational summary as continuous prose that:
- Captures EVERY major idea, sub-idea, nuance, and detail from the book
- Explains both **principles** (core truths) and **tactics** (how to apply them) in extensive detail with multiple examples
- Provides **numerous real-world examples** and case studies for each principle (at least 5-7 examples per major idea)
- Includes **detailed explanations** of complex concepts with analogies, metaphors, and step-by-step breakdowns
- Expands on each idea with context, background information, and implications
- Reads like a comprehensive study guide or detailed book analysis — thorough, educational, and practical
- Takes AT LEAST 30 minutes to read for the average reader (approximately 250 words per minute reading speed)

When including direct quotes from the book text, you MUST cite them using Harvard referencing style:
- Format: (Author, Year, p. XX) for single pages or (Author, Year, pp. XX-YY) for multiple pages
- For EPUB/line-numbered sources: (Author, Year, line XX) or (Author, Year, lines XX-YY)
- For chapter-based sources: (Author, Year, Chapter: Chapter Name)
- Use the current year if publication year is not provided
- Example: "The key to success is consistency" (Smith, 2024, p. 15)
- IMPORTANT: Only cite direct quotes that appear verbatim in the original text. Do not cite paraphrased content.

Write your summary as continuous, flowing prose. Organize it however makes the most sense - you may use headings, paragraphs, lists, or any structure that best presents the information. The goal is a comprehensive, detailed summary that is at least 10,000 words long.

Do NOT return JSON. Do NOT structure it into predefined sections. Simply write a comprehensive, detailed summary of the book in whatever format and structure you think best presents the information.`;

// Default model - can be overridden via environment variable
const DEFAULT_MODEL = OPENROUTER_MODEL || "openai/gpt-4o";

// Minimum word count target
const MIN_WORD_COUNT = 10000;

/**
 * Count words in a summary
 */
function countSummaryWords(summary: SummaryPayload): number {
  // Check if this is raw text format (new format)
  if (summary && typeof summary === 'object' && 'raw_text' in summary && typeof (summary as Record<string, unknown>).raw_text === 'string') {
    const rawText = (summary as { raw_text: string }).raw_text;
    return rawText.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  let wordCount = 0;
  
  // Count words in quick_summary
  if (summary.quick_summary && typeof summary.quick_summary === 'string') {
    wordCount += summary.quick_summary.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  // Count words in key_ideas (title + text)
  if (summary.key_ideas && Array.isArray(summary.key_ideas)) {
    summary.key_ideas.forEach((idea: any) => {
      if (idea.title && typeof idea.title === 'string') {
        wordCount += idea.title.split(/\s+/).filter(word => word.length > 0).length;
      }
      if (idea.text && typeof idea.text === 'string') {
        wordCount += idea.text.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }
  
  // Count words in chapters (title + summary)
  if (summary.chapters && Array.isArray(summary.chapters)) {
    summary.chapters.forEach((chapter: any) => {
      if (chapter.title && typeof chapter.title === 'string') {
        wordCount += chapter.title.split(/\s+/).filter(word => word.length > 0).length;
      }
      if (chapter.summary && typeof chapter.summary === 'string') {
        wordCount += chapter.summary.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }
  
  // Count words in actionable_insights
  if (summary.actionable_insights && Array.isArray(summary.actionable_insights)) {
    summary.actionable_insights.forEach((insight: any) => {
      if (typeof insight === 'string') {
        wordCount += insight.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }
  
  // Count words in quotes
  if (summary.quotes && Array.isArray(summary.quotes)) {
    summary.quotes.forEach((quote: any) => {
      if (typeof quote === 'string') {
        wordCount += quote.split(/\s+/).filter(word => word.length > 0).length;
      }
    });
  }
  
  // Count words in custom fields (for custom prompts)
  const standardKeys = ['short_summary', 'quick_summary', 'key_ideas', 'chapters', 'actionable_insights', 'quotes', 'ai_provider'];
  const customKeys = Object.keys(summary).filter(key => !standardKeys.includes(key));
  
  customKeys.forEach(key => {
    const value = (summary as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      wordCount += value.split(/\s+/).filter(word => word.length > 0).length;
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'string') {
          wordCount += item.split(/\s+/).filter(word => word.length > 0).length;
        }
      });
    }
  });
  
  return wordCount;
}

/**
 * Identify sections that need expansion
 */
function identifySectionsNeedingExpansion(summary: SummaryPayload, targetWordCount?: number): Array<{
  section: string;
  itemIndex?: number;
  currentWords: number;
  targetWords: number;
  content: string;
}> {
  const targetCount = targetWordCount || MIN_WORD_COUNT;
  
  // Calculate proportional targets based on the overall target
  // These are minimums - we'll scale them proportionally if needed
  const baseTargets = {
    quick_summary: 1500,
    key_ideas: 1200,
    chapters: 1500,
    actionable_insights: 400,
    quotes: 250,
  };
  
  // Scale targets proportionally if targetWordCount is different from MIN_WORD_COUNT
  const scaleFactor = targetCount / MIN_WORD_COUNT;
  const scaledTargets = {
    quick_summary: Math.round(baseTargets.quick_summary * scaleFactor),
    key_ideas: Math.round(baseTargets.key_ideas * scaleFactor),
    chapters: Math.round(baseTargets.chapters * scaleFactor),
    actionable_insights: Math.round(baseTargets.actionable_insights * scaleFactor),
    quotes: Math.round(baseTargets.quotes * scaleFactor),
  };
  
  const sectionsToExpand: Array<{
    section: string;
    itemIndex?: number;
    currentWords: number;
    targetWords: number;
    content: string;
  }> = [];
  
  // Check quick_summary
  if (summary.quick_summary && typeof summary.quick_summary === 'string') {
    const words = summary.quick_summary.split(/\s+/).filter(word => word.length > 0).length;
    if (words < scaledTargets.quick_summary) {
      sectionsToExpand.push({
        section: 'quick_summary',
        currentWords: words,
        targetWords: scaledTargets.quick_summary,
        content: summary.quick_summary,
      });
    }
  }
  
  // Check key_ideas
  if (summary.key_ideas && Array.isArray(summary.key_ideas)) {
    summary.key_ideas.forEach((idea: any, index: number) => {
      if (idea.text && typeof idea.text === 'string') {
        const words = idea.text.split(/\s+/).filter(word => word.length > 0).length;
        if (words < scaledTargets.key_ideas) {
          sectionsToExpand.push({
            section: 'key_ideas',
            itemIndex: index,
            currentWords: words,
            targetWords: scaledTargets.key_ideas,
            content: idea.text,
          });
        }
      }
    });
  }
  
  // Check chapters
  if (summary.chapters && Array.isArray(summary.chapters)) {
    summary.chapters.forEach((chapter: any, index: number) => {
      if (chapter.summary && typeof chapter.summary === 'string') {
        const words = chapter.summary.split(/\s+/).filter(word => word.length > 0).length;
        if (words < scaledTargets.chapters) {
          sectionsToExpand.push({
            section: 'chapters',
            itemIndex: index,
            currentWords: words,
            targetWords: scaledTargets.chapters,
            content: chapter.summary,
          });
        }
      }
    });
  }
  
  // Check actionable_insights
  if (summary.actionable_insights && Array.isArray(summary.actionable_insights)) {
    summary.actionable_insights.forEach((insight: any, index: number) => {
      if (typeof insight === 'string') {
        const words = insight.split(/\s+/).filter(word => word.length > 0).length;
        if (words < scaledTargets.actionable_insights) {
          sectionsToExpand.push({
            section: 'actionable_insights',
            itemIndex: index,
            currentWords: words,
            targetWords: scaledTargets.actionable_insights,
            content: insight,
          });
        }
      }
    });
  }
  
  // Check quotes
  if (summary.quotes && Array.isArray(summary.quotes)) {
    summary.quotes.forEach((quote: any, index: number) => {
      if (typeof quote === 'string') {
        const words = quote.split(/\s+/).filter(word => word.length > 0).length;
        if (words < scaledTargets.quotes) {
          sectionsToExpand.push({
            section: 'quotes',
            itemIndex: index,
            currentWords: words,
            targetWords: scaledTargets.quotes,
            content: quote,
          });
        }
      }
    });
  }
  
  // Sort by priority: shortest sections first (most urgent to expand)
  return sectionsToExpand.sort((a, b) => {
    const aRatio = a.currentWords / a.targetWords;
    const bRatio = b.currentWords / b.targetWords;
    return aRatio - bRatio;
  });
}

/**
 * Expand a specific section of the summary
 */
async function expandSection(
  summary: SummaryPayload,
  sectionToExpand: {
    section: string;
    itemIndex?: number;
    currentWords: number;
    targetWords: number;
    content: string;
  },
  originalText: string,
  title?: string,
  author?: string,
  model?: string,
): Promise<SummaryPayload> {
  const selectedModel = model || DEFAULT_MODEL;
  
  let expansionPrompt = '';
  let sectionDescription = '';
  
  switch (sectionToExpand.section) {
    case 'quick_summary':
      sectionDescription = 'quick summary';
      expansionPrompt = `Expand the quick summary section. Current length: ${sectionToExpand.currentWords} words. Target: ${sectionToExpand.targetWords} words minimum.

Add more detail, examples, case studies, and comprehensive analysis. Expand on key concepts, provide more context, and include additional real-world applications.`;
      break;
    case 'key_ideas':
      sectionDescription = `key idea "${(summary.key_ideas as any[])[sectionToExpand.itemIndex!]?.title || `idea ${sectionToExpand.itemIndex! + 1}`}"`;
      expansionPrompt = `Expand this key idea. Current length: ${sectionToExpand.currentWords} words. Target: ${sectionToExpand.targetWords} words minimum.

Add more detail, 5-7 real-world examples, detailed case studies, step-by-step implementation guides, common pitfalls, troubleshooting tips, and how this connects to other ideas in the book.`;
      break;
    case 'chapters':
      sectionDescription = `chapter "${(summary.chapters as any[])[sectionToExpand.itemIndex!]?.title || `chapter ${sectionToExpand.itemIndex! + 1}`}"`;
      expansionPrompt = `Expand this chapter summary. Current length: ${sectionToExpand.currentWords} words. Target: ${sectionToExpand.targetWords} words minimum.

Add more detail, extensive examples, key quotes with extensive context (200-300 words per quote), implementation strategies, related concepts, practical applications, case studies, and thorough coverage.`;
      break;
    case 'actionable_insights':
      sectionDescription = `actionable insight ${sectionToExpand.itemIndex! + 1}`;
      expansionPrompt = `Expand this actionable insight. Current length: ${sectionToExpand.currentWords} words. Target: ${sectionToExpand.targetWords} words minimum.

Add detailed step-by-step instructions, 3-5 different implementation strategies, examples, troubleshooting guides, success metrics, timelines, and comprehensive guidance.`;
      break;
    case 'quotes':
      sectionDescription = `quote ${sectionToExpand.itemIndex! + 1}`;
      expansionPrompt = `Expand the context and analysis for this quote. Current length: ${sectionToExpand.currentWords} words. Target: ${sectionToExpand.targetWords} words minimum.

Add extensive context explaining why it matters, how it applies, its significance, connections to principles, real-world applications, and detailed analysis.`;
      break;
  }
  
  const expansionMessage = `You are expanding the ${sectionDescription} from a book summary.

Current content (${sectionToExpand.currentWords} words):
${sectionToExpand.content}

${expansionPrompt}

${title ? `Book Title: ${title}` : ''}
${author ? `Book Author: ${author}` : ''}

Original book content (for reference):
${originalText.substring(0, 5000)}...

IMPORTANT: Return ONLY the expanded content. Do NOT return JSON, do NOT wrap it in markdown, do NOT add explanatory text. Return ONLY the expanded text content that should replace the current content.`;

  const requestBody: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
  } = {
    model: selectedModel,
    messages: [
      {
        role: 'user',
        content: expansionMessage,
      },
    ],
    temperature: 0.35,
  };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "BookByte",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const expandedContent = data.choices?.[0]?.message?.content?.trim();

    if (!expandedContent) {
      throw new Error("OpenRouter did not return expanded content.");
    }

    // Update the summary with expanded content
    const updatedSummary = { ...summary };
    
    switch (sectionToExpand.section) {
      case 'quick_summary':
        (updatedSummary as any).quick_summary = expandedContent;
        break;
      case 'key_ideas':
        if (Array.isArray(updatedSummary.key_ideas) && sectionToExpand.itemIndex !== undefined) {
          (updatedSummary.key_ideas as any[])[sectionToExpand.itemIndex].text = expandedContent;
        }
        break;
      case 'chapters':
        if (Array.isArray(updatedSummary.chapters) && sectionToExpand.itemIndex !== undefined) {
          (updatedSummary.chapters as any[])[sectionToExpand.itemIndex].summary = expandedContent;
        }
        break;
      case 'actionable_insights':
        if (Array.isArray(updatedSummary.actionable_insights) && sectionToExpand.itemIndex !== undefined) {
          (updatedSummary.actionable_insights as any[])[sectionToExpand.itemIndex] = expandedContent;
        }
        break;
      case 'quotes':
        if (Array.isArray(updatedSummary.quotes) && sectionToExpand.itemIndex !== undefined) {
          (updatedSummary.quotes as any[])[sectionToExpand.itemIndex] = expandedContent;
        }
        break;
    }
    
    return updatedSummary;
  } catch (error) {
    console.error(`Error expanding ${sectionDescription}:`, error);
    // Return original summary if expansion fails
    return summary;
  }
}

export const isOpenRouterConfigured = Boolean(OPENROUTER_API_KEY);

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
  model?: string; // Optional model override
  customPrompt?: string; // Optional custom prompt template
};

/**
 * Generate a summary using OpenRouter API
 */
export async function generateStructuredSummary({
  text,
  title,
  author,
  signal,
  publicationYear,
  locations,
  model,
  customPrompt,
}: GenerateSummaryParams): Promise<SummaryPayload> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key is not configured. Set OPENROUTER_API_KEY.");
  }

  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("No text content extracted from the provided file.");
  }

  // Use provided model or default
  const selectedModel = model || DEFAULT_MODEL;
  
  console.log(`[OpenRouter] Using model: ${selectedModel}`);

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

  // Build user content - ask for plain text output (no JSON)
  const textFormatInstruction = `

CRITICAL: Return your summary as continuous, flowing prose. Do NOT return JSON, do NOT structure it into predefined sections, do NOT use markdown code blocks. Simply write a comprehensive, detailed summary of the book in whatever format and structure you think best presents the information.`;

  const userContent = customPrompt 
    ? customPrompt + textFormatInstruction
    : [
        title ? `Title: ${title}` : "",
        author ? `Author: ${author}` : "",
        publicationYear ? `Publication Year: ${publicationYear}` : "",
        ...citationInstructions,
        "Summarize the following book content:",
        trimmed,
      ]
        .filter(Boolean)
        .join("\n\n");

  const messages = customPrompt
    ? [
        {
          role: "user" as const,
          content: userContent,
        },
      ]
    : [
        {
          role: "system" as const,
          content: SUMMARY_SYSTEM_PROMPT,
        },
        {
          role: "user" as const,
          content: userContent,
        },
      ];

  // Prepare request body - NO JSON mode, we want plain text
  const requestBody: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
  } = {
    model: selectedModel,
    messages,
    temperature: 0.35,
    // No response_format - we want plain text output
  };

  const controller = signal ? new AbortController() : null;
  if (signal) {
    signal.addEventListener("abort", () => controller?.abort());
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "BookByte",
      },
      body: JSON.stringify(requestBody),
      signal: controller?.signal || signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenRouter did not return any summary content.");
    }

    // Return raw text as a simple object structure
    // Store the raw text with AI provider info
    const finalSummary: SummaryPayload = {
      raw_text: content.trim(),
      ai_provider: `OpenRouter (${selectedModel})`,
    };
    
    console.log(`[OpenRouter] Summary generated. Length: ${content.length} characters`);
    
    return finalSummary;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Summary generation was aborted.");
    }
    throw error;
  }
}

/**
 * Expand a summary to meet the minimum word count target
 * This is a public function that can be called from API routes
 */
export async function expandSummaryToTarget(
  summary: SummaryPayload,
  originalText: string,
  title?: string,
  author?: string,
  model?: string,
  targetWordCount?: number,
): Promise<SummaryPayload> {
  const selectedModel = model || DEFAULT_MODEL;
  const currentWordCount = countSummaryWords(summary);
  const targetCount = targetWordCount || MIN_WORD_COUNT;
  
  console.log(`[OpenRouter] Expanding summary. Current word count: ${currentWordCount} words. Target: ${targetCount} words`);
  console.log(`[OpenRouter] Using model: ${selectedModel}${model ? ' (from original summary)' : ' (default)'}`);
  
  if (currentWordCount >= targetCount) {
    console.log(`[OpenRouter] Summary already meets word count requirement (${currentWordCount} >= ${targetCount})`);
    return summary;
  }
  
  // Check if this is raw text format (new format)
  const isRawText = summary && typeof summary === 'object' && 'raw_text' in summary && typeof (summary as Record<string, unknown>).raw_text === 'string';
  
  if (isRawText) {
    // For raw text format, expand the entire text directly
    console.log(`[OpenRouter] Expanding raw text summary. Current: ${currentWordCount} words. Target: ${targetCount} words`);
    
    const rawText = (summary as { raw_text: string; ai_provider?: string }).raw_text;
    const aiProvider = (summary as { raw_text: string; ai_provider?: string }).ai_provider || `OpenRouter (${selectedModel})`;
    
    // Build expansion prompt
    const expansionPrompt = `You are expanding a book summary. The current summary is ${currentWordCount} words long, but needs to be at least ${targetCount} words long.

Current summary:
${rawText}

Please expand this summary to be at least ${targetCount} words long. Add more detail, examples, explanations, and context. Maintain the same structure and style as the original summary. 

You may reference the original book content if needed:
${originalText.substring(0, 5000)}${originalText.length > 5000 ? '...' : ''}

CRITICAL: Return your expanded summary as continuous, flowing prose. Do NOT return JSON, do NOT structure it into predefined sections, do NOT use markdown code blocks. Simply write the expanded summary text.`;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          "X-Title": "BookByte",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: "user",
              content: expansionPrompt,
            },
          ],
          temperature: 0.35,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error?.message || `OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("OpenRouter did not return any expanded summary content.");
      }

      const expandedText = content.trim();
      const finalWordCount = expandedText.split(/\s+/).filter(word => word.length > 0).length;
      
      console.log(`[OpenRouter] Expansion complete. Final word count: ${finalWordCount} words (${finalWordCount - currentWordCount} words added)`);
      
      return {
        raw_text: expandedText,
        ai_provider: aiProvider,
      };
    } catch (error) {
      console.error(`[OpenRouter] Error expanding raw text summary:`, error);
      throw error;
    }
  }
  
  // For structured format, use the existing section-based expansion logic
  console.log(`[OpenRouter] Summary is ${targetCount - currentWordCount} words short. Starting expansion...`);
  
  // Identify sections that need expansion
  const sectionsToExpand = identifySectionsNeedingExpansion(summary, targetCount);
  console.log(`[OpenRouter] Found ${sectionsToExpand.length} sections needing expansion`);
  
  // Expand sections iteratively until we reach target or run out of sections
  let expandedSummary = summary;
  const maxExpansionAttempts = 15; // Limit to prevent excessive API calls
  let sectionsToProcess = [...sectionsToExpand]; // Copy array to modify
  
  for (let i = 0; i < maxExpansionAttempts; i++) {
    const currentCount = countSummaryWords(expandedSummary);
    if (currentCount >= targetCount) {
      console.log(`[OpenRouter] Target reached after ${i} expansion(s). Final word count: ${currentCount}`);
      break;
    }
    
    // If we've processed all sections, re-identify sections that still need expansion
    if (i >= sectionsToProcess.length) {
      const newSections = identifySectionsNeedingExpansion(expandedSummary, targetCount);
      if (newSections.length === 0) {
        console.log(`[OpenRouter] No more sections need expansion. Final word count: ${currentCount}`);
        break;
      }
      sectionsToProcess.push(...newSections.slice(0, 5)); // Add up to 5 more
    }
    
    const sectionToExpand = sectionsToProcess[i];
    if (!sectionToExpand) break;
    
    console.log(`[OpenRouter] Expanding ${sectionToExpand.section}${sectionToExpand.itemIndex !== undefined ? ` (item ${sectionToExpand.itemIndex + 1})` : ''}...`);
    
    try {
      expandedSummary = await expandSection(
        expandedSummary,
        sectionToExpand,
        originalText,
        title,
        author,
        selectedModel,
      );
      
      const newCount = countSummaryWords(expandedSummary);
      console.log(`[OpenRouter] After expansion: ${newCount} words (${newCount - currentCount} words added)`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[OpenRouter] Error expanding section:`, error);
      // Continue with next section if one fails
    }
  }
  
  const finalWordCount = countSummaryWords(expandedSummary);
  console.log(`[OpenRouter] Final summary word count: ${finalWordCount} words (${finalWordCount - currentWordCount} words added through expansion)`);
  
  return expandedSummary;
}

/**
 * Get available models from OpenRouter (for future UI model selection)
 */
export async function getAvailableModels(): Promise<string[]> {
  if (!OPENROUTER_API_KEY) {
    return [];
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data?.map((model: { id: string }) => model.id) || [];
  } catch (error) {
    console.error("Failed to fetch OpenRouter models:", error);
    return [];
  }
}

