"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderPlus, Folder, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFolders } from "@/lib/use-folders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FOLDER_COLORS = [
  { name: "blue", label: "Blue", bg: "bg-blue-500", text: "text-blue-500" },
  { name: "green", label: "Green", bg: "bg-green-500", text: "text-green-500" },
  { name: "yellow", label: "Yellow", bg: "bg-yellow-500", text: "text-yellow-500" },
  { name: "orange", label: "Orange", bg: "bg-orange-500", text: "text-orange-500" },
  { name: "red", label: "Red", bg: "bg-red-500", text: "text-red-500" },
  { name: "pink", label: "Pink", bg: "bg-pink-500", text: "text-pink-500" },
  { name: "purple", label: "Purple", bg: "bg-purple-500", text: "text-purple-500" },
  { name: "gray", label: "Gray", bg: "bg-gray-500", text: "text-gray-500" },
] as const;

function getFolderColorClass(color: string, type: "bg" | "text" = "bg") {
  const colorDef = FOLDER_COLORS.find(c => c.name === color) || FOLDER_COLORS[0];
  return type === "bg" ? colorDef.bg : colorDef.text;
}

export function FoldersSidebar() {
  const { folders, isLoading, createFolder, updateFolder, deleteFolder, refreshFolders } = useFolders();
  const pathname = usePathname();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string; color: string } | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("blue");
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderColor, setEditFolderColor] = useState("blue");
  const [draggedOverFolderId, setDraggedOverFolderId] = useState<string | null>(null);

  // Clear drag state when dragging ends globally
  useEffect(() => {
    const handleDragEnd = () => {
      setDraggedOverFolderId(null);
      // Dispatch custom event to notify highlights component
      window.dispatchEvent(new CustomEvent("dragLeaveFolder"));
    };

    document.addEventListener("dragend", handleDragEnd);
    return () => {
      document.removeEventListener("dragend", handleDragEnd);
    };
  }, []);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name is required");
      return;
    }

    try {
      await createFolder(newFolderName.trim(), newFolderColor);
      toast.success("Folder created");
      setNewFolderName("");
      setNewFolderColor("blue");
      setIsCreateDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create folder");
    }
  };

  const handleEditFolder = async () => {
    if (!editingFolder || !editFolderName.trim()) {
      return;
    }

    try {
      await updateFolder(editingFolder.id, editFolderName.trim(), editFolderColor);
      toast.success("Folder updated");
      setIsEditDialogOpen(false);
      setEditingFolder(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update folder");
    }
  };

  const handleDeleteFolder = async () => {
    if (!deletingFolderId) return;

    try {
      await deleteFolder(deletingFolderId);
      toast.success("Folder deleted");
      setIsDeleteDialogOpen(false);
      setDeletingFolderId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete folder");
    }
  };

  const openEditDialog = (folder: { id: string; name: string; color: string }) => {
    setEditingFolder(folder);
    setEditFolderName(folder.name);
    setEditFolderColor(folder.color);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (folderId: string) => {
    setDeletingFolderId(folderId);
    setIsDeleteDialogOpen(true);
  };

  return (
    <>
      <div className="w-64 border-r border-[rgb(var(--border))] flex flex-col h-full bg-[rgb(var(--background))]">
        <div className="p-4 border-b border-[rgb(var(--border))]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Folders</h2>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Folder</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Folder Name</label>
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Enter folder name"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateFolder();
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {FOLDER_COLORS.map((color) => (
                        <button
                          key={color.name}
                          type="button"
                          onClick={() => setNewFolderColor(color.name)}
                          className={`w-8 h-8 rounded-full ${color.bg} border-2 transition-all ${
                            newFolderColor === color.name
                              ? "border-gray-900 dark:border-gray-100 scale-110"
                              : "border-transparent hover:scale-105"
                          }`}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleCreateFolder} className="w-full">
                    Create Folder
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Link
            href="/highlights"
            className={`flex items-center gap-2 px-4 py-2 hover:bg-[rgb(var(--muted))] transition-colors ${
              pathname === "/highlights" ? "bg-[rgb(var(--muted))] border-l-2 border-[rgb(var(--accent))]" : ""
            }`}
          >
            <Folder className="h-4 w-4" />
            <span className="text-sm">All Highlights</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {isLoading ? "..." : "All"}
            </Badge>
          </Link>

          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[rgb(var(--muted-foreground))]">Loading...</div>
          ) : folders.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[rgb(var(--muted-foreground))]">
              No folders yet
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.id}
                className={`group flex items-center gap-2 px-4 py-2 transition-all duration-200 ${
                  pathname === `/highlights/folder/${folder.id}` ? "bg-[rgb(var(--muted))] border-l-2 border-[rgb(var(--accent))]" : "hover:bg-[rgb(var(--muted))]"
                } ${
                  draggedOverFolderId === folder.id 
                    ? "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400 border-l-4 shadow-lg scale-105 rounded-lg mx-2" 
                    : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraggedOverFolderId(folder.id);
                  // Dispatch custom event to notify highlights component
                  window.dispatchEvent(new CustomEvent("dragOverFolder"));
                }}
                onDragLeave={(e) => {
                  // Only remove if we're actually leaving the folder element
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX;
                  const y = e.clientY;
                  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                    setDraggedOverFolderId(null);
                    // Dispatch custom event to notify highlights component
                    window.dispatchEvent(new CustomEvent("dragLeaveFolder"));
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraggedOverFolderId(null);
                  // Dispatch custom event to notify highlights component
                  window.dispatchEvent(new CustomEvent("dragLeaveFolder"));
                  const highlightId = e.dataTransfer.getData("text/plain");
                  if (highlightId) {
                    try {
                      const response = await fetch("/api/folders/highlights", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ folderId: folder.id, highlightId }),
                      });
                      if (response.ok) {
                        toast.success(`Highlight added to "${folder.name}"`);
                        refreshFolders();
                      } else {
                        const error = await response.json();
                        toast.error(error.error || "Failed to add highlight");
                      }
                    } catch (error) {
                      toast.error("Failed to add highlight to folder");
                    }
                  }
                }}
              >
                <Link
                  href={`/highlights/folder/${folder.id}`}
                  className="flex-1 flex items-center gap-2 min-w-0"
                >
                  <Folder className={`h-4 w-4 ${getFolderColorClass(folder.color, "text")} ${draggedOverFolderId === folder.id ? "scale-125" : ""} transition-transform duration-200`} />
                  <span className={`text-sm truncate ${draggedOverFolderId === folder.id ? "font-semibold" : ""}`}>{folder.name}</span>
                  {draggedOverFolderId === folder.id && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium ml-auto">Drop here</span>
                  )}
                  {draggedOverFolderId !== folder.id && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {folder.highlight_count || 0}
                    </Badge>
                  )}
                </Link>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.preventDefault();
                      openEditDialog(folder);
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.preventDefault();
                      openDeleteDialog(folder.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Folder Name</label>
              <Input
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                placeholder="Enter folder name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEditFolder();
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex gap-2 flex-wrap">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setEditFolderColor(color.name)}
                    className={`w-8 h-8 rounded-full ${color.bg} border-2 transition-all ${
                      editFolderColor === color.name
                        ? "border-gray-900 dark:border-gray-100 scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleEditFolder} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this folder? The highlights will not be deleted, only removed from this folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingFolderId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

