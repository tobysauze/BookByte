import { NextRequest, NextResponse } from "next/server";

import { generateSpeechFromText } from "@/lib/elevenlabs";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { SummaryPayload } from "@/lib/schemas";

export const runtime = "nodejs";

type SummarySectionKey = keyof SummaryPayload;

const SECTION_LABELS: Record<SummarySectionKey, string> = {
  quick_summary: "Quick Summary",
  key_ideas: "Key Ideas",
  chapters: "Chapters",
  actionable_insights: "Insights",
  quotes: "Quotes",
};

export async function POST(request: NextRequest) {
  try {
    const { bookId, section } = (await request.json()) as {
      bookId?: string;
      section?: string;
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

    const { data: book, error } = await supabase
      .from("books")
      .select("id, user_id, title, summary, audio_urls")
      .eq("id", bookId)
      .maybeSingle();

    if (error || !book) {
      console.error(error);
      return NextResponse.json(
        { error: "Book not found" },
        { status: 404 },
      );
    }

    if (book.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sectionText = extractSectionText(book.summary as SummaryPayload, sectionKey);

    const audioBuffer = await generateSpeechFromText({
      text: sectionText,
    });

    const adminClient = getSupabaseAdminClient();
    const path = `${book.id}/${sectionKey}.mp3`;
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

    const updatedAudioUrls = {
      ...(book.audio_urls ?? {}),
      [sectionKey]: publicUrl,
    } as Partial<Record<SummarySectionKey, string>>;
    const { error: updateError } = await adminClient
      .from("books")
      .update({ audio_urls: updatedAudioUrls })
      .eq("id", book.id);

    if (updateError) {
      console.error(updateError);
    }

    const result = NextResponse.json({ audioUrl: publicUrl });
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

function extractSectionText(summary: SummaryPayload, section: SummarySectionKey) {
  switch (section) {
    case "quick_summary":
      return summary.quick_summary;
    case "key_ideas":
      return summary.key_ideas
        .map((idea) => `${idea.title}: ${idea.text}`)
        .join("\n");
    case "chapters":
      return summary.chapters
        .map((chapter) => `${chapter.title}: ${chapter.summary}`)
        .join("\n");
    case "actionable_insights":
      return summary.actionable_insights.join("\n");
    case "quotes":
      return summary.quotes.join("\n");
    default:
      return JSON.stringify(summary);
  }
}

