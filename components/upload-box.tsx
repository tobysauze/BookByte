"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { CloudUpload, FileText, Loader2, X, ChevronDown, ChevronUp, Save, Trash2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UploadBoxProps = {
  onUpload: (files: File[], customPrompt?: string, model?: string, promptId?: string, promptName?: string) => Promise<void>;
  isLoading?: boolean;
};

interface Model {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length?: number;
  created?: number;
}

type SortOption = "popular" | "price-low" | "price-high" | "context-high" | "context-low" | "latest" | "oldest";

interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
  createdAt: number;
  updated_at?: string;
  ratings: number[]; // Array of ratings (1-10) from users
}

const STORAGE_KEY = "bookbyte_saved_prompts";
const LAST_MODEL_KEY = "bookbyte_last_selected_model";

// Format pricing for display
function formatPricing(prompt: string, completion: string): string {
  const promptNum = parseFloat(prompt);
  const completionNum = parseFloat(completion);
  
  if (isNaN(promptNum) || isNaN(completionNum)) {
    return "Free";
  }
  
  // If prices are very small, show in cents
  if (promptNum < 0.01 && completionNum < 0.01) {
    const promptCents = Math.round(promptNum * 10000) / 100;
    const completionCents = Math.round(completionNum * 10000) / 100;
    return `$${promptCents}/${completionCents} per 1M tokens`;
  }
  
  // Format as dollars per million tokens
  const formatPrice = (price: number) => {
    if (price === 0) return "Free";
    if (price < 0.01) return price.toFixed(4);
    return price.toFixed(2);
  };
  
  return `$${formatPrice(promptNum)}/${formatPrice(completionNum)} per 1M tokens`;
}

// Count words in text (simple word count)
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

// Estimate words from file (async since we need to read file)
async function estimateWordsFromFile(file: File): Promise<number> {
  try {
    // For text files, read directly
    if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const text = await file.text();
      return countWords(text);
    }
    
    // For PDF/EPUB, estimate based on file size
    // Rough estimate: PDF ~500 words per KB, EPUB ~400 words per KB
    // These are conservative estimates
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      return Math.ceil((file.size / 1024) * 500);
    }
    
    if (file.type === "application/epub+zip" || file.name.endsWith(".epub")) {
      return Math.ceil((file.size / 1024) * 400);
    }
    
    // Default estimate for other file types
    return Math.ceil((file.size / 1024) * 300);
  } catch (error) {
    console.error("Error estimating words from file:", error);
    // Fallback estimate
    return Math.ceil((file.size / 1024) * 300);
  }
}

// Estimate tokens from file (async since we need to read file)
async function estimateTokensFromFile(file: File): Promise<number> {
  try {
    const text = await file.text();
    return estimateTokens(text);
  } catch (error) {
    // For binary files like PDF/EPUB, estimate based on file size
    // Assume ~50% of file size is readable text
    return Math.ceil((file.size * 0.5) / 4);
  }
}

// Calculate cost estimate
function calculateCostEstimate(
  inputTokens: number,
  promptPrice: number,
  completionPrice: number
): { estimatedInputTokens: number; estimatedOutputTokens: number; estimatedCost: number } {
  // Estimate output tokens (typically 20-30% of input for summaries)
  // For chapter summaries, use 25% as a reasonable estimate
  const estimatedOutputTokens = Math.ceil(inputTokens * 0.25);
  
  // Calculate costs
  const inputCost = (inputTokens / 1_000_000) * promptPrice;
  const outputCost = (estimatedOutputTokens / 1_000_000) * completionPrice;
  const totalCost = inputCost + outputCost;
  
  return {
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: estimatedOutputTokens,
    estimatedCost: totalCost,
  };
}

