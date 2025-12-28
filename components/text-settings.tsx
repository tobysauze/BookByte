"use client";

import { useState } from "react";
import { Settings, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTextPreferences, type FontFamily, type FontSize, type TextAlign } from "@/lib/text-preferences-context";
import { cn } from "@/lib/utils";

export function TextSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const { preferences, setFontFamily, setFontSize, setTextAlign, resetPreferences } = useTextPreferences();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Text Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Text Display Settings
          </DialogTitle>
          <DialogDescription>
            Customize how book summary text is displayed. Changes apply immediately.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Font Family */}
          <div className="space-y-2">
            <Label htmlFor="font-family">Font Family</Label>
            <select
              id="font-family"
              value={preferences.fontFamily}
              onChange={(e) => setFontFamily(e.target.value as FontFamily)}
              className={cn(
                "flex h-10 w-full rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 py-2 text-sm text-[rgb(var(--foreground))]",
                "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] focus:ring-offset-2"
              )}
            >
              <option value="sans-serif">Sans Serif (Default)</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
            </select>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <Label htmlFor="font-size">Font Size</Label>
            <select
              id="font-size"
              value={preferences.fontSize}
              onChange={(e) => setFontSize(e.target.value as FontSize)}
              className={cn(
                "flex h-10 w-full rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 py-2 text-sm text-[rgb(var(--foreground))]",
                "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] focus:ring-offset-2"
              )}
            >
              <option value="sm">Small</option>
              <option value="base">Base</option>
              <option value="lg">Large (Default)</option>
              <option value="xl">Extra Large</option>
              <option value="2xl">2X Large</option>
            </select>
          </div>

          {/* Text Alignment */}
          <div className="space-y-2">
            <Label htmlFor="text-align">Text Alignment</Label>
            <select
              id="text-align"
              value={preferences.textAlign}
              onChange={(e) => setTextAlign(e.target.value as TextAlign)}
              className={cn(
                "flex h-10 w-full rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3 py-2 text-sm text-[rgb(var(--foreground))]",
                "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] focus:ring-offset-2"
              )}
            >
              <option value="left">Left</option>
              <option value="center">Center (Default)</option>
              <option value="right">Right</option>
            </select>
          </div>

          {/* Reset Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={resetPreferences}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
