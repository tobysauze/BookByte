"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Plus, FileEdit, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SummaryPayload } from "@/lib/schemas";

type Change = {
  gapId: string;
  type: string;
  section: string;
  title: string;
  original?: string;
  enhanced: string;
  action: "added" | "modified";
};

type EnhancementPreviewProps = {
  changes: Change[];
  enhancedSummary: SummaryPayload;
  originalSummary: SummaryPayload;
  bookId: string;
  warnings?: string[];
  onClose: () => void;
  onSave: () => void;
};

export function EnhancementPreview({
  changes,
  enhancedSummary,
  originalSummary,
  bookId,
  warnings = [],
  onClose,
  onSave,
}: EnhancementPreviewProps) {
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(
    new Set(changes.map(c => c.gapId))
  );
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleChange = (gapId: string) => {
    setSelectedChanges(prev => {
      const next = new Set(prev);
      if (next.has(gapId)) {
        next.delete(gapId);
      } else {
        next.add(gapId);
      }
      return next;
    });
  };

  const handleToggleExpand = (gapId: string) => {
    setExpandedChanges(prev => {
      const next = new Set(prev);
      if (next.has(gapId)) {
        next.delete(gapId);
      } else {
        next.add(gapId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedChanges.size === changes.length) {
      setSelectedChanges(new Set());
    } else {
      setSelectedChanges(new Set(changes.map(c => c.gapId)));
    }
  };

  const handleSaveApproved = async () => {
    if (selectedChanges.size === 0) {
      toast.error("Please select at least one change to save");
      return;
    }

    setIsSaving(true);
    try {
      // Filter the enhanced summary to only include approved changes
      const approvedChanges = changes.filter(c => selectedChanges.has(c.gapId));
      const approvedGapIds = new Set(approvedChanges.map(c => c.gapId));
      
      // Start with original summary and apply only approved changes
      const finalSummary = JSON.parse(JSON.stringify(originalSummary)); // Deep copy
      
      // Ensure all required fields exist
      if (!finalSummary.chapters) finalSummary.chapters = [];
      if (!finalSummary.key_ideas) finalSummary.key_ideas = [];
      if (!finalSummary.actionable_insights) finalSummary.actionable_insights = [];
      if (!finalSummary.quotes) finalSummary.quotes = [];
      
      // Apply approved changes
      for (const change of approvedChanges) {
        if (change.section === "chapters") {
          if (change.action === "added") {
            finalSummary.chapters.push({
              title: change.title,
              summary: change.enhanced,
            });
          } else if (change.action === "modified") {
            // Find by title (more reliable than index)
            const chapterIndex = finalSummary.chapters.findIndex(
              (c: { title: string }) => c.title === change.title
            );
            if (chapterIndex >= 0) {
              finalSummary.chapters[chapterIndex].summary = change.enhanced;
            }
          }
        }
        // TODO: Add handling for other sections (key_ideas, insights, quotes, quick_summary) as needed
      }
      
      // Remove unapproved added chapters from enhanced summary
      // (since we're starting from original, we just need to make sure we don't add unapproved ones)
      // This is already handled above since we only iterate approvedChanges

      // Save the approved changes
      const response = await fetch(`/api/books/${bookId}/summary`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section: "full", // We'll need to handle full summary updates
          data: finalSummary,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save changes");
      }

      toast.success(`Successfully saved ${selectedChanges.size} approved change(s)`);
      onSave();
    } catch (error) {
      console.error("Error saving approved changes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const getActionIcon = (action: string) => {
    return action === "added" ? (
      <Plus className="h-4 w-4 text-green-600" />
    ) : (
      <FileEdit className="h-4 w-4 text-blue-600" />
    );
  };

  const getActionBadge = (action: string) => {
    return action === "added" ? (
      <Badge className="bg-green-100 text-green-800 border-green-300">
        Added
      </Badge>
    ) : (
      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
        Modified
      </Badge>
    );
  };

  if (changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Changes Generated</CardTitle>
          <CardDescription>
            The enhancement process did not generate any changes. Please check the details below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Possible Issues:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                {warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="text-sm text-[rgb(var(--muted-foreground))]">
            <p className="mb-2">Common reasons why changes weren't generated:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Gemini API calls failed or timed out</li>
              <li>Context was too short or empty for the gaps</li>
              <li>API rate limiting or quota exceeded</li>
              <li>Error in processing the book text</li>
            </ul>
            <p className="mt-4 font-medium">Check the server console/logs for detailed error messages.</p>
          </div>
          <Button onClick={onClose}>Close</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Enhancement Preview</span>
            <Badge variant="secondary">
              {selectedChanges.size} of {changes.length} selected
            </Badge>
          </CardTitle>
          <CardDescription>
            Review the changes below. Select which enhancements to keep, then click "Save Approved Changes".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Select All Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedChanges.size === changes.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          {/* Changes List */}
          <div className="h-[600px] overflow-y-auto pr-4">
            <div className="space-y-4">
              {changes.map((change) => {
                const isSelected = selectedChanges.has(change.gapId);
                const isExpanded = expandedChanges.has(change.gapId);
                
                return (
                  <Card
                    key={change.gapId}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5"
                        : ""
                    }`}
                    onClick={() => handleToggleChange(change.gapId)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {isSelected ? (
                            <CheckCircle className="h-5 w-5 text-[rgb(var(--accent))]" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                          )}
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getActionIcon(change.action)}
                            <h4 className="font-semibold">{change.title}</h4>
                            {getActionBadge(change.action)}
                            <Badge variant="secondary" className="text-xs">
                              {change.section}
                            </Badge>
                          </div>

                          {change.action === "modified" && change.original && (
                            <div className="text-sm text-[rgb(var(--muted-foreground))]">
                              <div className="font-medium mb-1">Original ({change.original.length} chars):</div>
                              <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded text-xs line-clamp-2">
                                {change.original}
                              </div>
                            </div>
                          )}

                          <div className="text-sm">
                            <div className="font-medium mb-1">
                              Enhanced ({change.enhanced.length} chars):
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded text-xs">
                              {isExpanded ? (
                                <div className="whitespace-pre-wrap">{change.enhanced}</div>
                              ) : (
                                <div className="line-clamp-3">{change.enhanced}</div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpand(change.gapId);
                              }}
                            >
                              {isExpanded ? (
                                <>
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  Show Less
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3 mr-1" />
                                  Show More
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveApproved}
              disabled={selectedChanges.size === 0 || isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  Save Approved Changes ({selectedChanges.size})
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

