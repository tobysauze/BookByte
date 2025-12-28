"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function CreateBookPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Check if user is logged in
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setIsChecking(false);
      } catch (error) {
        console.error("Error checking user:", error);
        router.push("/login"); // Redirect to login on error
      }
    };

    checkUser();
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/books/create-blank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create book");
      }

      const { bookId } = await response.json();
      toast.success("Blank book created successfully!");
      router.push(`/books/${bookId}`);
    } catch (error) {
      console.error("Error creating blank book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create book");
    } finally {
      setIsCreating(false);
    }
  };

  if (isChecking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">Checking permissions...</div>
      </div>
    );
  }



  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-16 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Create New Book</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Create a blank book entry that you can fill in manually. You'll be able to edit all details after creation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">
            Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            type="text"
            placeholder="Enter book title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isCreating}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="author">Author</Label>
          <Input
            id="author"
            type="text"
            placeholder="Enter author name (optional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            disabled={isCreating}
            className="w-full"
          />
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isCreating || !title.trim()}
            className="w-full sm:w-auto"
          >
            {isCreating ? "Creating..." : "Create Book"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isCreating}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

