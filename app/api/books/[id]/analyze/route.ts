import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

import { extractTextFromFile } from "@/lib/pdf";
import { generateStructuredSummary } from "@/lib/openai";
import { generateGeminiSummary, isGeminiConfigured } from "@/lib/gemini";
import { analyzeBookWithMultiPass } from "@/lib/multi-pass-analysis";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { canEditBook } from "@/lib/user-roles";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { analysisType } = await request.json();

    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to analyze books." },
        { status: 401 },
      );
    }

    // Get the book details
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .single();

    if (bookError || !book) {
      return NextResponse.json(
        { error: "Book not found." },
        { status: 404 },
      );
    }

    // Check if user can analyze this book
    const canEdit = await canEditBook(book.user_id, book.is_public);
    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to analyze this book." },
        { status: 403 },
      );
    }

    // Check if we have a local file path
    if (!book.local_file_path) {
      return NextResponse.json(
        { error: "Original file not available for analysis." },
        { status: 400 },
      );
    }

    // Read the original file
    let originalText: string;
    try {
      const fileBuffer = await readFile(book.local_file_path);
      const file = new File([fileBuffer], book.title || "book", {
        type: getMimeTypeFromPath(book.local_file_path),
      });
      const extractedData = await extractTextFromFile(file);
      originalText = extractedData.text;
    } catch (fileError) {
      console.error("Error reading original file:", fileError);
      return NextResponse.json(
        { error: "Could not read the original file." },
        { status: 500 },
      );
    }

    if (!originalText.trim()) {
      return NextResponse.json(
        { error: "No readable text found in the original file." },
        { status: 400 },
      );
    }

    // Perform the requested analysis
    let analysisResult: any = {};

    switch (analysisType) {
      case "completeness":
        analysisResult = await performCompletenessAnalysis(originalText, book);
        break;
      case "comprehensive":
        analysisResult = await performComprehensiveAnalysis(originalText, book);
        break;
      case "comparison":
        analysisResult = await performComparisonAnalysis(originalText, book);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid analysis type. Must be 'completeness', 'comprehensive', or 'comparison'." },
          { status: 400 },
        );
    }

    // Store analysis results in the database
    const { error: updateError } = await supabase
      .from("books")
      .update({
        analysis_results: analysisResult,
        last_analyzed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error storing analysis results:", updateError);
      // Don't fail the request, just log the error
    }

    const result = NextResponse.json({
      success: true,
      analysisType,
      results: analysisResult,
      analyzedAt: new Date().toISOString(),
    });

    // Merge auth cookies into response
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 },
    );
  }
}

async function performCompletenessAnalysis(originalText: string, book: any) {
  console.log("🔍 Performing completeness analysis...");
  
  // Extract key metrics from original text
  const wordCount = originalText.split(/\s+/).length;
  const paragraphCount = originalText.split(/\n\s*\n/).length;
  const sentenceCount = originalText.split(/[.!?]+/).length;
  
  // Analyze current summary
  const summary = book.summary;
  const summaryWordCount = summary.quick_summary?.split(/\s+/).length || 0;
  const keyIdeasCount = summary.key_ideas?.length || 0;
  const chaptersCount = summary.chapters?.length || 0;
  const insightsCount = summary.actionable_insights?.length || 0;
  const quotesCount = summary.quotes?.length || 0;
  
  // Calculate coverage ratios
  const summaryCoverage = Math.min(100, (summaryWordCount / (wordCount * 0.1)) * 100); // Assume 10% of original should be in summary
  const keyIdeasCoverage = Math.min(100, (keyIdeasCount / 5) * 100); // Expect at least 5 key ideas
  const chaptersCoverage = Math.min(100, (chaptersCount / 10) * 100); // Expect at least 10 chapters
  const insightsCoverage = Math.min(100, (insightsCount / 5) * 100); // Expect at least 5 insights
  const quotesCoverage = Math.min(100, (quotesCount / 5) * 100); // Expect at least 5 quotes
  
  const overallCompleteness = (
    summaryCoverage + keyIdeasCoverage + chaptersCoverage + insightsCoverage + quotesCoverage
  ) / 5;
  
  return {
    originalText: {
      wordCount,
      paragraphCount,
      sentenceCount,
    },
    currentSummary: {
      summaryWordCount,
      keyIdeasCount,
      chaptersCount,
      insightsCount,
      quotesCount,
    },
    coverage: {
      summaryCoverage: Math.round(summaryCoverage),
      keyIdeasCoverage: Math.round(keyIdeasCoverage),
      chaptersCoverage: Math.round(chaptersCoverage),
      insightsCoverage: Math.round(insightsCoverage),
      quotesCoverage: Math.round(quotesCoverage),
      overallCompleteness: Math.round(overallCompleteness),
    },
    recommendations: generateCompletenessRecommendations({
      summaryCoverage,
      keyIdeasCoverage,
      chaptersCoverage,
      insightsCoverage,
      quotesCoverage,
    }),
  };
}

