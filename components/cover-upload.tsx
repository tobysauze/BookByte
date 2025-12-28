"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { Upload, X, Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CoverUploadProps = {
  bookId: string;
  currentCoverUrl?: string | null;
  onCoverUpdate?: (coverUrl: string) => void;
};

export function CoverUpload({ bookId, currentCoverUrl, onCoverUpdate }: CoverUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentCoverUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image");
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("cover", file);

      const response = await fetch(`/api/books/${bookId}/cover`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Failed to upload cover";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setPreviewUrl(result.coverUrl);
      onCoverUpdate?.(result.coverUrl);
      toast.success("Cover image updated successfully");
      router.refresh();
    } catch (error) {
      console.error("Error uploading cover:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload cover");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveCover = async () => {
    // For now, we'll just clear the preview. In a real app, you might want to 
    // add an API endpoint to remove the cover from storage
    setPreviewUrl(null);
    onCoverUpdate?.("");
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Book Cover</Label>
      
      {/* Cover Preview */}
      <div className="relative h-48 w-36 overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--muted))]/30">
        {previewUrl ? (
          <>
            <Image
              src={previewUrl}
              alt="Book cover"
              fill
              className="object-cover"
            />
            <Button
              variant="destructive"
              size="sm"
              className="absolute right-2 top-2 h-6 w-6 p-0"
              onClick={handleRemoveCover}
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-[rgb(var(--muted-foreground))]">
            <Camera className="h-8 w-8" />
          </div>
        )}
      </div>

      {/* File Input */}
      <div className="space-y-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="text-sm"
        />
        <p className="text-xs text-[rgb(var(--muted-foreground))]">
          JPEG, PNG, or WebP. Max 5MB.
        </p>
      </div>

      {/* Upload Button */}
      {fileInputRef.current?.files?.[0] && (
        <Button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload Cover"}
        </Button>
      )}
    </div>
  );
}
