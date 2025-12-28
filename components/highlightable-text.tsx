"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Highlighter, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SummaryText } from "@/components/summary-text";

type Highlight = {
  id: string;
  book_id: string;
  section: string;
  item_index: number;
  highlighted_text: string;
  context_text?: string;
  start_offset?: number;
  end_offset?: number;
  color?: string;
  created_at: string;
};

const HIGHLIGHT_COLORS = [
  { name: "yellow", label: "Yellow", bg: "bg-yellow-50/[0.25]", darkBg: "dark:bg-yellow-700" },
  { name: "green", label: "Green", bg: "bg-green-50/[0.25]", darkBg: "dark:bg-green-700" },
  { name: "blue", label: "Blue", bg: "bg-blue-50/[0.25]", darkBg: "dark:bg-blue-700" },
  { name: "pink", label: "Pink", bg: "bg-pink-50/[0.25]", darkBg: "dark:bg-pink-700" },
  { name: "purple", label: "Purple", bg: "bg-purple-50/[0.25]", darkBg: "dark:bg-purple-700" },
  { name: "orange", label: "Orange", bg: "bg-orange-50/[0.25]", darkBg: "dark:bg-orange-700" },
] as const;

function getHighlightColorClasses(color: string = "yellow") {
  const colorDef = HIGHLIGHT_COLORS.find(c => c.name === color) || HIGHLIGHT_COLORS[0];
  return `${colorDef.bg} ${colorDef.darkBg}`;
}

type HighlightableTextProps = {
  text: string;
  bookId: string;
  section: string;
  itemIndex: number;
  highlights?: Highlight[];
  onHighlightCreated?: () => void;
  onHighlightDeleted?: () => void;
  className?: string;
};

