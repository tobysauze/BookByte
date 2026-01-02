"use client";

import { useHighlights } from "@/lib/use-highlights";
import { HighlightableText } from "@/components/highlightable-text";

export function RawTextSummaryView({ bookId, content }: { bookId: string; content: string }) {
    const { highlights, refreshHighlights } = useHighlights(bookId);

    return (
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8">
            <div className="prose dark:prose-invert max-w-none font-mono text-sm leading-relaxed">
                <HighlightableText
                    text={content}
                    bookId={bookId}
                    section="raw_text"
                    itemIndex={0}
                    highlights={highlights}
                    onHighlightCreated={refreshHighlights}
                    onHighlightDeleted={refreshHighlights}
                    className="whitespace-pre-wrap"
                />
            </div>
        </div>
    );
}
