"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        router.replace(
          `/auth/auth-code-error?error=${encodeURIComponent("No code provided")}`,
        );
        return;
      }

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        router.replace(
          `/auth/auth-code-error?error=${encodeURIComponent(exchangeError.message)}`,
        );
        return;
      }

      router.replace("/library");
      router.refresh();
    };

    handleCallback();
  }, [router]);

  if (error) return null;

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 text-[rgb(var(--muted-foreground))]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p>Completing sign in…</p>
      </div>
    </div>
  );
}
