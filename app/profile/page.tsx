import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="space-y-6 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-10 text-center">
        <h1 className="text-3xl font-semibold">Account required</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          You must be logged in to access your profile.
        </p>
        <Button asChild>
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          Profile
        </p>
        <h1 className="text-3xl font-semibold">{user.email}</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Manage your account preferences and see your reading impact.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <h2 className="text-lg font-semibold">Library stats</h2>
          <p className="mt-2 text-sm text-[rgb(var(--muted-foreground))]">
            Books summarized
          </p>
          <p className="text-4xl font-semibold">{count ?? 0}</p>
        </div>
        <div className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
          <h2 className="text-lg font-semibold">Want to explore more?</h2>
          <p className="mt-2 text-sm text-[rgb(var(--muted-foreground))]">
            Discover curated picks or upload your next read.
          </p>
          <div className="mt-4 flex gap-3">
            <Button asChild>
              <Link href="/discover">Discover</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">Upload a book</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

