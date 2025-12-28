"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Trash2, LayoutGrid, List, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useFolders } from "@/lib/use-folders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FoldersSidebar } from "@/components/folders-sidebar";

const HIGHLIGHT_COLORS = {
  yellow: { border: "border-yellow-200/40", bg: "bg-yellow-50/30", darkBg: "dark:bg-yellow-800/20" },
  green: { border: "border-green-200/40", bg: "bg-green-50/30", darkBg: "dark:bg-green-800/20" },
  blue: { border: "border-blue-200/40", bg: "bg-blue-50/30", darkBg: "dark:bg-blue-800/20" },
  pink: { border: "border-pink-200/40", bg: "bg-pink-50/30", darkBg: "dark:bg-pink-800/20" },
  purple: { border: "border-purple-200/40", bg: "bg-purple-50/30", darkBg: "dark:bg-purple-800/20" },
  orange: { border: "border-orange-200/40", bg: "bg-orange-50/30", darkBg: "dark:bg-orange-800/20" },
} as const;

function getHighlightColorClasses(color: string = "yellow") {
  const colorDef = HIGHLIGHT_COLORS[color as keyof typeof HIGHLIGHT_COLORS] || HIGHLIGHT_COLORS.yellow;
  return `${colorDef.border} ${colorDef.bg} ${colorDef.darkBg}`;
}

type ViewMode = "card" | "list";

type Highlight = {
  id: string;
  book_id: string;
  section: string;
  item_index: number;
  highlighted_text: string;
  color?: string;
  created_at: string;
  books?: {
    id: string;
    title: string;
    author: string | null;
    cover_url: string | null;
  };
};

