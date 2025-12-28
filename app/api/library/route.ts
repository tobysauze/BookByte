import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { summarySchema, flexibleSummarySchema, rawTextSummarySchema } from "@/lib/schemas";

export const runtime = "nodejs";

type SavePayload = {
  summary: unknown;
  metadata: {
    title: string;
    author?: string | null;
    coverUrl?: string | null;
    fileUrl?: string | null;
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SavePayload;
    
    // Try raw text schema first (new format), then strict schema, then flexible schema
    let parsedSummary: z.SafeParseReturnType<any, any> = rawTextSummarySchema.safeParse(body.summary);
    
    if (!parsedSummary.success) {
      // Try structured schema (legacy format)
      parsedSummary = summarySchema.safeParse(body.summary);
      
      if (!parsedSummary.success) {
        // If strict validation fails, try flexible validation (for custom prompts)
        const flexibleResult = flexibleSummarySchema.safeParse(body.summary);
        if (flexibleResult.success) {
          parsedSummary = flexibleResult;
        } else {
          return NextResponse.json(
            { error: "Summary payload is invalid", issues: parsedSummary.error.format() },
            { status: 400 },
          );
        }
      }
    }

    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { metadata } = body;
    
    // Check if user is an editor
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("is_editor")
      .eq("id", user.id)
      .single();

    const isEditor = userProfile?.is_editor ?? false;
    
    const insertPayload = {
      user_id: user.id,
      title: metadata.title,
      author: metadata.author ?? null,
      cover_url: metadata.coverUrl ?? null,
      file_url: metadata.fileUrl ?? null,
      summary: parsedSummary.data,
      audio_urls: {},
      progress_percent: 0,
      is_public: false,
      is_editor_created: isEditor,
    };

    const { data, error } = await supabase
      .from("books")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error(error);
      throw new Error("Failed to save summary.");
    }

    const response = NextResponse.json({ bookId: data?.id });
    authResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

