"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

export async function sendPasswordResetLink(email: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Create a clean client for this request to avoid attaching browser-session based PKCE challenges
    // We use the anon key because this is a public action (user is not logged in)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    // Get the origin for the redirect URL
    const origin = (await headers()).get("origin") || "";
    const callbackUrl = `${origin}/auth/callback?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl,
    });

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}