async function performComprehensiveAnalysis(originalText: string, book: any) {
  console.log("🔍 Performing comprehensive analysis...");
  
  // Instead of using multi-pass analysis (which can hit token limits), 
  // we'll do a lighter analysis focused on structure and completeness
  const existingSummary = book.summary;
  
  // Analyze the original text structure
  const wordCount = originalText.split(/\s+/).length;
  const paragraphCount = originalText.split(/\n\s*\n/).length;
  const sentenceCount = originalText.split(/[.!?]+/).length;
  
  // Extract structural information
  const chapters = extractChapterStructure(originalText);
  const potentialKeyIdeas = extractPotentialKeyIdeas(originalText);
  const potentialQuotes = extractPotentialQuotes(originalText);
  
  // Calculate coverage metrics
  const estimatedChapters = chapters.length;
  const estimatedKeyIdeas = Math.min(potentialKeyIdeas.length, 15);
  const estimatedQuotes = Math.min(potentialQuotes.length, 10);
  const estimatedInsights = Math.min(10, Math.floor(wordCount / 5000));
  
  // Compare with existing summary
  const existingKeyIdeasCount = existingSummary.key_ideas?.length || 0;
  const existingChaptersCount = existingSummary.chapters?.length || 0;
  const existingInsightsCount = existingSummary.actionable_insights?.length || 0;
  const existingQuotesCount = existingSummary.quotes?.length || 0;
  
  // Calculate coverage percentage
  const keyIdeasCoverage = Math.min(100, (existingKeyIdeasCount / estimatedKeyIdeas) * 100);
  const chaptersCoverage = Math.min(100, (existingChaptersCount / estimatedChapters) * 100);
  const insightsCoverage = Math.min(100, (existingInsightsCount / estimatedInsights) * 100);
  const quotesCoverage = Math.min(100, (existingQuotesCount / estimatedQuotes) * 100);
  
  const overallCoverage = (keyIdeasCoverage + chaptersCoverage + insightsCoverage + quotesCoverage) / 4;
  
  return {
    analysis: {
      originalText: {
        wordCount,
        paragraphCount,
        sentenceCount,
        estimatedChapters,
      },
      estimatedContent: {
        keyIdeas: estimatedKeyIdeas,
        chapters: estimatedChapters,
        insights: estimatedInsights,
        quotes: estimatedQuotes,
      },
      coverage: {
        keyIdeasCoverage: Math.round(keyIdeasCoverage),
        chaptersCoverage: Math.round(chaptersCoverage),
        insightsCoverage: Math.round(insightsCoverage),
        quotesCoverage: Math.round(quotesCoverage),
        overallCoverage: Math.round(overallCoverage),
      },
    },
    comparison: {
      keyIdeasDifference: estimatedKeyIdeas - existingKeyIdeasCount,
      chaptersDifference: estimatedChapters - existingChaptersCount,
      insightsDifference: estimatedInsights - existingInsightsCount,
      quotesDifference: estimatedQuotes - existingQuotesCount,
    },
    recommendations: generateComprehensiveRecommendations({
      coverage: { coveragePercentage: overallCoverage },
      structure: { totalChapters: estimatedChapters, hasTableOfContents: chapters.length > 0 },
    }, existingSummary),
  };
}

