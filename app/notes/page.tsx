import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";
import { NotesClient } from "@/components/notes-client";

export const runtime = "nodejs";

export default async function NotesPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const { data: notes, error } = await supabase
    .from("user_notes")
    .select("id, user_id, book_id, title, content, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error loading notes:", error);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          Notes
        </p>
        <h1 className="text-3xl font-semibold">Your notes</h1>
        <p className="max-w-2xl text-sm text-[rgb(var(--muted-foreground))]">
          Collect highlights and write your own notes. Export them as TXT, PDF, or Word documents.
        </p>
      </header>

      <NotesClient initialNotes={(notes ?? []) as any} />
    </div>
  );
}

