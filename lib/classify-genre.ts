import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o";

type GenreRow = { id: string; name: string; parent_id: string | null };

/**
 * Uses the LLM to pick the best-matching genre (or sub-genre) for a book
 * based on its title, author, and summary text. Falls back to "Non-Fiction"
 * if the LLM is unavailable or returns an unrecognised name.
 */
export async function classifyBookGenre(
  title: string,
  author: string | null,
  summaryText: string,
): Promise<string> {
  const fallback = "Non-Fiction";

  if (!OPENROUTER_API_KEY) return fallback;

  try {
    const admin = getSupabaseAdminClient();
    const { data: genres } = await admin
      .from("genres")
      .select("id, name, parent_id")
      .order("name");

    if (!genres || genres.length === 0) return fallback;

    const genreRows = genres as GenreRow[];
    const parents = genreRows.filter((g) => !g.parent_id);
    const genreList = parents
      .map((p) => {
        const children = genreRows.filter((g) => g.parent_id === p.id);
        if (children.length === 0) return `- ${p.name}`;
        return `- ${p.name}\n${children.map((c) => `  - ${c.name}`).join("\n")}`;
      })
      .join("\n");

    const allNames = new Set(genreRows.map((g) => g.name.toLowerCase()));

    const snippet = summaryText.slice(0, 3000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 60,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are a book genre classifier. Given a book's title, author, and a snippet of its summary, pick the single most appropriate genre from the provided list. Reply with ONLY the genre name exactly as it appears in the list — nothing else.",
          },
          {
            role: "user",
            content: `Available genres:\n${genreList}\n\nBook title: ${title}\nAuthor: ${author ?? "Unknown"}\n\nSummary snippet:\n${snippet}\n\nWhich genre best fits this book? Reply with only the genre name.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Genre classification API error:", response.status);
      return fallback;
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const result = json.choices?.[0]?.message?.content?.trim();
    if (!result) return fallback;

    if (allNames.has(result.toLowerCase())) {
      const matched = genreRows.find(
        (g) => g.name.toLowerCase() === result.toLowerCase(),
      );
      return matched?.name ?? fallback;
    }

    const fuzzy = genreRows.find((g) =>
      result.toLowerCase().includes(g.name.toLowerCase()),
    );
    return fuzzy?.name ?? fallback;
  } catch (err) {
    console.error("Genre classification failed:", err);
    return fallback;
  }
}
