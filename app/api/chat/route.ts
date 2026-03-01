import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { SummaryPayload } from "@/lib/schemas";

function extractSummaryText(
  summary: SummaryPayload,
  title: string,
  author: string | null,
): string {
  const lines: string[] = [];
  const byLine = author ? ` by ${author}` : "";
  lines.push(`## "${title}"${byLine}`);

  const s = summary as Record<string, unknown>;

  if (typeof s.raw_text === "string") {
    lines.push(s.raw_text.slice(0, 15000));
    return lines.join("\n\n");
  }

  if (typeof s.quick_summary === "string") {
    lines.push("### Overview");
    lines.push(s.quick_summary);
  }

  if (Array.isArray(s.key_ideas)) {
    lines.push("### Key Ideas");
    for (const idea of s.key_ideas) {
      if (idea && typeof idea === "object" && "title" in idea) {
        lines.push(`**${idea.title}**: ${idea.text}`);
      }
    }
  }

  if (Array.isArray(s.chapters)) {
    lines.push("### Chapters");
    for (const ch of s.chapters) {
      if (ch && typeof ch === "object" && "title" in ch) {
        lines.push(`**${ch.title}**: ${ch.summary}`);
      }
    }
  }

  if (Array.isArray(s.actionable_insights)) {
    lines.push("### Actionable Insights");
    for (const ins of s.actionable_insights) {
      if (typeof ins === "string") lines.push(`- ${ins}`);
    }
  }

  if (Array.isArray(s.quotes)) {
    lines.push("### Notable Quotes");
    for (const q of s.quotes) {
      if (typeof q === "string") lines.push(`- "${q}"`);
    }
  }

  return lines.join("\n\n");
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    const { messages, bookIds } = await request.json();

    if (
      !Array.isArray(messages) ||
      !Array.isArray(bookIds) ||
      bookIds.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "Messages and at least one book are required" }),
        { status: 400 },
      );
    }

    if (bookIds.length > 10) {
      return new Response(
        JSON.stringify({ error: "Maximum 10 books per chat" }),
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Chat is not configured" }),
        { status: 500 },
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: books, error } = await supabase
      .from("books")
      .select("id, title, author, summary, category")
      .in("id", bookIds);

    if (error || !books || books.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to load selected books" }),
        { status: 500 },
      );
    }

    const bookContext = books
      .map((b) => extractSummaryText(b.summary, b.title, b.author))
      .join("\n\n---\n\n");

    const bookTitles = books
      .map((b) => `"${b.title}"${b.author ? ` by ${b.author}` : ""}`)
      .join(", ");

    const systemPrompt = `You are BookByte AI, a knowledgeable assistant that answers questions using ONLY the book summaries provided below. You have access to summaries of the following books: ${bookTitles}.

RULES:
1. ONLY use information from the provided book summaries. Do NOT use your general knowledge.
2. Always cite which book the information comes from using **[Book Title]** format after the relevant point.
3. If the user asks something not covered by the provided summaries, clearly say: "I couldn't find information about that in the selected book summaries."
4. Be concise, helpful, and conversational.
5. When comparing ideas across books, clearly attribute each idea to its source.
6. You may synthesise and connect ideas across the selected books when relevant.

=== BOOK SUMMARIES ===

${bookContext}

=== END OF BOOK SUMMARIES ===`;

    const openRouterMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          "X-Title": "BookByte",
        },
        body: JSON.stringify({
          model,
          messages: openRouterMessages,
          stream: true,
          temperature: 0.4,
        }),
      },
    );

    if (!response.ok || !response.body) {
      const errBody = await response.text().catch(() => "Unknown error");
      console.error("OpenRouter error:", errBody);
      return new Response(
        JSON.stringify({ error: "Failed to generate response" }),
        { status: 502 },
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Error in POST /api/chat:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 },
    );
  }
}
