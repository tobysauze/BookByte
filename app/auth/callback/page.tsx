"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.replace("/library");
        router.refresh();
      }
    });

    const timeout = setTimeout(() => {
      router.replace(
        `/auth/auth-code-error?error=${encodeURIComponent("Sign-in timed out. Please try again.")}`,
      );
    }, 10000);

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