async function performComparisonAnalysis(originalText: string, book: any) {
  console.log("🔍 Performing comparison analysis...");
  
  // Instead of sending the entire book, we'll analyze it in chunks and compare with existing summary
  const existingSummary = book.summary;
  
  // Extract key metrics from the original text
  const wordCount = originalText.split(/\s+/).length;
  const paragraphCount = originalText.split(/\n\s*\n/).length;
  const sentenceCount = originalText.split(/[.!?]+/).length;
  
  // Analyze the structure of the original text
  const chapters = extractChapterStructure(originalText);
  const potentialKeyIdeas = extractPotentialKeyIdeas(originalText);
  const potentialQuotes = extractPotentialQuotes(originalText);
  
  // Compare with existing summary
  const existingKeyIdeasCount = existingSummary.key_ideas?.length || 0;
  const existingChaptersCount = existingSummary.chapters?.length || 0;
  const existingInsightsCount = existingSummary.actionable_insights?.length || 0;
  const existingQuotesCount = existingSummary.quotes?.length || 0;
  
  // Calculate potential improvements
  const keyIdeasPotential = Math.min(potentialKeyIdeas.length, 15); // Cap at 15 for realistic expectations
  const chaptersPotential = Math.min(chapters.length, 20); // Cap at 20 for realistic expectations
  const quotesPotential = Math.min(potentialQuotes.length, 10); // Cap at 10 for realistic expectations
  
  return {
    originalText: {
      wordCount,
      paragraphCount,
      sentenceCount,
      estimatedChapters: chapters.length,
    },
    existingSummary: {
      keyIdeasCount: existingKeyIdeasCount,
      chaptersCount: existingChaptersCount,
      insightsCount: existingInsightsCount,
      quotesCount: existingQuotesCount,
      shortSummary: existingSummary.short_summary,
    },
    potential: {
      keyIdeasPotential,
      chaptersPotential,
      quotesPotential,
      insightsPotential: Math.min(10, Math.floor(wordCount / 5000)), // Estimate based on book length
    },
    differences: {
      keyIdeasDiff: keyIdeasPotential - existingKeyIdeasCount,
      chaptersDiff: chaptersPotential - existingChaptersCount,
      insightsDiff: Math.min(10, Math.floor(wordCount / 5000)) - existingInsightsCount,
      quotesDiff: quotesPotential - existingQuotesCount,
    },
    recommendations: generateComparisonRecommendations({
      keyIdeasPotential,
      chaptersPotential,
      quotesPotential,
      insightsPotential: Math.min(10, Math.floor(wordCount / 5000)),
    }, {
      keyIdeasCount: existingKeyIdeasCount,
      chaptersCount: existingChaptersCount,
      insightsCount: existingInsightsCount,
      quotesCount: existingQuotesCount,
    }),
  };
}

function generateCompletenessRecommendations(coverage: any) {
  const recommendations = [];
  
  if (coverage.summaryCoverage < 50) {
    recommendations.push("Summary appears too brief. Consider expanding the quick summary to better capture the book's main ideas.");
  }
  
  if (coverage.keyIdeasCoverage < 60) {
    recommendations.push("Key ideas section could be more comprehensive. The book likely contains more than 3-5 major concepts.");
  }
  
  if (coverage.chaptersCoverage < 70) {
    recommendations.push("Chapter summaries may be incomplete. Consider analyzing the table of contents for missing chapters.");
  }
  
  if (coverage.insightsCoverage < 60) {
    recommendations.push("Actionable insights could be expanded. Look for more practical applications and implementation strategies.");
  }
  
  if (coverage.quotesCoverage < 60) {
    recommendations.push("Quote collection could be more comprehensive. The book likely contains more memorable and impactful quotes.");
  }
  
  if (recommendations.length === 0) {
    recommendations.push("Summary appears comprehensive and well-structured!");
  }
  
  return recommendations;
}

function generateComprehensiveRecommendations(analysisResult: any, existingSummary: any) {
  const recommendations = [];
  
  if (analysisResult.coverage.coveragePercentage < 80) {
    recommendations.push("The analysis suggests the summary may be missing significant content. Consider expanding the summary sections.");
  }
  
  if (analysisResult.structure.totalChapters > 0 && analysisResult.structure.totalChapters > (existingSummary.chapters?.length || 0)) {
    const missingChapters = analysisResult.structure.totalChapters - (existingSummary.chapters?.length || 0);
    recommendations.push(`The book appears to have ${missingChapters} more chapters than currently summarized. Consider adding missing chapter summaries.`);
  }
  
  if (!analysisResult.structure.hasTableOfContents) {
    recommendations.push("No clear table of contents structure detected. The summary structure may not reflect the book's actual organization.");
  }
  
  return recommendations;
}