export default function FolderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.id as string;
  const { removeHighlightFromFolder } = useFolders();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [folder, setFolder] = useState<{ id: string; name: string; color: string } | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFolderHighlights = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/folders/highlights?folderId=${folderId}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch folder highlights");
        }

        const data = await response.json();
        setFolder(data.folder);
        setHighlights(data.highlights || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch folder highlights");
        console.error("Error fetching folder highlights:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (folderId) {
      fetchFolderHighlights();
    }
  }, [folderId]);

  const handleRemoveFromFolder = async (highlightId: string) => {
    try {
      await removeHighlightFromFolder(folderId, highlightId);
      toast.success("Highlight removed from folder");
      setHighlights(highlights.filter(h => h.id !== highlightId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove highlight from folder");
    }
  };

  const navigateToHighlight = (highlight: Highlight) => {
    const url = `/books/${highlight.book_id}?section=${highlight.section}&itemIndex=${highlight.item_index}&highlightId=${highlight.id}`;
    router.push(url);
  };

  // Group highlights by book
  const highlightsByBook = highlights.reduce((acc, highlight) => {
    const bookId = highlight.book_id;
    if (!acc[bookId]) {
      acc[bookId] = {
        book: highlight.books || {
          id: bookId,
          title: "Unknown Book",
          author: null,
          cover_url: null,
        },
        highlights: [],
      };
    }
    acc[bookId].highlights.push(highlight);
    return acc;
  }, {} as Record<string, { book: { id: string; title: string; author: string | null; cover_url: string | null }; highlights: Highlight[] }>);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        <FoldersSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--accent))] mx-auto mb-4"></div>
            <p className="text-[rgb(var(--muted-foreground))]">Loading folder highlights...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        <FoldersSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error || "Folder not found"}</p>
            <Button onClick={() => router.push("/highlights")}>Back to Highlights</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <FoldersSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/highlights")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{folder.name}</h1>
                <p className="text-[rgb(var(--muted-foreground))] mt-2">
                  {highlights.length} highlight{highlights.length !== 1 ? "s" : ""} across {Object.keys(highlightsByBook).length} book{Object.keys(highlightsByBook).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "card" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("card")}
                className="flex items-center gap-2"
              >
                <LayoutGrid className="h-4 w-4" />
                Card
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex items-center gap-2"
              >
                <List className="h-4 w-4" />
                List
              </Button>
            </div>
          </div>

          {highlights.length === 0 ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center space-y-4">
                <p className="text-lg text-[rgb(var(--muted-foreground))]">No highlights in this folder yet</p>
                <p className="text-sm text-[rgb(var(--muted-foreground))]">
                  Drag and drop highlights from the All Highlights page to add them here
                </p>
              </div>
            </div>
          ) : viewMode === "card" ? (
            <div className="space-y-8">
              {Object.values(highlightsByBook).map(({ book, highlights: bookHighlights }) => (
                <Card key={book.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start gap-4">
                      {book.cover_url ? (
                        <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[rgb(var(--accent))] to-purple-500">
                          <Image
                            src={book.cover_url}
                            alt={book.title}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-24 w-16 flex-shrink-0 rounded-lg bg-gradient-to-br from-[rgb(var(--accent))] to-purple-500"></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl mb-1">{book.title}</CardTitle>
                        {book.author && (
                          <p className="text-sm text-[rgb(var(--muted-foreground))]">{book.author}</p>
                        )}
                        <Badge variant="secondary" className="mt-2">
                          {bookHighlights.length} highlight{bookHighlights.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {bookHighlights.map((highlight) => {
                      const sectionNames: Record<string, string> = {
                        quick_summary: "Quick Summary",
                        key_ideas: "Key Ideas",
                        chapters: "Chapters",
                        actionable_insights: "Actionable Insights",
                        quotes: "Quotes",
                      };

                      return (
                        <div
                          key={highlight.id}
                          className="p-4 border rounded-lg hover:bg-[rgb(var(--muted))] transition-colors cursor-pointer group"
                          onClick={() => navigateToHighlight(highlight)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {sectionNames[highlight.section] || highlight.section}
                                </Badge>
                                {highlight.section === "chapters" || highlight.section === "key_ideas" || highlight.section === "actionable_insights" || highlight.section === "quotes" ? (
                                  <span className="text-xs text-[rgb(var(--muted-foreground))]">
                                    Item {highlight.item_index + 1}
                                  </span>
                                ) : null}
                              </div>
                              <blockquote className={`text-[rgb(var(--foreground))] leading-relaxed border-l-4 pl-4 py-2 rounded-r ${getHighlightColorClasses(highlight.color || "yellow")}`}>
                                "{highlight.highlighted_text}"
                              </blockquote>
                              <p className="text-xs text-[rgb(var(--muted-foreground))] mt-2">
                                {new Date(highlight.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFromFolder(highlight.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-0">
              {highlights.map((highlight) => {
                const sectionNames: Record<string, string> = {
                  quick_summary: "Quick Summary",
                  key_ideas: "Key Ideas",
                  chapters: "Chapters",
                  actionable_insights: "Actionable Insights",
                  quotes: "Quotes",
                };

                const book = highlight.books || {
                  id: highlight.book_id,
                  title: "Unknown Book",
                  author: null,
                  cover_url: null,
                };

                return (
                  <div
                    key={highlight.id}
                    className="p-2 border-b hover:bg-[rgb(var(--muted))] transition-colors cursor-pointer group"
                    onClick={() => navigateToHighlight(highlight)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-[rgb(var(--foreground))]">
                            {book.title}
                          </span>
                          {book.author && (
                            <span className="text-xs text-[rgb(var(--muted-foreground))]">
                              • {book.author}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                            {sectionNames[highlight.section] || highlight.section}
                          </Badge>
                          {highlight.section === "chapters" || highlight.section === "key_ideas" || highlight.section === "actionable_insights" || highlight.section === "quotes" ? (
                            <span className="text-xs text-[rgb(var(--muted-foreground))]">
                              Item {highlight.item_index + 1}
                            </span>
                          ) : null}
                        </div>
                        <blockquote className={`text-[rgb(var(--foreground))] text-sm leading-relaxed border-l-2 pl-2 py-0.5 my-0.5 rounded-r ${getHighlightColorClasses(highlight.color || "yellow")}`}>
                          "{highlight.highlighted_text}"
                        </blockquote>
                        <p className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5">
                          {new Date(highlight.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromFolder(highlight.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

