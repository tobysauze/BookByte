"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error") || "An unknown authentication error occurred.";

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="mx-auto max-w-md space-y-8 rounded-4xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 shadow-sm text-center">
                <div className="flex justify-center mb-4">
                    <div className="rounded-full bg-red-100 p-3 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                </div>

                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400">Authentication Failed</h1>
                    <p className="text-sm text-[rgb(var(--muted-foreground))]">
                        We couldn't verify your request.
                    </p>
                </header>

                <div className="rounded-lg bg-[rgb(var(--muted))] p-4 text-sm font-medium">
                    {error}
                </div>

                <div className="space-y-4 pt-4">
                    <Button asChild className="w-full">
                        <Link href="/login">Return to Login</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/">Back to Home</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