const DEFAULT_CHAPTER_PROMPT = `You are analyzing a chapter from a book. Your task is to create a comprehensive summary for THIS CHAPTER ONLY.

IMPORTANT INSTRUCTIONS:
1. Create a detailed chapter summary that captures all major ideas, concepts, and details from this chapter
2. Extract key ideas specific to this chapter
3. Identify actionable insights from this chapter
4. Find memorable quotes from this chapter
5. The short_summary should be a brief 1-2 sentence overview of THIS CHAPTER (MAX 200 characters)
6. The quick_summary should be a comprehensive overview of THIS CHAPTER (3-4 paragraphs)
7. Include chapter-specific key_ideas, actionable_insights, and quotes

Chapter Content:
{CHAPTER_TEXT}

Return ONLY valid JSON matching this exact structure (no markdown formatting, no code blocks):
{
  "short_summary": "Brief chapter overview (MAX 200 characters)",
  "quick_summary": "Comprehensive chapter summary",
  "key_ideas": [
    {"title": "Key Idea Title", "text": "Detailed explanation"}
  ],
  "chapters": [
    {"title": "{CHAPTER_NAME}", "summary": "Detailed chapter summary"}
  ],
  "actionable_insights": [
    "Actionable insight 1",
    "Actionable insight 2"
  ],
  "quotes": [
    "Quote 1",
    "Quote 2"
  ]
}`;

const ACCEPTED_TYPES = ["application/pdf", "text/plain", "text/markdown", "application/epub+zip"];

