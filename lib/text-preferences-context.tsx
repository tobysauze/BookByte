"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type FontFamily = "sans-serif" | "serif" | "monospace";
export type FontSize = "sm" | "base" | "lg" | "xl" | "2xl";
export type TextAlign = "left" | "center" | "right";

interface TextPreferences {
  fontFamily: FontFamily;
  fontSize: FontSize;
  textAlign: TextAlign;
}

interface TextPreferencesContextType {
  preferences: TextPreferences;
  setFontFamily: (family: FontFamily) => void;
  setFontSize: (size: FontSize) => void;
  setTextAlign: (align: TextAlign) => void;
  resetPreferences: () => void;
}

const defaultPreferences: TextPreferences = {
  fontFamily: "sans-serif",
  fontSize: "lg",
  textAlign: "center",
};

const TextPreferencesContext = createContext<TextPreferencesContextType | undefined>(undefined);

export function TextPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<TextPreferences>(defaultPreferences);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load saved preferences from localStorage
    const saved = localStorage.getItem("textPreferences");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences({
          fontFamily: parsed.fontFamily || defaultPreferences.fontFamily,
          fontSize: parsed.fontSize || defaultPreferences.fontSize,
          textAlign: parsed.textAlign || defaultPreferences.textAlign,
        });
      } catch (error) {
        console.error("Failed to parse text preferences:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("textPreferences", JSON.stringify(preferences));
      // Apply CSS custom properties
      const root = document.documentElement;
      root.style.setProperty("--text-font-family", getFontFamilyValue(preferences.fontFamily));
      root.style.setProperty("--text-font-size", getFontSizeValue(preferences.fontSize));
      root.style.setProperty("--text-align", preferences.textAlign);
    }
  }, [preferences, mounted]);

  const setFontFamily = (family: FontFamily) => {
    setPreferences(prev => ({ ...prev, fontFamily: family }));
  };

  const setFontSize = (size: FontSize) => {
    setPreferences(prev => ({ ...prev, fontSize: size }));
  };

  const setTextAlign = (align: TextAlign) => {
    setPreferences(prev => ({ ...prev, textAlign: align }));
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };

  return (
    <TextPreferencesContext.Provider
      value={{
        preferences,
        setFontFamily,
        setFontSize,
        setTextAlign,
        resetPreferences,
      }}
    >
      {children}
    </TextPreferencesContext.Provider>
  );
}

export function useTextPreferences() {
  const context = useContext(TextPreferencesContext);
  if (context === undefined) {
    throw new Error("useTextPreferences must be used within a TextPreferencesProvider");
  }
  return context;
}

function getFontFamilyValue(family: FontFamily): string {
  switch (family) {
    case "serif":
      return "Georgia, 'Times New Roman', serif";
    case "monospace":
      return "'Courier New', Courier, monospace";
    case "sans-serif":
    default:
      return "system-ui, -apple-system, sans-serif";
  }
}

function getFontSizeValue(size: FontSize): string {
  switch (size) {
    case "sm":
      return "0.875rem"; // 14px
    case "base":
      return "1rem"; // 16px
    case "lg":
      return "1.125rem"; // 18px
    case "xl":
      return "1.25rem"; // 20px
    case "2xl":
      return "1.5rem"; // 24px
    default:
      return "1.125rem"; // 18px
  }
}

