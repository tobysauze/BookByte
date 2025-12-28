"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, Clock, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import type { Gap, GapReport } from "@/lib/gap-detection";

type GapReportDisplayProps = {
  gapReport: GapReport;
  onEnhance: (gapIds: string[]) => void;
  isEnhancing?: boolean;
};

export function GapReportDisplay({
  gapReport,
  onEnhance,
  isEnhancing = false,
}: GapReportDisplayProps) {
  const [selectedGaps, setSelectedGaps] = useState<Set<string>>(new Set());

  const handleToggleGap = (gapId: string) => {
    setSelectedGaps(prev => {
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
    if (selectedGaps.size === gapReport.gaps.length) {
      setSelectedGaps(new Set());
    } else {
      setSelectedGaps(new Set(gapReport.gaps.map(g => g.id)));
    }
  };

  const handleEnhanceSelected = () => {
    if (selectedGaps.size > 0) {
      onEnhance(Array.from(selectedGaps));
    }
  };

  const handleEnhanceAll = () => {
    const allGapIds = gapReport.gaps
      .filter(g => g.severity === "high" || g.severity === "medium")
      .map(g => g.id);
    onEnhance(allGapIds);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800 border-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <XCircle className="h-4 w-4" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4" />;
      case "low":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (gapReport.totalGaps === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Summary Analysis Complete
          </CardTitle>
          <CardDescription>
            Your summary looks comprehensive! No major gaps detected.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[rgb(var(--accent))]" />
          Enhancement Opportunities
        </CardTitle>
        <CardDescription>
          Found {gapReport.totalGaps} potential improvements. Select gaps to enhance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-red-600">{gapReport.gapsBySeverity.high}</div>
            <div className="text-sm text-[rgb(var(--muted-foreground))]">High Priority</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{gapReport.gapsBySeverity.medium}</div>
            <div className="text-sm text-[rgb(var(--muted-foreground))]">Medium Priority</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{gapReport.gapsBySeverity.low}</div>
            <div className="text-sm text-[rgb(var(--muted-foreground))]">Low Priority</div>
          </div>
        </div>

        {/* Recommendations */}
        {gapReport.recommendations.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {gapReport.recommendations.map((rec, index) => (
                  <div key={index}>{rec}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Estimated Time */}
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--muted-foreground))]">
          <Clock className="h-4 w-4" />
          <span>Estimated enhancement time: ~{gapReport.estimatedEnhancementTime} minutes</span>
        </div>

        {/* Gap List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Gaps to Enhance</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedGaps.size === gapReport.gaps.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {gapReport.gaps.map((gap) => (
              <div
                key={gap.id}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-[rgb(var(--card))] transition-colors ${
                  selectedGaps.has(gap.id) ? "bg-[rgb(var(--accent))]/10 border-[rgb(var(--accent))]" : ""
                }`}
                onClick={() => handleToggleGap(gap.id)}
              >
                <Checkbox
                  checked={selectedGaps.has(gap.id)}
                  onCheckedChange={() => handleToggleGap(gap.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{gap.title}</h4>
                    <Badge className={getSeverityColor(gap.severity)}>
                      {getSeverityIcon(gap.severity)}
                      <span className="ml-1 capitalize">{gap.severity}</span>
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {gap.section}
                    </Badge>
                  </div>
                  <p className="text-sm text-[rgb(var(--muted-foreground))]">
                    {gap.description}
                  </p>
                  {gap.currentValue && gap.suggestedLength && (
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">
                      Current: {gap.currentValue.length} chars → Suggested: {gap.suggestedLength} chars
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            onClick={handleEnhanceSelected}
            disabled={selectedGaps.size === 0 || isEnhancing}
            className="flex-1"
          >
            {isEnhancing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Enhancing...
              </>
            ) : (
              <>
                Enhance Selected ({selectedGaps.size})
              </>
            )}
          </Button>
          <Button
            onClick={handleEnhanceAll}
            variant="outline"
            disabled={isEnhancing}
            className="flex-1"
          >
            Enhance All High & Medium Priority
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}






