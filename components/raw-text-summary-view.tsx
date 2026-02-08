"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useHighlights } from "@/lib/use-highlights";
import { HighlightableText } from "@/components/highlightable-text";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { List, Scroll, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

type TocItem = { id: string; label: string; level: 1 | 2 | 3; offset: number };

export function RawTextSummaryView({ bookId, content }: { bookId: string; content: string }) {
    const { highlights, refreshHighlights } = useHighlights(bookId);
    const textContainerRef = useRef<HTMLDivElement | null>(null);
    const [isTocOpen, setIsTocOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"scroll" | "paginated">(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("rawSummaryViewMode");
            return saved === "paginated" ? "paginated" : "scroll";
        }
        return "scroll";
    });
    const [currentPage, setCurrentPage] = useState(0);

    const displayContent = useMemo(() => {
        return content.replace(/\[CARD_BLURB\][\s\S]*?\[\/CARD_BLURB\]\s*/i, "").trim();
    }, [content]);

    const toc = useMemo(() => {
        const text = displayContent.replace(/\r\n/g, "\n");
        const lines = text.split("\n");

        const items: TocItem[] = [];
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

            const introLike = cleaned.match(/^(Introduction|Conclusion|Appendix|Epilogue|Prologue)\s*:\s*(.+)$/i);
            if (introLike) {
                return { label: `${introLike[1]!.trim()}: ${introLike[2]!.trim()}`, level: 2 as const };
            }

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
            offset += line.length + 1;
        }

        return items;
    }, [displayContent]);

    // Split content into pages based on top-level TOC headings (level 1 & 2)
    const pages = useMemo(() => {
        if (toc.length === 0) {
            // No headings found — treat the whole thing as one page
            return [{ label: "Summary", content: displayContent, tocIndex: -1 }];
        }

        // Use only level-1 and level-2 headings as page boundaries
        const pageBreaks = toc.filter((item) => item.level <= 2);

        if (pageBreaks.length === 0) {
            return [{ label: "Summary", content: displayContent, tocIndex: -1 }];
        }

        const result: Array<{ label: string; content: string; tocIndex: number }> = [];

        // If there's content before the first heading, add it as "Introduction"
        if (pageBreaks[0].offset > 0) {
            const intro = displayContent.slice(0, pageBreaks[0].offset).trim();
            if (intro.length > 0) {
                result.push({ label: "Introduction", content: intro, tocIndex: -1 });
            }
        }

        for (let i = 0; i < pageBreaks.length; i++) {
            const start = pageBreaks[i].offset;
            const end = i + 1 < pageBreaks.length ? pageBreaks[i + 1].offset : displayContent.length;
            const section = displayContent.slice(start, end).trim();
            if (section.length > 0) {
                result.push({
                    label: pageBreaks[i].label,
                    content: section,
                    tocIndex: toc.indexOf(pageBreaks[i]),
                });
            }
        }

        return result;
    }, [displayContent, toc]);

    // Ensure currentPage is valid
    useEffect(() => {
        if (currentPage >= pages.length) {
            setCurrentPage(Math.max(0, pages.length - 1));
        }
    }, [currentPage, pages.length]);

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

        const topOffset = 110;
        window.scrollTo({
            top: rect.top + window.scrollY - topOffset,
            behavior: "smooth",
        });
    };

    const handleTocItemClick = (charOffset: number) => {
        if (viewMode === "paginated") {
            // Find which page contains this offset
            const tocItem = toc.find((t) => t.offset === charOffset);
            if (tocItem) {
                const pageIndex = pages.findIndex((p) => p.tocIndex === toc.indexOf(tocItem));
                if (pageIndex >= 0) {
                    setCurrentPage(pageIndex);
                    setIsTocOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return;
                }
            }
            // Fallback: find the page whose content range includes this offset
            for (let i = pages.length - 1; i >= 0; i--) {
                const pageTocItem = toc[pages[i].tocIndex];
                if (pageTocItem && pageTocItem.offset <= charOffset) {
                    setCurrentPage(i);
                    setIsTocOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    return;
                }
            }
            setCurrentPage(0);
            setIsTocOpen(false);
        } else {
            setIsTocOpen(false);
            setTimeout(() => scrollToOffset(charOffset), 300);
        }
    };

    const handleViewModeToggle = useCallback((mode: "scroll" | "paginated") => {
        setViewMode(mode);
        if (typeof window !== "undefined") {
            localStorage.setItem("rawSummaryViewMode", mode);
        }
        if (mode === "paginated") {
            setCurrentPage(0);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, []);

    const handlePrevPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handleNextPage = () => {
        if (currentPage < pages.length - 1) {
            setCurrentPage(currentPage + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const currentPageContent = viewMode === "paginated" ? (pages[currentPage]?.content ?? "") : displayContent;

    // Build TOC items list (shared between mobile sheet and desktop sidebar)
    const tocList = (onClick: (offset: number) => void) => (
        <>
            {toc.length ? (
                toc.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onClick(item.offset)}
                        className={`w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-[rgb(var(--muted))] ${
                            item.level === 1
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
        </>
    );

    return (
        <div className="space-y-4">
            {/* View Mode Toggle */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--card))]">
                    <button
                        onClick={() => handleViewModeToggle("scroll")}
                        className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs sm:text-sm transition-colors ${
                            viewMode === "scroll"
                                ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                                : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                        }`}
                    >
                        <Scroll className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Continuous Scroll</span>
                        <span className="sm:hidden">Scroll</span>
                    </button>
                    <button
                        onClick={() => handleViewModeToggle("paginated")}
                        className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs sm:text-sm transition-colors ${
                            viewMode === "paginated"
                                ? "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]"
                                : "text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                        }`}
                    >
                        <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Page by Page</span>
                        <span className="sm:hidden">Pages</span>
                    </button>
                </div>

                {/* Page indicator (only in paginated mode) */}
                {viewMode === "paginated" && pages.length > 1 && (
                    <span className="text-xs sm:text-sm text-[rgb(var(--muted-foreground))]">
                        Page {currentPage + 1} of {pages.length}
                    </span>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
                {/* Fixed side handle to open contents - visible on mobile only */}
                <button
                    type="button"
                    onClick={() => setIsTocOpen(true)}
                    className="lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] pl-1.5 pr-2 py-3 rounded-r-lg shadow-lg hover:pl-2.5 transition-all"
                    title="Open Contents"
                >
                    <List className="h-4 w-4" />
                </button>

                {/* Mobile TOC - Sheet drawer */}
                <Sheet open={isTocOpen} onOpenChange={setIsTocOpen}>
                    <SheetContent side="left" className="w-80 max-w-[85vw] overflow-y-auto p-0">
                        <SheetHeader className="p-6 pb-4">
                            <SheetTitle>Contents</SheetTitle>
                        </SheetHeader>
                        <div className="px-4 pb-6 space-y-1">
                            {tocList(handleTocItemClick)}
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Desktop sidebar TOC - always visible on large screens */}
                <aside
                    className="hidden lg:block sticky top-24 h-[calc(100vh-6rem)] flex-shrink-0 overflow-y-auto rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 w-80"
                >
                    <div className="text-sm font-semibold mb-4">Contents</div>
                    <div className="space-y-1">
                        {tocList((offset) => {
                            if (viewMode === "paginated") {
                                handleTocItemClick(offset);
                            } else {
                                scrollToOffset(offset);
                            }
                        })}
                    </div>
                </aside>

                {/* Main content */}
                <div className="flex-1 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-4 sm:p-6 lg:p-8">
                    {/* Page title in paginated mode */}
                    {viewMode === "paginated" && pages[currentPage] && (
                        <div className="mb-4 pb-3 border-b border-[rgb(var(--border))]">
                            <h2 className="text-lg sm:text-xl font-bold text-[rgb(var(--foreground))]">
                                {pages[currentPage].label}
                            </h2>
                        </div>
                    )}

                    <div
                        className="prose dark:prose-invert max-w-none font-mono text-sm sm:text-base leading-relaxed sm:leading-loose"
                        ref={viewMode === "scroll" ? textContainerRef : undefined}
                    >
                        <HighlightableText
                            text={currentPageContent}
                            bookId={bookId}
                            section="raw_text"
                            itemIndex={viewMode === "paginated" ? currentPage : 0}
                            highlights={highlights}
                            onHighlightCreated={refreshHighlights}
                            onHighlightDeleted={refreshHighlights}
                            className="whitespace-pre-wrap break-words"
                            containerRef={viewMode === "paginated" ? undefined : textContainerRef}
                        />
                    </div>

                    {/* Pagination controls */}
                    {viewMode === "paginated" && pages.length > 1 && (
                        <div className="mt-8 pt-6 border-t border-[rgb(var(--border))]">
                            <div className="flex items-center justify-between gap-4">
                                <Button
                                    variant="outline"
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 0}
                                    className="flex items-center gap-2"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span className="hidden sm:inline">Previous</span>
                                    <span className="sm:hidden">Prev</span>
                                </Button>

                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-sm font-medium text-[rgb(var(--foreground))]">
                                        {currentPage + 1} / {pages.length}
                                    </span>
                                    {pages[currentPage + 1] && (
                                        <span className="text-xs text-[rgb(var(--muted-foreground))] text-center max-w-[200px] truncate">
                                            Next: {pages[currentPage + 1].label}
                                        </span>
                                    )}
                                </div>

                                <Button
                                    variant="outline"
                                    onClick={handleNextPage}
                                    disabled={currentPage === pages.length - 1}
                                    className="flex items-center gap-2"
                                >
                                    <span className="hidden sm:inline">Next</span>
                                    <span className="sm:hidden">Next</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Page dots for visual progress */}
                            {pages.length <= 20 && (
                                <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
                                    {pages.map((page, i) => (
                                        <button
                                            key={page.label + i}
                                            type="button"
                                            onClick={() => {
                                                setCurrentPage(i);
                                                window.scrollTo({ top: 0, behavior: "smooth" });
                                            }}
                                            className={`w-2.5 h-2.5 rounded-full transition-all ${
                                                i === currentPage
                                                    ? "bg-[rgb(var(--accent))] scale-125"
                                                    : "bg-[rgb(var(--muted))] hover:bg-[rgb(var(--accent))]/50"
                                            }`}
                                            title={page.label}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
