"use client";

import { useState } from "react";
import { BarChart3, RefreshCw, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AnalysisType = "completeness" | "comprehensive" | "comparison";

type AnalysisResults = {
  // For completeness analysis
  originalText?: {
    wordCount: number;
    paragraphCount: number;
    sentenceCount: number;
  };
  currentSummary?: {
    summaryWordCount: number;
    keyIdeasCount: number;
    chaptersCount: number;
    insightsCount: number;
    quotesCount: number;
  };
  coverage?: {
    summaryCoverage: number;
    keyIdeasCoverage: number;
    chaptersCoverage: number;
    insightsCoverage: number;
    quotesCoverage: number;
    overallCompleteness: number;
  };
  
  // For comprehensive analysis
  analysis?: {
    originalText: {
      wordCount: number;
      paragraphCount: number;
      sentenceCount: number;
      estimatedChapters: number;
    };
    estimatedContent: {
      keyIdeas: number;
      chapters: number;
      insights: number;
      quotes: number;
    };
    coverage: {
      keyIdeasCoverage: number;
      chaptersCoverage: number;
      insightsCoverage: number;
      quotesCoverage: number;
      overallCoverage: number;
    };
  };
  
  // For comparison analysis
  freshSummary?: {
    keyIdeasCount: number;
    chaptersCount: number;
    insightsCount: number;
    quotesCount: number;
    shortSummary: string;
  };
  existingSummary?: {
    keyIdeasCount: number;
    chaptersCount: number;
    insightsCount: number;
    quotesCount: number;
    shortSummary: string;
  };
  differences?: {
    keyIdeasDiff: number;
    chaptersDiff: number;
    insightsDiff: number;
    quotesDiff: number;
  };
  
  // Common fields
  comparison?: {
    keyIdeasDifference: number;
    chaptersDifference: number;
    insightsDifference: number;
    quotesDifference: number;
  };
  recommendations: string[];
};

type BookAnalysisProps = {
  bookId: string;
  initialResults?: AnalysisResults;
};

export function BookAnalysis({ bookId, initialResults }: BookAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("completeness");
  const [results, setResults] = useState<AnalysisResults | null>(initialResults || null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (type: AnalysisType) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisType(type);

    try {
      const response = await fetch(`/api/books/${bookId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ analysisType: type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      const data = await response.json();
      console.log("Analysis API response:", data);
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return "text-green-600";
    if (coverage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getCoverageBadgeVariant = (coverage: number) => {
    if (coverage >= 80) return "default";
    if (coverage >= 60) return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Book Analysis
          </CardTitle>
          <CardDescription>
            Perform additional analysis on the complete original book to verify summary completeness and accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              onClick={() => runAnalysis("completeness")}
              disabled={isAnalyzing}
              variant={analysisType === "completeness" ? "default" : "outline"}
              size="sm"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Completeness Check
            </Button>
            <Button
              onClick={() => runAnalysis("comprehensive")}
              disabled={isAnalyzing}
              variant={analysisType === "comprehensive" ? "default" : "outline"}
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Comprehensive Analysis
            </Button>
            <Button
              onClick={() => runAnalysis("comparison")}
              disabled={isAnalyzing}
              variant={analysisType === "comparison" ? "default" : "outline"}
              size="sm"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Fresh Comparison
            </Button>
          </div>

          {isAnalyzing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Running {analysisType} analysis...
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results && (
            <div className="space-y-4">
              <Tabs value={analysisType} onValueChange={(value) => setAnalysisType(value as AnalysisType)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="completeness">Completeness</TabsTrigger>
                  <TabsTrigger value="comprehensive">Comprehensive</TabsTrigger>
                  <TabsTrigger value="comparison">Comparison</TabsTrigger>
                </TabsList>

              <TabsContent value="completeness" className="space-y-4">
                {results.coverage && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Overall Completeness</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-center">
                            {results.coverage.overallCompleteness}%
                          </div>
                          <Progress 
                            value={results.coverage.overallCompleteness} 
                            className="mt-2"
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Summary Coverage</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-2xl font-bold text-center ${getCoverageColor(results.coverage.summaryCoverage)}`}>
                            {results.coverage.summaryCoverage}%
                          </div>
                          <Progress 
                            value={results.coverage.summaryCoverage} 
                            className="mt-2"
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Key Ideas Coverage</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-2xl font-bold text-center ${getCoverageColor(results.coverage.keyIdeasCoverage)}`}>
                            {results.coverage.keyIdeasCoverage}%
                          </div>
                          <Progress 
                            value={results.coverage.keyIdeasCoverage} 
                            className="mt-2"
                          />
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Original Text Metrics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span>Words:</span>
                            <span className="font-mono">{results.originalText?.wordCount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Paragraphs:</span>
                            <span className="font-mono">{results.originalText?.paragraphCount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Sentences:</span>
                            <span className="font-mono">{results.originalText?.sentenceCount.toLocaleString()}</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Current Summary Metrics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span>Summary Words:</span>
                            <span className="font-mono">{results.currentSummary?.summaryWordCount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Key Ideas:</span>
                            <span className="font-mono">{results.currentSummary?.keyIdeasCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Chapters:</span>
                            <span className="font-mono">{results.currentSummary?.chaptersCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Insights:</span>
                            <span className="font-mono">{results.currentSummary?.insightsCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quotes:</span>
                            <span className="font-mono">{results.currentSummary?.quotesCount}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="comprehensive" className="space-y-4">
                {results.analysis && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Comprehensive Analysis Results</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span>Overall Coverage:</span>
                          <Badge variant={getCoverageBadgeVariant(results.analysis.coverage.overallCoverage)}>
                            {results.analysis.coverage.overallCoverage}%
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Key Ideas Coverage:</span>
                          <span className="font-mono">{results.analysis.coverage.keyIdeasCoverage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Chapters Coverage:</span>
                          <span className="font-mono">{results.analysis.coverage.chaptersCoverage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Insights Coverage:</span>
                          <span className="font-mono">{results.analysis.coverage.insightsCoverage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Quotes Coverage:</span>
                          <span className="font-mono">{results.analysis.coverage.quotesCoverage}%</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Original Text Analysis</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span>Word Count:</span>
                          <span className="font-mono">{results.analysis.originalText.wordCount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Paragraphs:</span>
                          <span className="font-mono">{results.analysis.originalText.paragraphCount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sentences:</span>
                          <span className="font-mono">{results.analysis.originalText.sentenceCount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estimated Chapters:</span>
                          <span className="font-mono">{results.analysis.originalText.estimatedChapters}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Estimated Content</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span>Key Ideas:</span>
                          <span className="font-mono">{results.analysis.estimatedContent.keyIdeas}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Chapters:</span>
                          <span className="font-mono">{results.analysis.estimatedContent.chapters}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Insights:</span>
                          <span className="font-mono">{results.analysis.estimatedContent.insights}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Quotes:</span>
                          <span className="font-mono">{results.analysis.estimatedContent.quotes}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {results.comparison && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Comparison with Existing</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span>Key Ideas Diff:</span>
                            <span className={`font-mono ${results.comparison.keyIdeasDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {results.comparison.keyIdeasDifference > 0 ? '+' : ''}{results.comparison.keyIdeasDifference}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Chapters Diff:</span>
                            <span className={`font-mono ${results.comparison.chaptersDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {results.comparison.chaptersDifference > 0 ? '+' : ''}{results.comparison.chaptersDifference}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Insights Diff:</span>
                            <span className={`font-mono ${results.comparison.insightsDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {results.comparison.insightsDifference > 0 ? '+' : ''}{results.comparison.insightsDifference}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quotes Diff:</span>
                            <span className={`font-mono ${results.comparison.quotesDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {results.comparison.quotesDifference > 0 ? '+' : ''}{results.comparison.quotesDifference}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="comparison" className="space-y-4">
                {results.freshSummary && results.existingSummary && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Fresh Analysis</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm text-muted-foreground mb-2">
                          {results.freshSummary.shortSummary}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Key Ideas:</span>
                            <span className="font-mono">{results.freshSummary.keyIdeasCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Chapters:</span>
                            <span className="font-mono">{results.freshSummary.chaptersCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Insights:</span>
                            <span className="font-mono">{results.freshSummary.insightsCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quotes:</span>
                            <span className="font-mono">{results.freshSummary.quotesCount}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Existing Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm text-muted-foreground mb-2">
                          {results.existingSummary.shortSummary}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span>Key Ideas:</span>
                            <span className="font-mono">{results.existingSummary.keyIdeasCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Chapters:</span>
                            <span className="font-mono">{results.existingSummary.chaptersCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Insights:</span>
                            <span className="font-mono">{results.existingSummary.insightsCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Quotes:</span>
                            <span className="font-mono">{results.existingSummary.quotesCount}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {results.differences && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Differences</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {results.differences.keyIdeasDiff > 0 ? '+' : ''}{results.differences.keyIdeasDiff}
                          </div>
                          <div className="text-sm text-muted-foreground">Key Ideas</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {results.differences.chaptersDiff > 0 ? '+' : ''}{results.differences.chaptersDiff}
                          </div>
                          <div className="text-sm text-muted-foreground">Chapters</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {results.differences.insightsDiff > 0 ? '+' : ''}{results.differences.insightsDiff}
                          </div>
                          <div className="text-sm text-muted-foreground">Insights</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {results.differences.quotesDiff > 0 ? '+' : ''}{results.differences.quotesDiff}
                          </div>
                          <div className="text-sm text-muted-foreground">Quotes</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
            
            {/* Fallback display for raw results */}
            {!results.coverage && !results.analysis && !results.freshSummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Analysis Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
            </div>
          )}

          {results?.recommendations && results.recommendations.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {results.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
