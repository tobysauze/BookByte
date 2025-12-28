import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length?: number;
  created?: number; // Unix timestamp for sorting by release date
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { OPENROUTER_API_KEY } = process.env;

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch models from OpenRouter" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawModels = data.data || [];

    // Map and filter models to ensure we have correct structure
    const models: OpenRouterModel[] = rawModels
      .filter((model: any) => {
        // Only include models that support text output (for summarization)
        // Exclude embedding-only models
        const outputModalities = model.architecture?.output_modalities || [];
        const hasTextOutput = outputModalities.includes("text");
        const isEmbeddingOnly = outputModalities.length === 1 && outputModalities.includes("embeddings");
        
        return hasTextOutput && !isEmbeddingOnly;
      })
      .map((model: any) => {
        // Convert per-token pricing to per-million-token pricing
        // OpenRouter returns pricing per token, so multiply by 1M
        const promptPerMillion = model.pricing?.prompt 
          ? (parseFloat(model.pricing.prompt) * 1_000_000).toFixed(2)
          : "0";
        const completionPerMillion = model.pricing?.completion
          ? (parseFloat(model.pricing.completion) * 1_000_000).toFixed(2)
          : "0";

        return {
          id: model.id,
          name: model.name || model.id,
          description: model.description,
          pricing: {
            prompt: promptPerMillion,
            completion: completionPerMillion,
          },
          context_length: model.context_length,
          created: model.created, // Include creation timestamp
          architecture: model.architecture,
          top_provider: model.top_provider,
        };
      });

    // Don't sort here - let the frontend handle sorting based on user preference
    // Just return all models in a consistent order (alphabetical by default)
    const sortedModels = models.sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({
      models: sortedModels,
    });
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch models" },
      { status: 500 }
    );
  }
}

