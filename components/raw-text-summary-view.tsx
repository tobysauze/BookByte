"use client";

import { useMemo, useRef, useState } from "react";
import { useHighlights } from "@/lib/use-highlights";
import { HighlightableText } from "@/components/highlightable-text";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function RawTextSummaryView({ bookId, content }: { bookId: string; content: string }) {
    const { highlights, refreshHighlights } = useHighlights(bookId);
    const textContainerRef = useRef<HTMLDivElement | null>(null);
    const [isTocOpen, setIsTocOpen] = useState(false);

    const displayContent = useMemo(() => {
        // Hide the card blurb tags from the main reading view.
        return content.replace(/\[CARD_BLURB\][\s\S]*?\[\/CARD_BLURB\]\s*/i, "").trim();
    }, [content]);

    const toc = useMemo(() => {
        const text = displayContent.replace(/\r\n/g, "\n");
        const lines = text.split("\n");

        const items: Array<{ id: string; label: string; level: 1 | 2 | 3; offset: number }> = [];
        const used = new Map<string, number>();
        const slugify = (s: string) =>
            s
                .toLowerCase()
                .replace(/['"]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 80) || "section";

        const uniqueId = (base: string) => {
            const count = (used.get(base) ?? 0) + 1;
            used.set(base, count);
            return count === 1 ? base : `${base}-${count}`;
        };

        const isSeparator = (line: string) => {
            const trimmed = line.trim();
            return trimmed.length > 0 && /^[═=]{8,}$/.test(trimmed);
        };

        const isMajorHeading = (line: string) => {
            const trimmed = line.trim();
            const cleaned = trimmed.replace(/^\*+|\*+$/g, "").trim();

            if (!cleaned) return null;
            if (isSeparator(cleaned)) return null;

            const partMatch = cleaned.match(/^PART\s+(\d+)\s*:\s*(.+)$/i);
            if (partMatch) {
                const num = partMatch[1]!;
                const title = partMatch[2]!.trim();
                return { label: `Part ${num}: ${title}`, level: 1 as const };
            }

            const chapterMatch = cleaned.match(/^(Chapter|CHAPTER)\s+(\d+)\s*:\s*(.+)$/);
            if (chapterMatch) {
                const num = chapterMatch[2]!;
                const title = chapterMatch[3]!.trim();
                return { label: `Chapter ${num}: ${title}`, level: 2 as const };
            }

            // "Introduction: ..." / "Conclusion: ..." etc
            const introLike = cleaned.match(/^(Introduction|Conclusion|Appendix|Epilogue|Prologue)\s*:\s*(.+)$/i);
            if (introLike) {
                return { label: `${introLike[1]!.trim()}: ${introLike[2]!.trim()}`, level: 2 as const };
            }

            // Part subheadings (keep this list intentionally small/high-signal)
            const normalized = cleaned.replace(/\*\*/g, "").replace(/:$/, "").trim();
            const known = new Set([
                "Core Frameworks",
                "Contrarian or Novel Ideas",
                "Evidence Quality Assessment",
                "For Different Reader Profiles",
                "Implementation Roadmap",
                "Habit Stacking Suggestions",
                "Potential Pitfalls & How to Avoid Them",
                "Signature Quotes",
                "Key Terminology",
                "Metaphors & Analogies",
                "About the Author",
                "Publication Context",
                "Intellectual Lineage",
                "Strengths",
                "Limitations & Gaps",
                "Comparison to Similar Works",
                "The \"So What?\" Test",
                "One-Page Cheat Sheet",
                "Reading Guide",
                "Discussion Questions",
            ]);
            if (known.has(normalized)) {
                return { label: normalized, level: 3 as const };
            }

            return null;
        };

        let offset = 0;
        for (const line of lines) {
            const heading = isMajorHeading(line);
            if (heading) {
                const base = slugify(heading.label);
                items.push({
                    id: uniqueId(base),
                    label: heading.label,
                    level: heading.level,
                    offset,
                });
            }
            // +1 for the newline we split on (except after last line, but ok for scrolling)
            offset += line.length + 1;
        }

        return items;
    }, [displayContent]);

    const scrollToOffset = (charOffset: number) => {
        const root = textContainerRef.current;
        if (!root) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let seen = 0;
        let found: { node: Text; offset: number } | null = null;

        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const len = node.data.length;
            if (seen + len >= charOffset) {
                found = { node, offset: Math.max(0, charOffset - seen) };
                break;
            }
            seen += len;
        }

        if (!found) {
            root.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }

        const range = document.createRange();
        range.setStart(found.node, found.offset);
        range.setEnd(found.node, found.offset);
        const rect = range.getBoundingClientRect();

        const topOffset = 110; // account for fixed navbar
        window.scrollTo({
            top: rect.top + window.scrollY - topOffset,
            behavior: "smooth",
        });
    };

    const handleTocItemClick = (charOffset: number) => {
        setIsTocOpen(false); // Close the sheet first
        // Small delay to let the sheet close before scrolling
        setTimeout(() => scrollToOffset(charOffset), 300);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4">
            {/* Mobile Contents Button */}
            <div className="lg:hidden flex justify-center mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTocOpen(true)}
                    className="w-full sm:w-auto"
                >
                    <Menu className="h-4 w-4 mr-2" />
                    Contents
                </Button>
            </div>

            {/* Mobile TOC - Sheet drawer */}
            <Sheet open={isTocOpen} onOpenChange={setIsTocOpen}>
                <SheetContent side="left" className="w-80 max-w-[85vw] overflow-y-auto p-0">
                    <SheetHeader className="p-6 pb-4">
                        <SheetTitle>Contents</SheetTitle>
                    </SheetHeader>
                    <div className="px-4 pb-6 space-y-1">
                        {toc.length ? (
                            toc.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleTocItemClick(item.offset)}
                                    className={`w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-[rgb(var(--muted))] ${item.level === 1
                                        ? "font-semibold"
                                        : item.level === 2
                                            ? "pl-5 text-[rgb(var(--foreground))]"
                                            : "pl-8 text-[rgb(var(--muted-foreground))]"
                                    }`}
                                    title={item.label}
                                >
                                    {item.label}
                                </button>
                            ))
                        ) : (
                            <div className="text-xs text-[rgb(var(--muted-foreground))] px-3">
                                No headings detected yet.
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Desktop sidebar TOC - always visible on large screens */}
            <aside
                className="hidden lg:block sticky top-24 h-[calc(100vh-6rem)] flex-shrink-0 overflow-y-auto rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 w-80"
            >
                <div className="text-sm font-semibold mb-4">Contents</div>
                <div className="space-y-1">
                    {toc.length ? (
                        toc.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => scrollToOffset(item.offset)}
                                className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[rgb(var(--muted))] ${item.level === 1
                                    ? "font-semibold"
                                    : item.level === 2
                                        ? "pl-5 text-[rgb(var(--foreground))]"
                                        : "pl-8 text-[rgb(var(--muted-foreground))]"
                                }`}
                                title={item.label}
                            >
                                {item.label}
                            </button>
                        ))
                    ) : (
                        <div className="text-xs text-[rgb(var(--muted-foreground))]">
                            No headings detected yet. Add headings like "PART 1:" or "Chapter 1:" to enable navigation.
                        </div>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 sm:p-6 lg:p-8">
                <div className="prose dark:prose-invert max-w-none font-mono text-sm sm:text-base leading-relaxed sm:leading-loose">
                    <HighlightableText
                        text={displayContent}
                        bookId={bookId}
                        section="raw_text"
                        itemIndex={0}
                        highlights={highlights}
                        onHighlightCreated={refreshHighlights}
                        onHighlightDeleted={refreshHighlights}
                        className="whitespace-pre-wrap break-words"
                        containerRef={textContainerRef}
                    />
                </div>
            </div>
        </div>
    );
}