export function HighlightableText({
  text,
  bookId,
  section,
  itemIndex,
  highlights = [],
  onHighlightCreated,
  onHighlightDeleted,
  className = "",
}: HighlightableTextProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("yellow");
  const [buttonPosition, setButtonPosition] = useState<{ top: number; left: number } | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Filter highlights for this specific section and item
  const relevantHighlights = highlights.filter(
    h => h.section === section && h.item_index === itemIndex
  ).sort((a, b) => (a.start_offset || 0) - (b.start_offset || 0));

  // Close highlight button when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectedRange &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        textRef.current &&
        !textRef.current.contains(event.target as Node)
      ) {
        setSelectedRange(null);
        setIsSelecting(false);
        setButtonPosition(null);
        window.getSelection()?.removeAllRanges();
      }
    };

    if (selectedRange) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [selectedRange]);

  const handleMouseUp = useCallback(() => {
    if (!textRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (selectedText.length === 0) {
      setIsSelecting(false);
      setSelectedRange(null);
      setButtonPosition(null);
      return;
    }

    // Check if selection is within our text element
    if (!textRef.current.contains(range.commonAncestorContainer)) {
      setIsSelecting(false);
      setSelectedRange(null);
      setButtonPosition(null);
      return;
    }

    // Get the bounding rectangle of the selection
    const rect = range.getBoundingClientRect();
    const containerRect = textRef.current.getBoundingClientRect();
    
    // Calculate position relative to the container
    // Center horizontally on the selection
    const left = rect.left - containerRect.left + rect.width / 2;
    const top = rect.top - containerRect.top;

    // Calculate offsets relative to the text content
    const textContent = textRef.current.textContent || "";
    const startOffset = textContent.indexOf(selectedText);
    const endOffset = startOffset + selectedText.length;

    if (startOffset >= 0) {
      setIsSelecting(true);
      setSelectedRange({
        start: startOffset,
        end: endOffset,
        text: selectedText,
      });
      
      // Position button above the selection, centered horizontally
      // If selection is near top of container, position below instead
      const buttonHeight = 40; // Approximate button height
      const buttonWidth = 140; // Approximate button width
      const positionAbove = top > buttonHeight + 10;
      
      // Ensure button stays within container bounds
      const boundedLeft = Math.max(buttonWidth / 2, Math.min(left, containerRect.width - buttonWidth / 2));
      
      setButtonPosition({
        left: boundedLeft,
        top: positionAbove ? top - buttonHeight - 5 : top + rect.height + 5,
      });
    } else {
      setIsSelecting(false);
      setSelectedRange(null);
      setButtonPosition(null);
    }
  }, []);

  const handleCreateHighlight = async () => {
    if (!selectedRange) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/highlights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookId,
          section,
          itemIndex,
          highlightedText: selectedRange.text,
          contextText: text.substring(Math.max(0, selectedRange.start - 50), Math.min(text.length, selectedRange.end + 50)),
          startOffset: selectedRange.start,
          endOffset: selectedRange.end,
          color: selectedColor,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create highlight");
      }

      toast.success("Highlight created!");
      setSelectedRange(null);
      setIsSelecting(false);
      setButtonPosition(null);
      window.getSelection()?.removeAllRanges();
      onHighlightCreated?.();
    } catch (error) {
      console.error("Error creating highlight:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create highlight");
    } finally {
      setIsCreating(false);
    }
  };

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
      onHighlightDeleted?.();
    } catch (error) {
      console.error("Error deleting highlight:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete highlight");
    }
  };

  // Render text with highlights
  const renderHighlightedText = () => {
    if (relevantHighlights.length === 0) {
      return <span>{text}</span>;
    }

    const parts: Array<{ text: string; isHighlight: boolean; highlightId?: string }> = [];
    let lastIndex = 0;

    relevantHighlights.forEach((highlight) => {
      const start = highlight.start_offset || 0;
      const end = highlight.end_offset || start + highlight.highlighted_text.length;

      // Add text before highlight
      if (start > lastIndex) {
        parts.push({ text: text.substring(lastIndex, start), isHighlight: false });
      }

      // Add highlighted text
      parts.push({
        text: text.substring(start, end),
        isHighlight: true,
        highlightId: highlight.id,
      });

      lastIndex = end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex), isHighlight: false });
    }

    return (
      <>
        {parts.map((part, index) => {
          if (part.isHighlight && part.highlightId) {
            const highlight = relevantHighlights.find(h => h.id === part.highlightId);
            const colorClasses = getHighlightColorClasses(highlight?.color || "yellow");
            return (
              <mark
                key={index}
                id={`highlight-${part.highlightId}`}
                className={`${colorClasses} cursor-pointer relative group scroll-mt-20`}
                title="Click to delete highlight"
                onClick={() => handleDeleteHighlight(part.highlightId!)}
              >
                {part.text}
                <span className="absolute -top-6 left-0 opacity-0 group-hover:opacity-100 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  Click to delete
                </span>
              </mark>
            );
          }
          return <span key={index}>{part.text}</span>;
        })}
      </>
    );
  };

  return (
    <div className="relative">
      {/* Highlight button - positioned dynamically based on selection */}
      {selectedRange && buttonPosition && (
        <div
          ref={buttonRef}
          className="absolute z-50 flex flex-col items-center gap-2"
          style={{
            top: `${buttonPosition.top}px`,
            left: `${buttonPosition.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Color picker */}
          <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => setSelectedColor(color.name)}
                className={`w-6 h-6 rounded-full ${color.bg} ${color.darkBg} border-2 transition-all ${
                  selectedColor === color.name
                    ? 'border-gray-900 dark:border-gray-100 scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                title={color.label}
                aria-label={`Select ${color.label} highlight color`}
              />
            ))}
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleCreateHighlight}
              disabled={isCreating}
              className="flex items-center gap-2 shadow-lg bg-white dark:bg-gray-800"
            >
              <Highlighter className="h-4 w-4" />
              {isCreating ? "Creating..." : "Highlight"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedRange(null);
                setIsSelecting(false);
                setButtonPosition(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="shadow-lg bg-white dark:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Highlighted text */}
      <div
        ref={textRef}
        onMouseUp={handleMouseUp}
        className={`select-text ${className}`}
      >
        <SummaryText className="leading-relaxed whitespace-pre-wrap">
          {renderHighlightedText()}
        </SummaryText>
      </div>
    </div>
  );
}

