import { NextRequest, NextResponse } from "next/server";
import { expandSummaryToTarget } from "@/lib/openrouter";
import { summarySchema, rawTextSummarySchema, flexibleSummarySchema, type SummaryPayload } from "@/lib/schemas";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export const runtime = "nodejs";

type ExpandRequest = {
  summary: SummaryPayload;
  originalText: string;
  title?: string;
  author?: string;
  model?: string;
  targetWordCount?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to expand summaries." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as ExpandRequest;
    const { summary, originalText, title, author, model, targetWordCount } = body;

    if (!summary || !originalText) {
      return NextResponse.json(
        { error: "Summary and original text are required." },
        { status: 400 },
      );
    }

    // Expand the summary
    console.log(`[Expand] Starting expansion for summary...`);
    const expandedSummary = await expandSummaryToTarget(
      summary,
      originalText,
      title,
      author,
      model,
      targetWordCount,
    );

    // Validate the expanded summary - try raw text first, then structured, then flexible
    let validatedSummary: SummaryPayload;
    
    // Check if it's raw text format
    const rawTextValidation = rawTextSummarySchema.safeParse(expandedSummary);
    if (rawTextValidation.success) {
      validatedSummary = rawTextValidation.data;
    } else {
      // Try structured schema (legacy format)
      const structuredValidation = summarySchema.safeParse(expandedSummary);
      if (structuredValidation.success) {
        validatedSummary = structuredValidation.data;
      } else {
        // Try flexible schema (for custom prompts)
        const flexibleValidation = flexibleSummarySchema.safeParse(expandedSummary);
        if (flexibleValidation.success) {
          validatedSummary = flexibleValidation.data;
        } else {
          // If all validation fails, return the expanded summary as-is (it should be valid from expandSummaryToTarget)
          console.warn("[Expand] Validation failed, but returning expanded summary anyway:", {
            rawTextError: rawTextValidation.error?.format(),
            structuredError: structuredValidation.error?.format(),
            flexibleError: flexibleValidation.error?.format(),
          });
          validatedSummary = expandedSummary;
        }
      }
    }

    const result = NextResponse.json({
      summary: validatedSummary,
    });

    // Merge auth cookies
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });

    return result;
  } catch (error) {
    console.error("Error expanding summary:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}
