import { createSupabaseServerClient } from "@/lib/supabase";

export type Genre = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
};

export type GenreTree = Genre & {
  children: Genre[];
};

export function buildGenreTree(genres: Genre[]): GenreTree[] {
  const parents = genres
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.name.localeCompare(b.name));

  return parents.map((parent) => ({
    ...parent,
    children: genres
      .filter((g) => g.parent_id === parent.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/**
 * Given a category/genre name, return all category names that should match.
 * Parent genres expand to include all sub-genre names.
 */
export async function getMatchingCategories(
  categoryName: string,
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data: genre } = await supabase
    .from("genres")
    .select("id, name, parent_id")
    .eq("name", categoryName)
    .single();

  if (!genre) return [categoryName];

  if (genre.parent_id) {
    return [genre.name];
  }

  const { data: subGenres } = await supabase
    .from("genres")
    .select("name")
    .eq("parent_id", genre.id);

  return [genre.name, ...(subGenres ?? []).map((g) => g.name)];
}
