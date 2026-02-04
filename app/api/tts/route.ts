import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateSpeechFromText } from "@/lib/elevenlabs";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { SummaryPayload } from "@/lib/schemas";
import { summarySchema } from "@/lib/schemas";

export const runtime = "nodejs";

// Only use structured summary keys (not raw_text variant)
type SummarySectionKey = keyof z.infer<typeof summarySchema>;

const SECTION_LABELS: Record<SummarySectionKey, string> = {
  quick_summary: "Quick Summary",
  short_summary: "Short Summary",
  key_ideas: "Key Ideas",
  chapters: "Chapters",
  actionable_insights: "Insights",
  quotes: "Quotes",
  ai_provider: "AI Provider",
};

function narrationKey(params: { voiceId: string; modelId: string; section: string }) {
  return `voice:${params.voiceId}|model:${params.modelId}|section:${params.section}`;
}

export async function POST(request: NextRequest) {
  try {
    const { bookId, section, voiceId, modelId } = (await request.json()) as {
      bookId?: string;
      section?: string;
      voiceId?: string;
      modelId?: string;
    };

    if (!bookId || !section) {
      return NextResponse.json(
        { error: "bookId and section are required." },
        { status: 400 },
      );
    }

    if (!Object.keys(SECTION_LABELS).includes(section)) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }

    const sectionKey = section as SummarySectionKey;

    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to generate audio." },
        { status: 401 },
      );
    }

    // Must be able to SELECT the book (RLS: owner or public).
    const { data: book, error } = await supabase
      .from("books")
      .select("id, user_id, title, summary, audio_urls, is_public")
      .eq("id", bookId)
      .maybeSingle();

    if (error || !book) {
      console.error(error);
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 },
      );
    }

    const adminClient = getSupabaseAdminClient();

    const resolvedVoiceId = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
    const resolvedModelId = modelId ?? process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

    // Check shared narration cache first.
    const { data: cached } = await supabase
      .from("book_audio_narrations")
      .select("audio_url")
      .eq("book_id", book.id)
      .eq("section", sectionKey)
      .eq("voice_id", resolvedVoiceId)
      .eq("model_id", resolvedModelId)
      .maybeSingle();

    if (cached?.audio_url) {
      const result = NextResponse.json({ audioUrl: cached.audio_url, cached: true });
      authResponse.cookies.getAll().forEach((cookie) => {
        result.cookies.set(cookie);
      });
      return result;
    }

    const sectionText = extractSectionText(book.summary as SummaryPayload, sectionKey);

    const audioBuffer = await generateSpeechFromText({
      text: sectionText,
      voiceId: resolvedVoiceId,
      modelId: resolvedModelId,
    });

    const path = `narrations/${book.id}/${resolvedVoiceId}/${resolvedModelId}/${sectionKey}.mp3`;
    const { error: uploadError } = await adminClient.storage
      .from("audio")
      .upload(path, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      throw new Error("Failed to upload audio to Supabase storage.");
    }

    const {
      data: { publicUrl },
    } = adminClient.storage.from("audio").getPublicUrl(path);

    // Save into shared narration cache (dedup by book+section+voice+model).
    await adminClient
      .from("book_audio_narrations")
      .upsert(
        {
          book_id: book.id,
          section: sectionKey,
          voice_id: resolvedVoiceId,
          model_id: resolvedModelId,
          audio_url: publicUrl,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "book_id,section,voice_id,model_id" },
      );

    // Back-compat: keep books.audio_urls populated.
    // Store a voice/model-specific key so multiple voices can coexist.
    const updatedAudioUrls = {
      ...(book.audio_urls ?? {}),
      [narrationKey({ voiceId: resolvedVoiceId, modelId: resolvedModelId, section: sectionKey })]: publicUrl,
    } as Record<string, string>;

    // Also store sectionKey -> url for the default configured voice/model (so existing UI continues to work).
    const isDefaultVoice =
      resolvedVoiceId === (process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM") &&
      resolvedModelId === (process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2");
    if (isDefaultVoice) {
      updatedAudioUrls[sectionKey] = publicUrl;
    }

    const { error: updateError } = await adminClient
      .from("books")
      .update({ audio_urls: updatedAudioUrls })
      .eq("id", book.id);
    if (updateError) console.error(updateError);

    const result = NextResponse.json({ audioUrl: publicUrl, cached: false });
    authResponse.cookies.getAll().forEach((cookie) => {
      result.cookies.set(cookie);
    });
    return result;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

function extractSectionText(summary: SummaryPayload, section: SummarySectionKey): string {
  // Raw text fallback
  const isRawText =
    summary &&
    typeof summary === "object" &&
    "raw_text" in summary &&
    typeof (summary as Record<string, unknown>).raw_text === "string";
  if (isRawText) {
    return (summary as { raw_text: string }).raw_text;
  }

  // Type guard to ensure summary is structured
  if (!("quick_summary" in summary) || typeof (summary as any).quick_summary !== "string") {
    throw new Error("Cannot extract section text from this summary format");
  }

  const structuredSummary = summary as z.infer<typeof summarySchema>;
  
  switch (section) {
    case "quick_summary":
      return structuredSummary.quick_summary;
    case "short_summary":
      return structuredSummary.short_summary;
    case "key_ideas":
      return structuredSummary.key_ideas
        .map((idea) => `${idea.title}: ${idea.text}`)
        .join("\n");
    case "chapters":
      return structuredSummary.chapters
        .map((chapter) => `${chapter.title}: ${chapter.summary}`)
        .join("\n");
    case "actionable_insights":
      return structuredSummary.actionable_insights.join("\n");
    case "quotes":
      return structuredSummary.quotes.join("\n");
    case "ai_provider":
      return structuredSummary.ai_provider || "Unknown";
    default:
      return JSON.stringify(summary);
  }
}

