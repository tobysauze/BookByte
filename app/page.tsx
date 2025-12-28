import { Suspense } from "react";
import { redirect } from "next/navigation";

import { HomeClient } from "@/components/home-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth";
import { getUserRole } from "@/lib/user-roles";

export default async function HomePage() {
  const user = await getSessionUser();
  
  // Temporarily disable redirect until user_profiles table is set up
  // const userRole = await getUserRole();
  // if (user && userRole === "regular") {
  //   redirect("/discover");
  // }

  return (
    <div className="space-y-12">
      <header className="space-y-4 text-center md:text-left">
        <BadgeHero />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Turn any book into a 5-part AI summary in minutes
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[rgb(var(--muted-foreground))] md:text-base">
          Upload a non-fiction book or PDF and BookByte will craft a quick summary, key ideas, chapter breakdowns, actionable insights, and an audio recap powered by OpenAI and ElevenLabs.
        </p>
      </header>

      <Suspense fallback={<HomeLoading />}>
        <HomeClient initialUserEmail={user?.email ?? null} />
      </Suspense>
    </div>
  );
}

function HomeLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function BadgeHero() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
      <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent))]" />
      AI summaries in 5 sections
    </div>
  );
}
