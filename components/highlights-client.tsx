"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, BookOpen, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";
import { useHighlights } from "@/lib/use-highlights";
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

export function HighlightsClient() {
  const { highlights, isLoading, error, refreshHighlights } = useHighlights();
  const { addHighlightToFolder } = useFolders();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [draggedHighlightId, setDraggedHighlightId] = useState<string | null>(null);
  const [isDraggingOverFolder, setIsDraggingOverFolder] = useState(false);

  // Create a reusable empty drag image element
  useEffect(() => {
    let emptyDragImage = document.getElementById("empty-drag-image");
    if (!emptyDragImage) {
      emptyDragImage = document.createElement("div");
      emptyDragImage.id = "empty-drag-image";
      emptyDragImage.style.position = "absolute";
      emptyDragImage.style.top = "0px";
      emptyDragImage.style.left = "0px";
      emptyDragImage.style.width = "1px";
      emptyDragImage.style.height = "1px";
      emptyDragImage.style.opacity = "0";
      emptyDragImage.style.pointerEvents = "none";
      emptyDragImage.style.zIndex = "-1";
      emptyDragImage.style.overflow = "hidden";
      emptyDragImage.style.display = "block"; // Must be block for setDragImage to work
      emptyDragImage.style.visibility = "hidden"; // But can be hidden
      emptyDragImage.style.background = "transparent";
      // Element must be in the document and rendered (not display:none) for setDragImage to work
      document.body.appendChild(emptyDragImage);
    }
  }, []);

  // Listen for drag over folder events from sidebar
  useEffect(() => {
    const handleDragOverFolder = () => setIsDraggingOverFolder(true);
    const handleDragLeaveFolder = () => setIsDraggingOverFolder(false);

    window.addEventListener("dragOverFolder", handleDragOverFolder);
    window.addEventListener("dragLeaveFolder", handleDragLeaveFolder);
    window.addEventListener("dragend", handleDragLeaveFolder);

    return () => {
      window.removeEventListener("dragOverFolder", handleDragOverFolder);
      window.removeEventListener("dragLeaveFolder", handleDragLeaveFolder);
      window.removeEventListener("dragend", handleDragLeaveFolder);
    };
  }, []);

  // Create custom drag preview that follows cursor
  useEffect(() => {
    if (!draggedHighlightId) return;

    const handleDrag = (e: DragEvent) => {
      const dragPreview = document.getElementById("custom-drag-preview");
      if (dragPreview && e.clientX > 0 && e.clientY > 0) {
        dragPreview.style.display = "block";
        dragPreview.style.left = `${e.clientX + 10}px`;
        dragPreview.style.top = `${e.clientY + 10}px`;
        dragPreview.style.transform = isDraggingOverFolder ? "scale(0.85)" : "scale(1)";
        dragPreview.style.opacity = isDraggingOverFolder ? "0.8" : "0.9";
      }
    };

    const handleDragEnd = () => {
      const dragPreview = document.getElementById("custom-drag-preview");
      if (dragPreview) {
        dragPreview.remove();
      }
    };

    document.addEventListener("drag", handleDrag);
    document.addEventListener("dragend", handleDragEnd);

    return () => {
      document.removeEventListener("drag", handleDrag);
      document.removeEventListener("dragend", handleDragEnd);
    };
  }, [draggedHighlightId, isDraggingOverFolder]);

  const handleDeleteHighlight = async (highlightId: string) => {
    try {
      const response = await fetch(`/api/highlights?id=${highlightId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete highlight");
      }

      toast.success("Highlight deleted");
      refreshHighlights();
    } catch (error) {
      console.error("Error deleting highlight:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete highlight");
    }
  };

  const handleDragStart = (e: React.DragEvent, highlightId: string) => {
    setDraggedHighlightId(highlightId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", highlightId);
    
    // Try to hide default drag preview
    try {
      const emptyDragImage = document.getElementById("empty-drag-image");
      if (emptyDragImage) {
        // Element is already display:block and visibility:hidden, just make visible temporarily
        emptyDragImage.style.visibility = "visible";
        e.dataTransfer.setDragImage(emptyDragImage, 0, 0);
        // Hide it again
        emptyDragImage.style.visibility = "hidden";
      }
    } catch (error) {
      // If drag image setup fails, continue anyway - drag should still work
      console.warn("Failed to set custom drag image:", error);
    }
  };

  const handleDragEnd = () => {
    setDraggedHighlightId(null);
    const dragPreview = document.getElementById("custom-drag-preview");
    if (dragPreview) {
      dragPreview.remove();
    }
  };

  const handleDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    const highlightId = e.dataTransfer.getData("text/plain");
    
    if (highlightId && folderId) {
      try {
        await addHighlightToFolder(folderId, highlightId);
        toast.success("Highlight added to folder");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add highlight to folder");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const navigateToHighlight = (highlight: typeof highlights[0]) => {
    const url = `/books/${highlight.book_id}?section=${highlight.section}&itemIndex=${highlight.item_index}&highlightId=${highlight.id}`;
    window.location.href = url;
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
  }, {} as Record<string, { book: { id: string; title: string; author: string | null; cover_url: string | null }; highlights: typeof highlights }>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--accent))] mx-auto mb-4"></div>
          <p className="text-[rgb(var(--muted-foreground))]">Loading highlights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error loading highlights: {error}</p>
          <Button onClick={() => refreshHighlights()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <BookOpen className="h-16 w-16 mx-auto text-[rgb(var(--muted-foreground))]" />
          <h2 className="text-2xl font-semibold">No highlights yet</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            Start highlighting text in book summaries to see them here.
          </p>
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
            <div>
              <h1 className="text-3xl font-bold">My Highlights</h1>
              <p className="text-[rgb(var(--muted-foreground))] mt-2">
                {highlights.length} highlight{highlights.length !== 1 ? "s" : ""} across {Object.keys(highlightsByBook).length} book{Object.keys(highlightsByBook).length !== 1 ? "s" : ""}
              </p>
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

      {viewMode === "card" ? (
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
                      draggable
                      onDragStart={(e) => {
                        handleDragStart(e, highlight.id);
                        // Create custom drag preview
                        const rect = e.currentTarget.getBoundingClientRect();
                        const dragPreview = document.createElement("div");
                        dragPreview.id = "custom-drag-preview";
                        dragPreview.style.position = "fixed";
                        dragPreview.style.left = `${e.clientX + 10}px`;
                        dragPreview.style.top = `${e.clientY + 10}px`;
                        dragPreview.style.width = `${rect.width}px`;
                        dragPreview.style.maxWidth = "400px";
                        dragPreview.style.pointerEvents = "none";
                        dragPreview.style.zIndex = "9999";
                        dragPreview.style.opacity = "0.9";
                        dragPreview.style.transform = "scale(1)";
                        dragPreview.style.transition = "transform 0.2s ease, opacity 0.2s ease";
                        dragPreview.style.backgroundColor = "rgb(var(--background))";
                        dragPreview.style.border = "1px solid rgb(var(--border))";
                        dragPreview.style.borderRadius = "0.5rem";
                        dragPreview.style.padding = "1rem";
                        dragPreview.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                        dragPreview.style.display = "block";
                        dragPreview.innerHTML = e.currentTarget.innerHTML;
                        document.body.appendChild(dragPreview);
                      }}
                      onDragEnd={handleDragEnd}
                      className={`p-4 border rounded-lg hover:bg-[rgb(var(--muted))] transition-colors cursor-grab active:cursor-grabbing group ${
                        draggedHighlightId === highlight.id ? "opacity-30" : ""
                      }`}
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
                            handleDeleteHighlight(highlight.id);
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
                draggable
                onDragStart={(e) => {
                  handleDragStart(e, highlight.id);
                  // Create custom drag preview
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dragPreview = document.createElement("div");
                  dragPreview.id = "custom-drag-preview";
                  dragPreview.style.position = "fixed";
                  dragPreview.style.left = `${e.clientX + 10}px`;
                  dragPreview.style.top = `${e.clientY + 10}px`;
                  dragPreview.style.width = `${rect.width}px`;
                  dragPreview.style.maxWidth = "400px";
                  dragPreview.style.pointerEvents = "none";
                  dragPreview.style.zIndex = "9999";
                  dragPreview.style.opacity = "0.9";
                  dragPreview.style.transform = "scale(1)";
                  dragPreview.style.transition = "transform 0.2s ease, opacity 0.2s ease";
                  dragPreview.style.backgroundColor = "rgb(var(--background))";
                  dragPreview.style.borderBottom = "1px solid rgb(var(--border))";
                  dragPreview.style.padding = "0.5rem";
                  dragPreview.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.25)";
                  dragPreview.style.display = "block";
                  dragPreview.innerHTML = e.currentTarget.innerHTML;
                  document.body.appendChild(dragPreview);
                }}
                onDragEnd={handleDragEnd}
                className={`p-2 border-b hover:bg-[rgb(var(--muted))] transition-colors cursor-grab active:cursor-grabbing group ${
                  draggedHighlightId === highlight.id ? "opacity-30" : ""
                }`}
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
                      handleDeleteHighlight(highlight.id);
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