export function UploadBox({ onUpload, isLoading }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_CHAPTER_PROMPT);
  const [selectedModel, setSelectedModel] = useState<string>("openai/gpt-4o");
  const [models, setModels] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>("popular");
  const [costEstimate, setCostEstimate] = useState<{
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedCost: number;
  } | null>(null);
  const [isEstimatingCost, setIsEstimatingCost] = useState(false);
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [isAnalyzingWords, setIsAnalyzingWords] = useState(false);
  const [wordCountWarnings, setWordCountWarnings] = useState<Array<{ filename: string; warning: string }>>([]);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [showSavePromptDialog, setShowSavePromptDialog] = useState(false);
  const [promptName, setPromptName] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  // Save selected model to localStorage whenever it changes (but only after models are loaded)
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedModel && !modelsLoading && models.length > 0) {
      try {
        localStorage.setItem(LAST_MODEL_KEY, selectedModel);
      } catch (error) {
        console.error("Error saving selected model:", error);
      }
    }
  }, [selectedModel, modelsLoading, models.length]);

  // Load saved prompts from database
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const response = await fetch("/api/prompts");
        if (response.ok) {
          const data = await response.json();
          if (data.prompts && Array.isArray(data.prompts)) {
            const prompts: SavedPrompt[] = data.prompts.map((p: any) => ({
              id: p.id,
              name: p.name,
              prompt: p.prompt,
              createdAt: new Date(p.created_at).getTime(),
              updated_at: p.updated_at,
              ratings: p.ratings || [],
            }));
            console.log(`Loaded ${prompts.length} saved prompt(s) from database`);
            setSavedPrompts(prompts);
          } else {
            console.log("No prompts found in database");
            setSavedPrompts([]);
          }
        } else {
          console.warn("Failed to fetch prompts from database");
          setSavedPrompts([]);
        }
      } catch (error) {
        console.error("Error loading saved prompts:", error);
        setSavedPrompts([]);
      }
    };

    loadPrompts();
    
    // Listen for storage changes (for backwards compatibility if needed)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        loadPrompts();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event for same-tab updates
    const handleCustomStorageChange = () => {
      loadPrompts();
    };
    
    window.addEventListener('promptRatingSaved', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('promptRatingSaved', handleCustomStorageChange);
    };
  }, []);


  const handleSavePrompt = async () => {
    if (!promptName.trim() || !customPrompt.trim()) {
      setError("Please enter a name for your prompt.");
      return;
    }

    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: promptName.trim(),
          prompt: customPrompt.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save prompt.");
      }

      const data = await response.json();
      const newPrompt: SavedPrompt = {
        id: data.prompt.id,
        name: data.prompt.name,
        prompt: data.prompt.prompt,
        createdAt: new Date(data.prompt.created_at).getTime(),
        updated_at: data.prompt.updated_at,
        ratings: data.prompt.ratings || [],
      };

      setSavedPrompts((prev) => {
        // Remove any existing prompt with the same name and add the new one
        const filtered = prev.filter((p) => p.id !== newPrompt.id && p.name !== newPrompt.name);
        return [...filtered, newPrompt];
      });
      setPromptName("");
      setShowSavePromptDialog(false);
      setError(null);
      console.log(`Saved prompt "${newPrompt.name}" to database`);
      
      // Trigger reload from database
      const reloadResponse = await fetch("/api/prompts");
      if (reloadResponse.ok) {
        const reloadData = await reloadResponse.json();
        if (reloadData.prompts && Array.isArray(reloadData.prompts)) {
          const prompts: SavedPrompt[] = reloadData.prompts.map((p: any) => ({
            id: p.id,
            name: p.name,
            prompt: p.prompt,
            createdAt: new Date(p.created_at).getTime(),
            updated_at: p.updated_at,
            ratings: p.ratings || [],
          }));
          setSavedPrompts(prompts);
        }
      }
    } catch (err) {
      console.error("Error saving prompt:", err);
      setError(err instanceof Error ? err.message : "Failed to save prompt.");
    }
  };

  const handleLoadPrompt = (promptId: string) => {
    const prompt = savedPrompts.find((p) => p.id === promptId);
    if (prompt) {
      setCustomPrompt(prompt.prompt);
      setSelectedPromptId(promptId);
    }
  };

  const handleDeletePrompt = async (promptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await fetch(`/api/prompts?id=${promptId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete prompt.");
      }

      setSavedPrompts((prev) => prev.filter((p) => p.id !== promptId));
      if (selectedPromptId === promptId) {
        setSelectedPromptId(null);
        setCustomPrompt(DEFAULT_CHAPTER_PROMPT);
      }
      console.log(`Deleted prompt ${promptId} from database`);
    } catch (err) {
      console.error("Error deleting prompt:", err);
      setError(err instanceof Error ? err.message : "Failed to delete prompt.");
    }
  };

  // Fetch available models from OpenRouter
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setModelsLoading(true);
        const response = await fetch("/api/models");
        
        if (!response.ok) {
          console.error("Failed to fetch models");
          // Fallback to default models if API fails
          setModels([
            { id: "openai/gpt-4o", name: "GPT-4o", pricing: { prompt: "2.5", completion: "10" } },
            { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo", pricing: { prompt: "10", completion: "30" } },
          ]);
          return;
        }

        const data = await response.json();
        setModels(data.models || []);
        
        // Load saved model from localStorage if available
        let savedModel: string | null = null;
        if (typeof window !== 'undefined') {
          try {
            savedModel = localStorage.getItem(LAST_MODEL_KEY);
          } catch (error) {
            console.error("Error loading saved model:", error);
          }
        }
        
        // Set default model: use saved model if it exists in the models list, otherwise use GPT-4o or first available
        if (data.models?.length > 0) {
          if (savedModel && data.models.find((m: Model) => m.id === savedModel)) {
            // Use saved model if it exists in the current models list
            setSelectedModel(savedModel);
          } else {
            // Fallback to GPT-4o or first available
            const defaultModel = data.models.find((m: Model) => m.id === "openai/gpt-4o") || data.models[0];
            setSelectedModel(defaultModel.id);
          }
        }
      } catch (err) {
        console.error("Error fetching models:", err);
        // Fallback to default models
        setModels([
          { id: "openai/gpt-4o", name: "GPT-4o", pricing: { prompt: "2.5", completion: "10" } },
        ]);
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, []);

  const handleFileChange = async (fileList: FileList | null) => {
    setError(null);
    if (!fileList?.length) return;

    const validFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (
        ACCEPTED_TYPES.includes(file.type) ||
        file.name.endsWith(".pdf") ||
        file.name.endsWith(".epub") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".md")
      ) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      setError("Please upload PDF, EPUB, TXT, or Markdown files.");
      return;
    }

    // Sort files by name to ensure chapter order
    validFiles.sort((a, b) => a.name.localeCompare(b.name));
    setSelectedFiles(validFiles);
    
    // Reset word count when files change (user needs to click button to analyze)
    setWordCount(null);
    setWordCountWarnings([]);
    
    // Reset prompt editor when files change
    if (validFiles.length > 1) {
      setCustomPrompt(DEFAULT_CHAPTER_PROMPT);
      setSelectedPromptId(null);
    }
    
    // Estimate cost for new files
    await estimateCost(validFiles, selectedModel);
  };

  // Estimate cost when files or model changes
  const estimateCost = useCallback(async (files: File[], modelId: string) => {
    if (files.length === 0 || models.length === 0) {
      setCostEstimate(null);
      return;
    }

    setIsEstimatingCost(true);
    try {
      // Estimate tokens for all files
      let totalTokens = 0;
      for (const file of files) {
        const tokens = await estimateTokensFromFile(file);
        totalTokens += tokens;
      }
      
      // Add prompt overhead (system prompt, instructions, etc.)
      // Estimate ~500 tokens for prompt overhead per file/chapter
      const promptOverhead = files.length * 500;
      totalTokens += promptOverhead;
      
      // Find selected model pricing
      const model = models.find(m => m.id === modelId);
      if (!model) {
        setCostEstimate(null);
        return;
      }
      
      const promptPrice = parseFloat(model.pricing.prompt) || 0;
      const completionPrice = parseFloat(model.pricing.completion) || 0;
      
      if (promptPrice === 0 && completionPrice === 0) {
        setCostEstimate({
          estimatedInputTokens: totalTokens,
          estimatedOutputTokens: Math.ceil(totalTokens * 0.25),
          estimatedCost: 0,
        });
        return;
      }
      
      const estimate = calculateCostEstimate(totalTokens, promptPrice, completionPrice);
      setCostEstimate(estimate);
    } catch (error) {
      console.error("Error estimating cost:", error);
      setCostEstimate(null);
    } finally {
      setIsEstimatingCost(false);
    }
  }, [models]);

  // Filter models based on search query
  const filteredModels = models.filter((model) => {
    if (!modelSearchQuery.trim()) return true;
    const query = modelSearchQuery.toLowerCase();
    const modelName = (model.name || model.id).toLowerCase();
    const modelId = model.id.toLowerCase();
    return modelName.includes(query) || modelId.includes(query);
  });

  // Sort models based on selected sort option
  const sortedModels = [...filteredModels].sort((a, b) => {
    switch (sortOption) {
      case "popular": {
        // Popular models first, then alphabetical
        const popularModels = [
          "openai/gpt-4o",
          "openai/gpt-4-turbo",
          "anthropic/claude-3.5-sonnet",
          "anthropic/claude-3-opus",
          "google/gemini-pro-1.5",
          "meta-llama/llama-3.1-405b-instruct",
          "anthropic/claude-3-haiku",
          "openai/gpt-3.5-turbo",
        ];
        
        const aIndex = popularModels.indexOf(a.id);
        const bIndex = popularModels.indexOf(b.id);
        
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.id.localeCompare(b.id);
      }
      
      case "price-low": {
        // Sort by total cost (prompt + completion), lowest first
        const aCost = parseFloat(a.pricing.prompt) + parseFloat(a.pricing.completion);
        const bCost = parseFloat(b.pricing.prompt) + parseFloat(b.pricing.completion);
        if (aCost === bCost) return a.id.localeCompare(b.id);
        return aCost - bCost;
      }
      
      case "price-high": {
        // Sort by total cost (prompt + completion), highest first
        const aCost = parseFloat(a.pricing.prompt) + parseFloat(a.pricing.completion);
        const bCost = parseFloat(b.pricing.prompt) + parseFloat(b.pricing.completion);
        if (aCost === bCost) return a.id.localeCompare(b.id);
        return bCost - aCost;
      }
      
      case "context-high": {
        // Sort by context length, highest first
        const aContext = a.context_length || 0;
        const bContext = b.context_length || 0;
        if (aContext === bContext) return a.id.localeCompare(b.id);
        return bContext - aContext;
      }
      
      case "context-low": {
        // Sort by context length, lowest first
        const aContext = a.context_length || 0;
        const bContext = b.context_length || 0;
        if (aContext === bContext) return a.id.localeCompare(b.id);
        return aContext - bContext;
      }
      
      case "latest": {
        // Sort by creation date, newest first
        const aCreated = a.created || 0;
        const bCreated = b.created || 0;
        if (aCreated === bCreated) return a.id.localeCompare(b.id);
        return bCreated - aCreated;
      }
      
      case "oldest": {
        // Sort by creation date, oldest first
        const aCreated = a.created || 0;
        const bCreated = b.created || 0;
        if (aCreated === bCreated) return a.id.localeCompare(b.id);
        return aCreated - bCreated;
      }
      
      default:
        return a.id.localeCompare(b.id);
    }
  });

  // Update cost estimate when model changes
  useEffect(() => {
    if (selectedFiles.length > 0 && models.length > 0) {
      estimateCost(selectedFiles, selectedModel);
    }
  }, [selectedModel, selectedFiles, estimateCost]);

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    
    // Reset word count when files change
    setWordCount(null);
    setWordCountWarnings([]);
    
    // Recalculate cost estimate
    if (newFiles.length > 0 && models.length > 0) {
      estimateCost(newFiles, selectedModel);
    } else {
      setCostEstimate(null);
    }
  };

  const analyzeWordCount = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsAnalyzingWords(true);
    setWordCount(null);
    setWordCountWarnings([]);
    setError(null);
    
    try {
      // Use API endpoint for accurate extraction from PDF/EPUB files
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append("files", file);
      });

      const response = await fetch("/api/analyze-word-count", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze word count.");
      }

      const data = await response.json();
      setWordCount(data.totalWords);
      
      // Extract warnings from file word counts
      const warnings = data.fileWordCounts
        .filter((file: { warning?: string }) => file.warning)
        .map((file: { filename: string; warning: string }) => ({
          filename: file.filename,
          warning: file.warning,
        }));
      setWordCountWarnings(warnings);
      
      console.log(`Analyzed word count: ${data.totalWords} words across ${selectedFiles.length} file(s)`);
      if (warnings.length > 0) {
        console.warn("Word count warnings:", warnings);
      }
    } catch (error) {
      console.error("Error analyzing word count:", error);
      setError(error instanceof Error ? error.message : "Failed to analyze word count. Please try again.");
    } finally {
      setIsAnalyzingWords(false);
    }
  };

  // Calculate average rating for a prompt
  const getAverageRating = (ratings: number[]): number | null => {
    if (!ratings || ratings.length === 0) return null;
    const sum = ratings.reduce((acc, rating) => acc + rating, 0);
    return Math.round((sum / ratings.length) * 10) / 10; // Round to 1 decimal place
  };

  // Get prompt name for the upload callback
  const getPromptNameById = (id: string): string => {
    const prompt = savedPrompts.find(p => p.id === id);
    return prompt?.name || "Custom Prompt";
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file.");
      return;
    }
    const promptName = selectedPromptId ? getPromptNameById(selectedPromptId) : undefined;
    await onUpload(
      selectedFiles,
      showPromptEditor && customPrompt.trim() ? customPrompt : undefined,
      selectedModel,
      selectedPromptId || undefined,
      promptName
    );
  };

  const generatePromptPreview = (files: File[]) => {
    if (files.length === 0) return DEFAULT_CHAPTER_PROMPT;
    
    const firstFileName = files[0].name.replace(/\.[^/.]+$/, "").trim();
    return DEFAULT_CHAPTER_PROMPT
      .replace("{CHAPTER_NAME}", firstFileName)
      .replace("{CHAPTER_TEXT}", `[Content from ${files.length} file${files.length > 1 ? "s" : ""} will be inserted here]`);
  };

  return (
    <div className="space-y-4 rounded-3xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--accent))]/10">
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--accent))]" />
        ) : selectedFiles.length > 0 ? (
          <FileText className="h-8 w-8 text-[rgb(var(--accent))]" />
        ) : (
          <CloudUpload className="h-8 w-8 text-[rgb(var(--accent))]" />
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Upload your book</h3>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          {selectedFiles.length > 1 
            ? "Upload multiple chapter files to create a detailed chapter-by-chapter summary."
            : "BookByte will extract the content, summarize the key ideas, and generate audio highlights for you."}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3">
        <Input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(event) => handleFileChange(event.target.files)}
          disabled={isLoading}
        />
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
        >
          {isLoading ? "Processing…" : selectedFiles.length > 0 ? "Change Files" : "Choose Files"}
        </Button>
        
        {selectedFiles.length > 0 && (
          <div className="w-full max-w-md space-y-3 mt-4">
            {/* Model Selector */}
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <Label htmlFor="model-select" className="text-sm font-medium">
                  AI Model
                </Label>
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                  <SelectTrigger id="sort-select" className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popular">Popular</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="context-high">Context: High to Low</SelectItem>
                    <SelectItem value="context-low">Context: Low to High</SelectItem>
                    <SelectItem value="latest">Latest Released</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {modelsLoading ? (
                <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading models...
                </div>
              ) : (
                <>
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[rgb(var(--muted-foreground))]" />
                    <Input
                      type="text"
                      placeholder="Search models (e.g., 'grok', 'claude', 'gpt')"
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      className="pl-9 pr-3 h-9 text-sm"
                      disabled={isLoading}
                    />
                    {modelSearchQuery && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setModelSearchQuery("")}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isLoading}>
                    <SelectTrigger id="model-select" className="w-full">
                      <SelectValue placeholder="Select a model..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px] overflow-y-auto">
                      {sortedModels.length === 0 ? (
                        <div className="px-2 py-6 text-center text-sm text-[rgb(var(--muted-foreground))]">
                          No models found matching "{modelSearchQuery}"
                        </div>
                      ) : (
                        sortedModels.map((model) => {
                          const pricing = formatPricing(model.pricing.prompt, model.pricing.completion);
                          const contextInfo = model.context_length 
                            ? `${(model.context_length / 1000).toFixed(0)}K context` 
                            : "";
                          return (
                            <SelectItem key={model.id} value={model.id} textValue={model.name || model.id}>
                              <div className="flex flex-col gap-1 w-full">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{model.name || model.id}</span>
                                  {contextInfo && (
                                    <span className="text-xs text-[rgb(var(--muted-foreground))]">
                                      {contextInfo}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-[rgb(var(--muted-foreground))]">
                                  {pricing}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  {modelSearchQuery && sortedModels.length > 0 && (
                    <p className="text-xs text-[rgb(var(--muted-foreground))]">
                      Showing {sortedModels.length} model{sortedModels.length !== 1 ? 's' : ''} matching "{modelSearchQuery}"
                    </p>
                  )}
                </>
              )}
              <p className="text-xs text-[rgb(var(--muted-foreground))]">
                Choose which LLM to use for summarization
              </p>
              
              {/* Word Count Analysis */}
              {selectedFiles.length > 0 && (
                <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30 p-3 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Book Word Count</span>
                    {!wordCount && !isAnalyzingWords && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={analyzeWordCount}
                        disabled={isLoading}
                        className="text-xs h-7"
                      >
                        Analyze
                      </Button>
                    )}
                  </div>
                  {isAnalyzingWords ? (
                    <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing word count...
                    </div>
                  ) : wordCount !== null ? (
                    <>
                      <div className="text-lg font-bold text-[rgb(var(--foreground))] mb-1">
                        {wordCount.toLocaleString()} words
                      </div>
                      <div className="text-xs text-[rgb(var(--muted-foreground))]">
                        {selectedFiles.length > 1 
                          ? `Total words across ${selectedFiles.length} files`
                          : "Word count"}
                      </div>
                      {wordCountWarnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {wordCountWarnings.map((w, idx) => (
                            <div key={idx} className="text-xs text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                              <strong>{w.filename}:</strong> {w.warning}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">
                      Click "Analyze" to count words in your book
                    </div>
                  )}
                </div>
              )}
              
              {/* Cost Estimate */}
              {selectedFiles.length > 0 && !isEstimatingCost && costEstimate && (
                <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30 p-3 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Estimated Cost</span>
                    <span className="text-lg font-bold text-[rgb(var(--accent))]">
                      ${costEstimate.estimatedCost.toFixed(4)}
                    </span>
                  </div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))] space-y-0.5">
                    <div>Input: ~{costEstimate.estimatedInputTokens.toLocaleString()} tokens</div>
                    <div>Output: ~{costEstimate.estimatedOutputTokens.toLocaleString()} tokens (est.)</div>
                    <div className="mt-1 pt-1 border-t border-[rgb(var(--border))]">
                      <em>Note: Actual cost may vary based on actual token usage</em>
                    </div>
                  </div>
                </div>
              )}
              
              {isEstimatingCost && (
                <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted-foreground))]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Calculating cost estimate...
                </div>
              )}
            </div>

          <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Selected {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""}:
            </p>
            <div className="max-h-[200px] overflow-y-auto space-y-1 text-left">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 border rounded-md bg-[rgb(var(--muted))]/30 text-sm"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-3 w-3 text-[rgb(var(--muted-foreground))] flex-shrink-0" />
                    <span className="truncate" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-xs text-[rgb(var(--muted-foreground))] flex-shrink-0">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  {!isLoading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-5 w-5 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {!isLoading && (
              <Button
                type="button"
                onClick={handleUpload}
                className="w-full mt-2"
              >
                {selectedFiles.length > 1 ? `Process ${selectedFiles.length} Chapters` : "Process Book"}
              </Button>
            )}
          </div>
        )}

        {/* Prompt Editor Section */}
        {selectedFiles.length > 0 && (
          <div className="w-full max-w-md mt-4 space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="w-full justify-between"
              disabled={isLoading}
            >
              <span>{showPromptEditor ? "Hide" : "Show"} Prompt Editor</span>
              {showPromptEditor ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            
            {/* Show saved prompts count even when editor is closed */}
            {!showPromptEditor && savedPrompts.length > 0 && (
              <div className="text-xs text-[rgb(var(--muted-foreground))] text-center">
                You have {savedPrompts.length} saved prompt{savedPrompts.length > 1 ? 's' : ''}. Open the prompt editor to load them.
              </div>
            )}
            
            {showPromptEditor && (
              <div className="space-y-3 text-left border rounded-lg p-4 bg-[rgb(var(--muted))]/30">
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom-prompt" className="text-sm font-medium">
                    Custom Prompt (Optional)
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSavePromptDialog(true)}
                    disabled={isLoading || !customPrompt.trim()}
                    className="text-xs h-7 gap-1"
                  >
                    <Save className="h-3 w-3" />
                    Save Prompt
                  </Button>
                </div>
                <p className="text-xs text-[rgb(var(--muted-foreground))] mb-2">
                  Customize the prompt sent to the LLM. Use {"{CHAPTER_NAME}"} and {"{CHAPTER_TEXT}"} as placeholders.
                </p>
                
                {/* Saved Prompts Selector */}
                {savedPrompts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Saved Prompts</Label>
                    <div className="space-y-1">
                    <Select 
                      value={selectedPromptId || "__default__"} 
                      onValueChange={(value) => {
                        if (value === "__default__") {
                          setSelectedPromptId(null);
                          setCustomPrompt(DEFAULT_CHAPTER_PROMPT);
                        } else {
                          handleLoadPrompt(value);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Load a saved prompt..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Default Prompt</SelectItem>
                        {savedPrompts.map((prompt) => {
                          const avgRating = getAverageRating(prompt.ratings);
                          return (
                            <SelectItem key={prompt.id} value={prompt.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{prompt.name}</span>
                                {avgRating !== null && (
                                  <span className="text-xs text-[rgb(var(--muted-foreground))] ml-2">
                                    ⭐ {avgRating.toFixed(1)} ({prompt.ratings.length})
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                      {selectedPromptId && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[rgb(var(--muted-foreground))]">
                              Loaded: {savedPrompts.find(p => p.id === selectedPromptId)?.name}
                            </span>
                            {(() => {
                              const prompt = savedPrompts.find(p => p.id === selectedPromptId);
                              const avgRating = prompt ? getAverageRating(prompt.ratings) : null;
                              return avgRating !== null ? (
                                <span className="text-[rgb(var(--muted-foreground))]">
                                  ⭐ {avgRating.toFixed(1)} ({prompt?.ratings.length} ratings)
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const promptId = selectedPromptId;
                              setSavedPrompts((prev) => prev.filter((p) => p.id !== promptId));
                              setSelectedPromptId(null);
                              setCustomPrompt(DEFAULT_CHAPTER_PROMPT);
                            }}
                            className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-100"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Textarea
                  id="custom-prompt"
                  value={customPrompt}
                  onChange={(e) => {
                    setCustomPrompt(e.target.value);
                    setSelectedPromptId(null); // Clear selection when manually editing
                  }}
                  disabled={isLoading}
                  className="min-h-[200px] font-mono text-xs"
                  placeholder={DEFAULT_CHAPTER_PROMPT}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomPrompt(DEFAULT_CHAPTER_PROMPT);
                      setSelectedPromptId(null);
                    }}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    Reset to Default
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomPrompt(generatePromptPreview(selectedFiles));
                    }}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    Preview with File Names
                  </Button>
                </div>
              </div>
            )}

            {/* Save Prompt Dialog */}
            {showSavePromptDialog && (
              <div className="space-y-3 text-left border rounded-lg p-4 bg-[rgb(var(--card))] mt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Save Prompt</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSavePromptDialog(false);
                      setPromptName("");
                      setError(null);
                    }}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  type="text"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  placeholder="Enter a name for this prompt..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSavePrompt();
                    } else if (e.key === "Escape") {
                      setShowSavePromptDialog(false);
                      setPromptName("");
                    }
                  }}
                  className="text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSavePrompt}
                    disabled={!promptName.trim()}
                    className="text-xs flex-1"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowSavePromptDialog(false);
                      setPromptName("");
                      setError(null);
                    }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[rgb(var(--muted-foreground))]">
        Supported formats: PDF, EPUB, TXT, Markdown — up to 20MB per file. Multiple files will be processed chapter-by-chapter.
      </p>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

