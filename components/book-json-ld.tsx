import type { SupabaseSummary } from "@/lib/supabase";

type Props = { book: SupabaseSummary };

export function BookJsonLd({ book }: Props) {
  const s = book.summary as Record<string, unknown> | null;

  let description = "";
  if (book.description) {
    description = book.description;
  } else if (s && typeof s === "object") {
    if (typeof s.short_summary === "string") description = s.short_summary;
    else if (typeof s.quick_summary === "string")
      description = (s.quick_summary as string).slice(0, 300);
  }

  const wordCount =
    book.word_count ??
    (s && typeof s === "object" && typeof s.raw_text === "string"
      ? (s.raw_text as string).split(/\s+/).length
      : undefined);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    ...(book.author ? { author: { "@type": "Person", name: book.author } } : {}),
    ...(description ? { description } : {}),
    ...(book.cover_url ? { image: book.cover_url } : {}),
    ...(book.category ? { genre: book.category } : {}),
    ...(book.created_at ? { datePublished: book.created_at.split("T")[0] } : {}),
    url: `https://bookbyte.app/books/${book.id}`,
    ...(wordCount ? { wordCount } : {}),
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: "BookByte",
      url: "https://bookbyte.app",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
