"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type FileRecord = {
    id: string;
    title: string;
    author: string | null;
    file_url: string | null;
    local_file_path: string | null;
    created_at: string;
    user_id: string;
    user_profiles?: {
        email?: string;
    };
};

export default function AdminFilesPage() {
    const [files, setFiles] = useState<FileRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            const response = await fetch("/api/admin/files");

            if (response.status === 403 || response.status === 401) {
                toast.error("Unauthorized access");
                router.push("/");
                return;
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setFiles(data.books || []);
        } catch (error) {
            console.error("Error fetching files:", error);
            toast.error("Failed to load files");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
            return;
        }

        setIsDeleting(id);
        try {
            const response = await fetch(`/api/admin/files?id=${id}`, {
                method: "DELETE",
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to delete");

            toast.success("File deleted successfully");
            setFiles(files.filter((f) => f.id !== id));
        } catch (error) {
            console.error("Error deleting file:", error);
            toast.error("Failed to delete file");
        } finally {
            setIsDeleting(null);
        }
    };

    if (isLoading) {
        return (
            <div className="container py-10 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container py-10 max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin File Manager</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage all uploaded PDF files and book entries.
                    </p>
                </div>
                <Badge variant="outline" className="text-sm px-3 py-1">
                    {files.length} Files Found
                </Badge>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px]">Book Details</TableHead>
                            <TableHead>File Source</TableHead>
                            <TableHead>Uploaded By</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {files.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No files found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            files.map((file) => (
                                <TableRow key={file.id}>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className="font-semibold">{file.title}</span>
                                            <span className="text-sm text-muted-foreground">{file.author || "Unknown Author"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm truncate max-w-[200px]" title={file.local_file_path || file.file_url || ""}>
                                                {file.local_file_path ? "Local Import" : "User Upload"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-sm">
                                            <span className="text-muted-foreground text-xs">ID: {file.user_id.substring(0, 8)}...</span>
                                            {file.user_profiles?.email && (
                                                <span>{file.user_profiles.email}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {format(new Date(file.created_at), "MMM d, yyyy")}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {(file.file_url) && (
                                                <Button variant="ghost" size="icon" asChild>
                                                    <a href={file.file_url} target="_blank" rel="noopener noreferrer" title="Download">
                                                        <Download className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                onClick={() => handleDelete(file.id, file.title)}
                                                disabled={isDeleting === file.id}
                                                title="Delete Book & File"
                                            >
                                                {isDeleting === file.id ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
