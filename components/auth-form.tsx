"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/library`,
          },
        });
        if (signUpError) throw signUpError;
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {mode === "login" && (
            <Link
              href="/forgot-password"
              className="text-xs text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-xs text-[rgb(var(--muted-foreground))]">
          Password must be at least 6 characters.
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
      </Button>

      <p className="text-center text-xs text-[rgb(var(--muted-foreground))]">
        {mode === "login" ? "New to BookByte?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-[rgb(var(--accent))]"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
        >
          {mode === "login" ? "Create an account" : "Log in"}
        </button>
      </p>
    </form>
  );
}

