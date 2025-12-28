"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type VisibilityToggleProps = {
  bookId: string;
  initialIsPublic: boolean;
};

export function VisibilityToggle({ bookId, initialIsPublic }: VisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    setIsUpdating(true);
    
    try {
      const response = await fetch(`/api/books/${bookId}/visibility`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_public: !isPublic }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIsPublic(!isPublic);
        } else {
          console.error("Failed to update visibility:", result.error);
        }
      } else {
        const errorData = await response.json();
        console.error("Failed to update visibility:", errorData.error);
      }
    } catch (error) {
      console.error("Error updating visibility:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Badge variant={isPublic ? "default" : "secondary"}>
        {isPublic ? "Public" : "Private"}
      </Badge>
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={isUpdating}
      >
        {isUpdating ? "Updating..." : isPublic ? "Make Private" : "Make Public"}
      </Button>
    </div>
  );
}
