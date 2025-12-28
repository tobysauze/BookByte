"use client";

import { useTextPreferences } from "@/lib/text-preferences-context";
import { cn } from "@/lib/utils";

type SummaryTextProps = {
  children: React.ReactNode;
  className?: string;
};

export function SummaryText({ children, className }: SummaryTextProps) {
  const { preferences } = useTextPreferences();

  const getFontSizeClass = () => {
    switch (preferences.fontSize) {
      case "sm":
        return "text-sm";
      case "base":
        return "text-base";
      case "lg":
        return "text-lg";
      case "xl":
        return "text-xl";
      case "2xl":
        return "text-2xl";
      default:
        return "text-lg";
    }
  };

  const getTextAlignClass = () => {
    switch (preferences.textAlign) {
      case "left":
        return "text-left";
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-center";
    }
  };

  const getFontFamilyStyle = () => {
    switch (preferences.fontFamily) {
      case "serif":
        return { fontFamily: "Georgia, 'Times New Roman', serif" };
      case "monospace":
        return { fontFamily: "'Courier New', Courier, monospace" };
      case "sans-serif":
      default:
        return { fontFamily: "system-ui, -apple-system, sans-serif" };
    }
  };

  return (
    <div
      className={cn(getFontSizeClass(), getTextAlignClass(), className)}
      style={getFontFamilyStyle()}
    >
      {children}
    </div>
  );
}

