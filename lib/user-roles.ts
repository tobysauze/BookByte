import { createSupabaseServerClient } from "./supabase";

export type UserRole = "editor" | "regular";

export interface UserProfile {
  id: string;
  is_editor: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get the current user's role
 */
export async function getUserRole(): Promise<UserRole | null> {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("is_editor")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      console.error("Error fetching user profile:", error);
      return "regular"; // Default to regular user if profile not found
    }

    return profile.is_editor ? "editor" : "regular";
  } catch (error) {
    console.error("Error getting user role:", error);
    return "regular"; // Default to regular user on error
  }
}

/**
 * Get the current user's full profile
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      console.error("Error fetching user profile:", error);
      return null;
    }

    return profile as UserProfile;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

/**
 * Check if the current user is an editor
 */
export async function isEditor(): Promise<boolean> {
  const role = await getUserRole();
  return role === "editor";
}

/**
 * Check if the current user can edit a book
 */
export async function canEditBook(bookUserId: string, bookIsPublic: boolean): Promise<boolean> {
  const role = await getUserRole();
  
  if (role === "editor") {
    return true; // Editors can edit any book
  }
  
  // Regular users can edit their own books regardless of public status
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  return user.id === bookUserId;
}

/**
 * Check if the current user can edit a book (using provided supabase client)
 */
export async function canEditBookWithClient(
  supabase: any, 
  bookUserId: string, 
  bookIsPublic: boolean
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log("No user found in canEditBookWithClient");
      return false;
    }
    
    console.log("Checking edit permissions for user:", user.id, "book owner:", bookUserId, "is public:", bookIsPublic);
    
    // For now, let's simplify: users can edit their own books regardless of public status
    // This avoids the user_profiles table dependency
    const canEdit = user.id === bookUserId;
    
    console.log("Can edit result:", canEdit);
    return canEdit;
    
    // TODO: Re-enable editor check once user_profiles table is properly set up
    /*
    // Check if user is an editor
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("is_editor")
      .eq("id", user.id)
      .single();
    
    if (error) {
      console.error("Error fetching user profile in canEditBookWithClient:", error);
      // If we can't check the profile, fall back to checking if it's their own book
      return user.id === bookUserId && !bookIsPublic;
    }
    
    if (profile?.is_editor) {
      return true; // Editors can edit any book
    }
    
    // Regular users can edit their own books regardless of public status
    return user.id === bookUserId;
    */
  } catch (error) {
    console.error("Error in canEditBookWithClient:", error);
    return false;
  }
}

/**
 * Check if the current user can delete a book
 */
export async function canDeleteBook(bookUserId: string): Promise<boolean> {
  const role = await getUserRole();
  
  if (role === "editor") {
    return true; // Editors can delete any book
  }
  
  // Regular users can only delete their own books
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  return user.id === bookUserId;
}

/**
 * Check if the current user can delete a book (using provided supabase client)
 */
export async function canDeleteBookWithClient(
  supabase: any, 
  bookUserId: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  // Check if user is an editor
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_editor")
    .eq("id", user.id)
    .single();
  
  if (profile?.is_editor) {
    return true; // Editors can delete any book
  }
  
  // Regular users can only delete their own books
  return user.id === bookUserId;
}
