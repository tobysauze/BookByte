"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Tag,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Genre = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
};

type GenreTree = Genre & { children: Genre[] };

function buildTree(genres: Genre[]): GenreTree[] {
  const parents = genres
    .filter((g) => !g.parent_id)
    .sort((a, b) => a.name.localeCompare(b.name));
  return parents.map((p) => ({
    ...p,
    children: genres
      .filter((g) => g.parent_id === p.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

export function AdminGenresClient() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGenreName, setNewGenreName] = useState("");
  const [addingSubGenreFor, setAddingSubGenreFor] = useState<string | null>(
    null,
  );
  const [subGenreName, setSubGenreName] = useState("");
  const [expandedGenres, setExpandedGenres] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const fetchGenres = async () => {
    try {
      const res = await fetch("/api/genres");
      const data = await res.json();
      setGenres(data.genres || []);
    } catch {
      toast.error("Failed to load genres");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGenres();
  }, []);

  const tree = buildTree(genres);

  const toggleExpand = (id: string) => {
    setExpandedGenres((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenreName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGenreName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create genre");
      }
      toast.success(`Genre "${newGenreName.trim()}" created`);
      setNewGenreName("");
      await fetchGenres();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create genre",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSubGenre = async (parentId: string) => {
    if (!subGenreName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subGenreName.trim(), parentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create sub-genre");
      }
      toast.success(`Sub-genre "${subGenreName.trim()}" created`);
      setSubGenreName("");
      setAddingSubGenreFor(null);
      setExpandedGenres((prev) => new Set(prev).add(parentId));
      await fetchGenres();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create sub-genre",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (genre: Genre) => {
    const isParent = !genre.parent_id;
    const childCount = genres.filter((g) => g.parent_id === genre.id).length;
    const label = isParent
      ? `Delete "${genre.name}"${childCount > 0 ? ` and its ${childCount} sub-genre${childCount !== 1 ? "s" : ""}` : ""}?`
      : `Delete "${genre.name}"?`;
    if (!confirm(label)) return;

    try {
      const res = await fetch(`/api/genres?id=${genre.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete genre");
      toast.success(`"${genre.name}" deleted`);
      await fetchGenres();
    } catch {
      toast.error("Failed to delete genre");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--accent))]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          Admin
        </p>
        <h1 className="text-3xl font-semibold">Manage Genres</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Add, remove, and organise book genres and sub-genres.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add genre</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddGenre} className="flex gap-3">
            <Input
              placeholder="e.g. Psychology"
              value={newGenreName}
              onChange={(e) => setNewGenreName(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!newGenreName.trim() || submitting}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderTree className="h-5 w-5" />
            Genres ({tree.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {tree.length === 0 && (
            <p className="text-sm text-[rgb(var(--muted-foreground))] py-4 text-center">
              No genres yet. Add one above.
            </p>
          )}
          {tree.map((parent) => {
            const isExpanded = expandedGenres.has(parent.id);
            const hasChildren = parent.children.length > 0;
            const isAddingSub = addingSubGenreFor === parent.id;

            return (
              <div key={parent.id} className="border rounded-lg">
                <div className="flex items-center gap-2 px-4 py-3 hover:bg-[rgb(var(--muted))] transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleExpand(parent.id)}
                    className="p-0.5 rounded hover:bg-[rgb(var(--border))] transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[rgb(var(--muted-foreground))]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[rgb(var(--muted-foreground))]" />
                    )}
                  </button>
                  <Tag className="h-4 w-4 text-[rgb(var(--accent))]" />
                  <span className="flex-1 font-medium text-sm">
                    {parent.name}
                  </span>
                  {hasChildren && (
                    <Badge variant="secondary" className="text-xs">
                      {parent.children.length} sub
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setAddingSubGenreFor(isAddingSub ? null : parent.id);
                      setSubGenreName("");
                      if (!isExpanded) toggleExpand(parent.id);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Sub-genre
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(parent)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {isExpanded && (
                  <div className="border-t bg-[rgb(var(--muted))]/30">
                    {isAddingSub && (
                      <div className="flex items-center gap-2 px-4 py-2 pl-12">
                        <Input
                          autoFocus
                          placeholder="Sub-genre name..."
                          value={subGenreName}
                          onChange={(e) => setSubGenreName(e.target.value)}
                          className="h-8 flex-1 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddSubGenre(parent.id);
                            }
                            if (e.key === "Escape") {
                              setAddingSubGenreFor(null);
                              setSubGenreName("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          disabled={!subGenreName.trim() || submitting}
                          onClick={() => handleAddSubGenre(parent.id)}
                        >
                          Add
                        </Button>
                      </div>
                    )}
                    {parent.children.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-2 px-4 py-2 pl-12 hover:bg-[rgb(var(--muted))] transition-colors group"
                      >
                        <span className="text-[rgb(var(--muted-foreground))]">
                          ↳
                        </span>
                        <span className="flex-1 text-sm">{child.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(child)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {!hasChildren && !isAddingSub && (
                      <p className="px-4 py-3 pl-12 text-xs text-[rgb(var(--muted-foreground))]">
                        No sub-genres yet
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
