"use client";

import { useState, useEffect } from "react";

export type Folder = {
  id: string;
  name: string;
  color: string;
  created_at: string;
  highlight_count?: number;
};

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/folders");
      
      if (!response.ok) {
        throw new Error("Failed to fetch folders");
      }

      const data = await response.json();
      setFolders(data.folders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch folders");
      console.error("Error fetching folders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const createFolder = async (name: string, color: string = "blue") => {
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, color }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create folder");
      }

      const data = await response.json();
      setFolders([...folders, data.folder]);
      return data.folder;
    } catch (err) {
      console.error("Error creating folder:", err);
      throw err;
    }
  };

  const updateFolder = async (id: string, name?: string, color?: string) => {
    try {
      const response = await fetch("/api/folders", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, name, color }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update folder");
      }

      const data = await response.json();
      setFolders(folders.map(f => f.id === id ? data.folder : f));
      return data.folder;
    } catch (err) {
      console.error("Error updating folder:", err);
      throw err;
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      const response = await fetch(`/api/folders?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete folder");
      }

      setFolders(folders.filter(f => f.id !== id));
    } catch (err) {
      console.error("Error deleting folder:", err);
      throw err;
    }
  };

  const addHighlightToFolder = async (folderId: string, highlightId: string) => {
    try {
      const response = await fetch("/api/folders/highlights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folderId, highlightId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add highlight to folder");
      }

      // Refresh folders to update counts
      fetchFolders();
    } catch (err) {
      console.error("Error adding highlight to folder:", err);
      throw err;
    }
  };

  const removeHighlightFromFolder = async (folderId: string, highlightId: string) => {
    try {
      const response = await fetch(`/api/folders/highlights?folderId=${folderId}&highlightId=${highlightId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove highlight from folder");
      }

      // Refresh folders to update counts
      fetchFolders();
    } catch (err) {
      console.error("Error removing highlight from folder:", err);
      throw err;
    }
  };

  return {
    folders,
    isLoading,
    error,
    refreshFolders: fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    addHighlightToFolder,
    removeHighlightFromFolder,
  };
}






