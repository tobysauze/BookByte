"use client";

import { useMemo, useRef, useState } from "react";
import { useHighlights } from "@/lib/use-highlights";
import { HighlightableText } from "@/components/highlightable-text";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export function RawTextSummaryView({ bookId, content }: { bookId: string; content: string }) {
    const { highlights, refreshHighlights } = useHighlights(bookId);
    const textContainerRef = useRef<HTMLDivElement | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed on mobile

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

    return (
        <div className="flex flex-col lg:flex-row gap-4">
            {/* Mobile Contents Button */}
            <div className="lg:hidden flex justify-center mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-full sm:w-auto"
                >
                    <Menu className="h-4 w-4 mr-2" />
                    {isCollapsed ? "Show Contents" : "Hide Contents"}
                </Button>
            </div>

            {/* Deep-dive table of contents - Collapsible on mobile */}
            {!isCollapsed && (
                <aside
                    className={`lg:block sticky top-20 lg:top-24 h-auto lg:h-[calc(100vh-6rem)] flex-shrink-0 overflow-y-auto rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 transition-all duration-300 w-full lg:w-80 mb-4 lg:mb-0`}
                >
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="text-sm font-semibold">Contents</div>
                        <button
                            type="button"
                            onClick={() => setIsCollapsed(true)}
                            className="lg:hidden rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-2 py-1 text-xs text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-1">
                        {toc.length ? (
                            toc.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        scrollToOffset(item.offset);
                                        setIsCollapsed(true); // Close on mobile after clicking
                                    }}
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
                                No headings detected yet. Add headings like “PART 1:” or “Chapter 1:” to enable navigation.
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
