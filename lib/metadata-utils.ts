export function calculateBookMetadata(summary: unknown): {
  word_count: number;
  description: string;
  category: string;
} {
  const isObject = typeof summary === "object" && summary !== null;
  const summaryObj = (isObject ? summary : {}) as Record<string, unknown>;

  const rawText =
    typeof summaryObj.raw_text === "string" ? summaryObj.raw_text : null;
  const quickSummary =
    typeof summaryObj.quick_summary === "string" ? summaryObj.quick_summary : "";
  const shortSummary =
    typeof summaryObj.short_summary === "string" ? summaryObj.short_summary : "";

  // 1. Determine Description
  let description = "No description available.";
  if (shortSummary.length > 0) {
    description = shortSummary;
  } else if (quickSummary.length > 0) {
    description =
      quickSummary.substring(0, 200) + (quickSummary.length > 200 ? "..." : "");
  } else if (rawText && rawText.length > 0) {
    description =
      rawText.substring(0, 200) + (rawText.length > 200 ? "..." : "");
  }

  // 2. Determine Word Count
  // Prefer raw_text if present; otherwise estimate from quick_summary.
  const word_count = rawText
    ? rawText.trim().split(/\s+/).filter(Boolean).length
    : quickSummary.trim().split(/\s+/).filter(Boolean).length;

  // 3. Determine Category
  const textToAnalyze = (rawText || quickSummary || "").toLowerCase();
  let category = "Non-Fiction";

  if (
    textToAnalyze.includes("psychology") ||
    textToAnalyze.includes("mind") ||
    textToAnalyze.includes("consciousness")
  ) {
    category = "Psychology";
  } else if (
    textToAnalyze.includes("leadership") ||
    textToAnalyze.includes("management") ||
    textToAnalyze.includes("business")
  ) {
    category = "Management/Leadership";
  } else if (
    textToAnalyze.includes("productivity") ||
    textToAnalyze.includes("workflow")
  ) {
    category = "Productivity";
  } else if (
    textToAnalyze.includes("self-help") ||
    textToAnalyze.includes("personal development")
  ) {
    category = "Self-Help";
  }

  // IMPORTANT: these keys must match DB columns (snake_case).
  return { word_count, description, category };
}
