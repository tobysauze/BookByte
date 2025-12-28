import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new Error("User must be authenticated to access this resource.");
  }

  return user as User;
}

