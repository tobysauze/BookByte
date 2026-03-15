"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.replace(
          `/auth/auth-code-error?error=${encodeURIComponent(
            error?.message ?? "Could not establish session",
          )}`,
        );
        return;
      }

      const { access_token, refresh_token } = data.session;

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
      });

      if (!res.ok) {
        router.replace(
          `/auth/auth-code-error?error=${encodeURIComponent("Failed to sync session")}`,
        );
        return;
      }

      router.replace("/library");
      router.refresh();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        syncSession();
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        syncSession();
      }
    });

    const timeout = setTimeout(() => {
      router.replace(
        `/auth/auth-code-error?error=${encodeURIComponent("Sign-in timed out. Please try again.")}`,
      );
    }, 15000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 text-[rgb(var(--muted-foreground))]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p>Completing sign in…</p>
      </div>
    </div>
  );
}
