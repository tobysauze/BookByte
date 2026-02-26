import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://bookbyte.app";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/discover`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const supabase = await createSupabaseServerClient();
  const { data: books } = await supabase
    .from("books")
    .select("id, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(5000);

  const bookRoutes: MetadataRoute.Sitemap = (books ?? []).map((book) => ({
    url: `${baseUrl}/books/${book.id}`,
    lastModified: new Date(book.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...bookRoutes];
}