function generateComparisonRecommendations(potential: any, existing: any) {
  const recommendations = [];
  
  const keyIdeasDiff = potential.keyIdeasPotential - existing.keyIdeasCount;
  if (keyIdeasDiff > 2) {
    recommendations.push(`The book likely contains ${keyIdeasDiff} more key ideas than currently captured. Consider expanding the key ideas section.`);
  }
  
  const chaptersDiff = potential.chaptersPotential - existing.chaptersCount;
  if (chaptersDiff > 3) {
    recommendations.push(`The book appears to have ${chaptersDiff} more chapters than currently summarized. Consider adding missing chapter summaries.`);
  }
  
  const insightsDiff = potential.insightsPotential - existing.insightsCount;
  if (insightsDiff > 2) {
    recommendations.push(`The book likely contains ${insightsDiff} more actionable insights. Consider expanding the insights section.`);
  }
  
  const quotesDiff = potential.quotesPotential - existing.quotesCount;
  if (quotesDiff > 2) {
    recommendations.push(`The book appears to have ${quotesDiff} more memorable quotes. Consider expanding the quotes collection.`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push("The existing summary appears to be comprehensive and well-structured based on the book's content analysis.");
  }
  
  return recommendations;
}

function extractChapterStructure(text: string): string[] {
  const chapters: string[] = [];
  
  // Look for common chapter patterns
  const chapterPatterns = [
    /^Chapter\s+(\d+)[:.\s]*(.+)$/gmi,
    /^(\d+)[:.\s]*(.+)$/gmi,
    /^Part\s+(\d+)[:.\s]*(.+)$/gmi,
    /^Section\s+(\d+)[:.\s]*(.+)$/gmi,
    /^(\d+\.\d+)[:.\s]*(.+)$/gmi,
  ];
  
  const lines = text.split('\n');
  for (const line of lines) {
    for (const pattern of chapterPatterns) {
      const match = line.match(pattern);
      if (match && match[2] && match[2].trim().length > 3) {
        chapters.push(match[2].trim());
        break;
      }
    }
  }
  
  // Remove duplicates and filter out very short titles
  return [...new Set(chapters)].filter(title => title.length > 3 && title.length < 100);
}

function extractPotentialKeyIdeas(text: string): string[] {
  const ideas: string[] = [];
  
  // Look for numbered lists, bullet points, and section headers
  const ideaPatterns = [
    /^\d+\.\s*(.+)$/gmi,
    /^[-*]\s*(.+)$/gmi,
    /^(\d+)\s+(.+)$/gmi,
    /^[A-Z][^.!?]*[.!?]$/gm, // Capitalized sentences
  ];
  
  const lines = text.split('\n');
  for (const line of lines) {
    for (const pattern of ideaPatterns) {
      const match = line.match(pattern);
      if (match && match[1] && match[1].trim().length > 10 && match[1].trim().length < 200) {
        ideas.push(match[1].trim());
        break;
      }
    }
  }
  
  // Remove duplicates and limit to reasonable number
  return [...new Set(ideas)].slice(0, 20);
}

function extractPotentialQuotes(text: string): string[] {
  const quotes: string[] = [];
  
  // Look for quoted text and emphasized sentences
  const quotePatterns = [
    /"([^"]{20,200})"/g,
    /'([^']{20,200})'/g,
    /^[^a-z]*[A-Z][^.!?]*[.!?]$/gm, // Sentences that start with capital letters
  ];
  
  for (const pattern of quotePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const cleanQuote = match.replace(/^["']|["']$/g, '').trim();
        if (cleanQuote.length > 20 && cleanQuote.length < 200) {
          quotes.push(cleanQuote);
        }
      }
    }
  }
  
  // Remove duplicates and limit to reasonable number
  return [...new Set(quotes)].slice(0, 15);
}

function getMimeTypeFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'epub':
      return 'application/epub+zip';
    case 'txt':
      return 'text/plain';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    default:
      return 'text/plain';
  }
}
