import { z } from "zod";

export const summarySectionSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1).max(100000), // Allow very long detailed explanations for expanded summaries
});

export const chapterSummarySchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1).max(100000), // Allow very long detailed summaries for expanded summaries
});

export const summarySchema = z.object({
  ai_provider: z.string().optional(), // Track which AI generated the summary
  short_summary: z.string().min(20).max(200), // 1-2 sentence summary for book cards
  quick_summary: z.string().min(40).max(50000), // Allow very long executive summary for expanded summaries
  key_ideas: z.array(summarySectionSchema).min(3), // At least 3 key ideas
  chapters: z.array(chapterSummarySchema).min(1), // At least 1 chapter
  actionable_insights: z.array(z.string().min(1).max(50000)).min(3), // At least 3 actionable insights, allow very long
  quotes: z.array(z.string().min(1).max(50000)).min(3), // At least 3 quotes, allow very long
});

// Raw text schema - for storing plain text output from LLM
export const rawTextSummarySchema = z.object({
  raw_text: z.string().min(1), // The raw text output from the LLM
  ai_provider: z.string().optional(), // Track which AI generated the summary
});

// Flexible schema for custom prompts - accepts any JSON object structure
// This allows custom prompts to define their own output format
export const flexibleSummarySchema = z.record(z.unknown()).refine(
  (data) => typeof data === 'object' && !Array.isArray(data),
  {
    message: "Summary must be a JSON object",
  }
);

// SummaryPayload can be either the structured schema, raw text schema, or flexible (for custom prompts)
export type SummaryPayload = z.infer<typeof summarySchema> | z.infer<typeof rawTextSummarySchema> | Record<string, unknown>;

export const bookMetadataSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().optional(),
  coverUrl: z.string().url().optional(),
});

