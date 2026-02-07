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

  const sentenceBlurb = (text: string, maxSentences: number) => {
    const cleaned = text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!cleaned) return "";

    // Prefer the first paragraph (more likely to be coherent).
    const firstPara = cleaned.split(/\n{2,}/g)[0]?.trim() ?? cleaned;

    const sentences = firstPara
      .split(/(?<=[.!?])\s+/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const picked = sentences.slice(0, Math.max(1, Math.min(maxSentences, 4)));
    return picked.join(" ");
  };

  const deepDiveBlurb = (raw: string) => {
    const text = raw.replace(/\r\n/g, "\n");

    // Prefer an explicit card blurb block if present.
    const cardMatch = text.match(/\[CARD_BLURB\]\s*([\s\S]*?)\s*\[\/CARD_BLURB\]/i);
    if (cardMatch?.[1]) {
      return sentenceBlurb(cardMatch[1], 3);
    }

    // Try to extract "Core Thesis" chunk first (best summary-like section).
    const coreMatch = text.match(
      /(?:\*\*\s*)?Core Thesis(?:\s*\*\*)?\s*:?\s*([\s\S]*?)(?=\n\s*(?:Why This Book Matters|The Promised Transformation|Key Methodology|Who Should Read This|════════|PART\s+\d+\s*:))/i,
    );
    if (coreMatch?.[1]) {
      return sentenceBlurb(coreMatch[1], 3);
    }

    // Otherwise, try to extract content after "PART 1:"
    const part1Match = text.match(/PART\s+1\s*:[\s\S]*?\n([\s\S]*?)(?=\n\s*PART\s+2\s*:)/i);
    if (part1Match?.[1]) {
      return sentenceBlurb(part1Match[1], 3);
    }

    // Fallback to first coherent sentences from the whole text.
    return sentenceBlurb(text, 3);
  };

  // 1. Determine Description
  let description = "No description available.";
  if (shortSummary.length > 0) {
    description = shortSummary;
  } else if (quickSummary.length > 0) {
    description = sentenceBlurb(quickSummary, 3);
  } else if (rawText && rawText.length > 0) {
    // Deep-dive prompt outputs start with headings; extract a useful blurb instead.
    description = deepDiveBlurb(rawText);
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
