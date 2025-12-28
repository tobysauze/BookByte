import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to view prompts." },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("saved_prompts")
      .select("id, name, prompt, ratings, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching prompts:", error);
      return NextResponse.json(
        { error: "Failed to fetch prompts." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ prompts: data || [] });
    authResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  } catch (error) {
    console.error("Error in GET /api/prompts:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to save prompts." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, prompt } = body;

    if (!name || !prompt || typeof name !== "string" || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Name and prompt are required." },
        { status: 400 }
      );
    }

    // Upsert the prompt (insert or update if exists)
    const { data, error } = await supabase
      .from("saved_prompts")
      .upsert(
        {
          user_id: user.id,
          name: name.trim(),
          prompt: prompt.trim(),
          ratings: [],
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,name",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error saving prompt:", error);
      return NextResponse.json(
        { error: "Failed to save prompt." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ prompt: data });
    authResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  } catch (error) {
    console.error("Error in POST /api/prompts:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to delete prompts." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Prompt ID is required." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("saved_prompts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting prompt:", error);
      return NextResponse.json(
        { error: "Failed to delete prompt." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true });
    authResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  } catch (error) {
    console.error("Error in DELETE /api/prompts:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to update prompts." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, rating } = body;

    if (!id || typeof rating !== "number" || rating < 1 || rating > 10) {
      return NextResponse.json(
        { error: "Valid prompt ID and rating (1-10) are required." },
        { status: 400 }
      );
    }

    // Get current prompt
    const { data: currentPrompt, error: fetchError } = await supabase
      .from("saved_prompts")
      .select("ratings")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !currentPrompt) {
      return NextResponse.json(
        { error: "Prompt not found." },
        { status: 404 }
      );
    }

    // Add rating to array
    const updatedRatings = [...(currentPrompt.ratings || []), rating];

    const { data, error } = await supabase
      .from("saved_prompts")
      .update({
        ratings: updatedRatings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating prompt rating:", error);
      return NextResponse.json(
        { error: "Failed to update prompt rating." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ prompt: data });
    authResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  } catch (error) {
    console.error("Error in PATCH /api/prompts:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}




