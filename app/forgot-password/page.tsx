"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ArrowLeft } from "lucide-react";
import { sendPasswordResetLink } from "@/app/actions/auth-password-reset";

export default function ForgotPasswordPage() {
    const supabase = createSupabaseBrowserClient();
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setMessage(null);
        setError(null);

        try {
            // Use Server Action to avoid client-side PKCE cookie dependency
            const { error } = await sendPasswordResetLink(email);

            if (error) {
                throw new Error(error);
            }

            setMessage("Check your email for the password reset link.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-md space-y-8 rounded-4xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 shadow-sm">
            <header className="space-y-2 text-center">
                <Link
                    href="/login"
                    className="inline-flex items-center text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                >
                    <ArrowLeft className="mr-1 h-3 w-3" /> Back to Login
                </Link>
                <h1 className="text-3xl font-semibold">Reset Password</h1>
                <p className="text-sm text-[rgb(var(--muted-foreground))]">
                    Enter your email to receive a password reset link.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                    />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
                {message && <p className="text-sm text-green-600">{message}</p>}

                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
            </form>
        </div>
    );
}
