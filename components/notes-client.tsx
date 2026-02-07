"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useHighlights, type Highlight } from "@/lib/use-highlights";
import { Document, Packer, Paragraph, TextRun } from "docx";
import jsPDF from "jspdf";

type Note = {
  id: string;
  user_id: string;
  book_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type NotesClientProps = {
  initialNotes: Note[];
};

function formatHighlightForInsert(h: Highlight) {
  const bookTitle = h.books?.title ? ` — ${h.books.title}` : "";
  const section = h.section ? ` (${h.section}${Number.isFinite(h.item_index) ? ` #${h.item_index + 1}` : ""})` : "";
  const created = h.created_at ? new Date(h.created_at).toLocaleString() : "";
  return [
    `> Highlight${bookTitle}${section}`,
    h.highlighted_text.trim(),
    h.context_text ? `\nContext:\n${h.context_text.trim()}` : "",
    created ? `\nSaved: ${created}` : "",
    "\n",
  ]
    .filter(Boolean)
    .join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string) {
  return (name || "note").replace(/[^\w\- ]+/g, "").trim().slice(0, 80) || "note";
}

async function downloadDocx(filename: string, title: string, content: string) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: title || "Untitled note", bold: true, size: 32 })],
          }),
          ...content.split("\n").map((line) => new Paragraph(line)),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadPdf(filename: string, title: string, content: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(title || "Untitled note", maxWidth);
  titleLines.forEach((line: string) => {
    doc.text(line, margin, y);
    y += 22;
  });

  y += 10;
  doc.setFont("times", "normal");
  doc.setFontSize(11);

  const lines = doc.splitTextToSize(content || "", maxWidth);
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(String(line), margin, y);
    y += 16;
  }

  doc.save(filename);
}

export function NotesClient({ initialNotes }: NotesClientProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null);
  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  const [draftTitle, setDraftTitle] = useState(selected?.title ?? "");
  const [draftContent, setDraftContent] = useState(selected?.content ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { highlights, isLoading: isLoadingHighlights } = useHighlights();

  useEffect(() => {
    setDraftTitle(selected?.title ?? "");
    setDraftContent(selected?.content ?? "");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshNotes = async (nextSelectedId?: string | null) => {
    const resp = await fetch("/api/notes");
    if (!resp.ok) throw new Error("Failed to refresh notes");
    const data = (await resp.json()) as { notes: Note[] };
    setNotes(data.notes);
    setSelectedId(nextSelectedId ?? data.notes[0]?.id ?? null);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const resp = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled note", content: "" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Failed to create note");
      await refreshNotes(data.note?.id ?? null);
      toast.success("Note created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create note");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const resp = await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          title: draftTitle.trim() || "Untitled note",
          content: draftContent,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Failed to save note");
      await refreshNotes(selected.id);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      const resp = await fetch(`/api/notes?id=${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Failed to delete note");
      await refreshNotes(null);
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const insertHighlight = (h: Highlight) => {
    const block = formatHighlightForInsert(h);
    const next = draftContent ? `${draftContent.trimEnd()}\n\n${block}` : block;
    setDraftContent(next);
    toast.success("Inserted highlight");
  };

  const handleExportTxt = () => {
    if (!selected) return;
    const filename = `${sanitizeFilename(draftTitle.trim())}.txt`;
    downloadTextFile(filename, `${draftTitle}\n\n${draftContent}`.trim() + "\n");
  };

  const handleExportPdf = () => {
    if (!selected) return;
    const filename = `${sanitizeFilename(draftTitle.trim())}.pdf`;
    downloadPdf(filename, draftTitle, draftContent);
  };

  const handleExportDocx = async () => {
    if (!selected) return;
    try {
      const filename = `${sanitizeFilename(draftTitle.trim())}.docx`;
      await downloadDocx(filename, draftTitle, draftContent);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export Word document");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Notes</div>
          <Button size="sm" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating…" : "New"}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {notes.length === 0 ? (
            <div className="text-sm text-[rgb(var(--muted-foreground))]">
              No notes yet. Create one to get started.
            </div>
          ) : (
            notes.map((n) => {
              const isActive = n.id === selectedId;
              return (
                <button
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-[rgb(var(--accent))] bg-[rgb(var(--muted))]"
                      : "border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))]/40"
                  }`}
                >
                  <div className="truncate text-sm font-medium">{n.title || "Untitled note"}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-[rgb(var(--muted-foreground))]">
                    {(n.content || "").trim().slice(0, 160) || "Empty note"}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-5">
          {selected ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full space-y-2">
                  <Label htmlFor="note-title">Title</Label>
                  <Input
                    id="note-title"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Note title"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleExportTxt}>
                    Export TXT
                  </Button>
                  <Button variant="outline" onClick={handleExportPdf}>
                    Export PDF
                  </Button>
                  <Button variant="outline" onClick={handleExportDocx}>
                    Export Word
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note-content">Content</Label>
                <Textarea
                  id="note-content"
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Write your notes here…"
                  className="min-h-[420px] w-full font-mono text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="text-sm text-[rgb(var(--muted-foreground))]">
              Select a note to edit, or create a new one.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Insert from highlights</div>
            <div className="text-xs text-[rgb(var(--muted-foreground))]">
              {isLoadingHighlights ? "Loading…" : `${highlights.length} highlights`}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {highlights.length === 0 ? (
              <div className="text-sm text-[rgb(var(--muted-foreground))]">
                No highlights yet. Highlight text inside a book summary to see it here.
              </div>
            ) : (
              highlights.slice(0, 30).map((h) => (
                <div
                  key={h.id}
                  className="rounded-2xl border border-[rgb(var(--border))] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">
                        {h.books?.title ?? "Book"} • {h.section}
                      </div>
                      <div className="mt-1 line-clamp-3 text-sm">
                        {h.highlighted_text}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => insertHighlight(h)}
                      disabled={!selected}
                    >
                      Insert
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

