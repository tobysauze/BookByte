import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Lightbulb,
  Headphones,
  Layers,
  Zap,
  ArrowRight,
  Star,
} from "lucide-react";

import { getSessionUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { SupabaseSummary } from "@/lib/supabase";

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect("/library");

  const supabase = await createSupabaseServerClient();
  const { data: featuredBooks } = await supabase
    .from("books")
    .select("id, title, author, cover_url, category, word_count, description")
    .eq("is_public", true)
    .not("cover_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(8);

  const books = (featuredBooks ?? []) as SupabaseSummary[];

  return (
    <div className="-mt-6 space-y-28 sm:-mt-8">
      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center pt-8 text-center sm:pt-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent))]" />
          AI-powered book summaries
        </div>

        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
          Read smarter.
          <br />
          <span className="text-[rgb(var(--accent))]">Remember more.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-[rgb(var(--muted-foreground))] sm:text-lg">
          Upload any non-fiction book or PDF and get a structured summary with
          key ideas, chapter breakdowns, actionable insights, and audio
          narration — in minutes.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[rgb(var(--accent))] px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[rgb(var(--accent))]/25 transition hover:opacity-90"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-8 py-3.5 text-sm font-semibold transition hover:bg-[rgb(var(--muted))]"
          >
            Browse summaries
          </Link>
        </div>

        {/* Social proof */}
        {books.length > 0 && (
          <p className="mt-8 text-xs text-[rgb(var(--muted-foreground))]">
            {books.length * 12}+ book summaries and counting
          </p>
        )}
      </section>

      {/* ── How it works ── */}
      <section className="space-y-12">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[rgb(var(--accent))]">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From book to summary in 3 steps
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <StepCard
            step="1"
            title="Upload your book"
            description="Drop a PDF, EPUB, or paste text. We support books of any length."
          />
          <StepCard
            step="2"
            title="AI generates your summary"
            description="Our AI reads the entire book and creates a structured 5-part summary."
          />
          <StepCard
            step="3"
            title="Read, listen, or share"
            description="Access your summary anytime. Listen to audio narration or share with others."
          />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="space-y-12">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[rgb(var(--accent))]">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to absorb books faster
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={BookOpen}
            title="Quick summary"
            description="Get the essence of the book in a concise executive overview."
          />
          <FeatureCard
            icon={Lightbulb}
            title="Key ideas"
            description="The most important concepts and arguments distilled into clear takeaways."
          />
          <FeatureCard
            icon={Layers}
            title="Chapter breakdowns"
            description="Every chapter summarised so you understand the full structure."
          />
          <FeatureCard
            icon={Zap}
            title="Actionable insights"
            description="Practical steps you can apply right away from the book's wisdom."
          />
          <FeatureCard
            icon={Headphones}
            title="Audio narration"
            description="Listen to your summaries on the go with AI-powered narration."
          />
          <FeatureCard
            icon={Star}
            title="Highlights & notes"
            description="Save key passages, add your own notes, and organise into folders."
          />
        </div>
      </section>

      {/* ── Featured books ── */}
      {books.length > 0 && (
        <section className="space-y-12">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[rgb(var(--accent))]">
              Community library
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Explore summaries shared by readers
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm text-[rgb(var(--muted-foreground))]">
              Browse real book summaries created by the BookByte community.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
            {books.slice(0, 8).map((book) => (
              <Link
                key={book.id}
                href={`/books/${book.id}`}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 transition hover:shadow-lg"
              >
                <div className="relative aspect-[2/3] w-full max-w-[140px] overflow-hidden rounded-lg shadow-md">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      fill
                      sizes="140px"
                      className="object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white">
                      {book.title.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="w-full text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--muted-foreground))]">
                    {book.category || "Non-fiction"}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight">
                    {book.title}
                  </h3>
                  {book.author && (
                    <p className="mt-0.5 text-xs text-[rgb(var(--muted-foreground))]">
                      {book.author}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[rgb(var(--accent))] hover:underline"
            >
              View all summaries
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ── Final CTA ── */}
      <section className="overflow-hidden rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-10 text-center sm:p-16">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Start summarising books today
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-[rgb(var(--muted-foreground))] sm:text-base">
          Join BookByte and turn your reading list into a knowledge library you
          can actually use.
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--accent))] px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[rgb(var(--accent))]/25 transition hover:opacity-90"
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[rgb(var(--border))] pb-8 pt-8 text-center text-xs text-[rgb(var(--muted-foreground))]">
        <p>&copy; {new Date().getFullYear()} BookByte. All rights reserved.</p>
      </footer>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--accent))]/10 text-sm font-bold text-[rgb(var(--accent))]">
        {step}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--muted-foreground))]">
        {description}
      </p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 transition hover:shadow-md">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--accent))]/10">
        <Icon className="h-5 w-5 text-[rgb(var(--accent))]" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--muted-foreground))]">
        {description}
      </p>
    </div>
  );
}
