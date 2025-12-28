"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

type UploadChaptersButtonProps = {
  bookId: string;
};

export function UploadChaptersButton({ bookId }: UploadChaptersButtonProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChapter, setCurrentChapter] = useState<string | null>(null);

  const ACCEPTED_TYPES = ["application/pdf", "text/plain", "text/markdown", "application/epub+zip"];

  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const newFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (
        ACCEPTED_TYPES.includes(file.type) ||
        file.name.endsWith(".pdf") ||
        file.name.endsWith(".epub") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".md")
      ) {
        newFiles.push(file);
      }
    }

    if (newFiles.length === 0) {
      toast.error("Please upload PDF, EPUB, TXT, or Markdown files.");
      return;
    }

    // Sort files by name to ensure chapter order
    newFiles.sort((a, b) => a.name.localeCompare(b.name));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one chapter file");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setCurrentChapter(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      // Use fetch with progress tracking
      const response = await fetch(`/api/books/${bookId}/upload-chapters`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload chapters");
      }

      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        toast.warning(`Processed ${result.processed}/${result.total} chapters. Some errors occurred.`);
        console.error("Chapter processing errors:", result.errors);
      } else {
        toast.success(`Successfully processed ${result.processed} chapter(s)!`);
      }
      
      setIsOpen(false);
      setFiles([]);
      setProgress(0);
      setCurrentChapter(null);
      
      // Refresh the page to show the updated summary
      router.refresh();
    } catch (error) {
      console.error("Error uploading chapters:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload chapters");
    } finally {
      setIsUploading(false);
      setProgress(0);
      setCurrentChapter(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Upload Chapters
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Chapter Files</DialogTitle>
          <DialogDescription>
            Upload multiple chapter files (PDF, EPUB, TXT, or Markdown). Each chapter will be processed individually and then combined into a comprehensive summary. Files will be processed in alphabetical order.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="chapter-files">
              Chapter Files <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-col gap-3">
              <Input
                ref={inputRef}
                id="chapter-files"
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Select Chapter Files
              </Button>
              
              {files.length > 0 && (
                <div className="space-y-2 mt-2">
                  <p className="text-sm font-medium">
                    Selected Files ({files.length}):
                  </p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border rounded-md bg-[rgb(var(--muted))]/50"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-[rgb(var(--muted-foreground))] flex-shrink-0" />
                          <span className="text-sm truncate" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-xs text-[rgb(var(--muted-foreground))] flex-shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        {!isUploading && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-[rgb(var(--muted-foreground))]">
              Supported formats: PDF, EPUB, TXT, Markdown. Files will be processed sequentially.
            </p>
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgb(var(--muted-foreground))]">
                  {currentChapter ? `Processing: ${currentChapter}` : "Processing chapters..."}
                </span>
                <span className="text-[rgb(var(--muted-foreground))]">
                  {progress > 0 ? `${Math.round(progress)}%` : ""}
                </span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setFiles([]);
                setProgress(0);
                setCurrentChapter(null);
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process {files.length > 0 ? `(${files.length} files)` : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}




