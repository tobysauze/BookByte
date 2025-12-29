"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
    const router = useRouter();
    const supabase = createSupabaseBrowserClient();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Handle PCKE code exchange if present in URL
    useEffect(() => {
        const exchangeCode = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");

            if (code) {
                // Exchange the code for a session
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    console.error("Error exchanging code:", error);
                    setError(error.message);
                }

                // Clear the code from the URL so we don't try to use it again
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        };

        exchangeCode();
    }, [supabase]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setIsLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) {
                throw error;
            }

            router.push("/library");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-md space-y-8 rounded-4xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 shadow-sm">
            <header className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
                    Secure your account
                </p>
                <h1 className="text-3xl font-semibold">New Password</h1>
                <p className="text-sm text-[rgb(var(--muted-foreground))]">
                    Enter your new password below.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                        id="confirmPassword"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                    />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Updating..." : "Update Password"}
                </Button>
            </form>
        </div>
    );
}
