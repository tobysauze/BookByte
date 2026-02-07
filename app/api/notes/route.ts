import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase";

export const runtime = "nodejs";

const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional(),
  bookId: z.string().uuid().optional().nullable(),
});

const updateNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional(),
  bookId: z.string().uuid().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    const { data, error } = await supabase
      .from("user_notes")
      .select("id, user_id, book_id, title, content, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes:", error);
      const res = NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
      authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    const res = NextResponse.json({ notes: data ?? [] }, { status: 200 });
    authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
    return res;
  } catch (error) {
    console.error("Error in GET /api/notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, response: authResponse } = createSupabaseRouteHandlerClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    const body = createNoteSchema.parse(await request.json());
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("user_notes")
      .insert({
        user_id: user.id,
        book_id: body.bookId ?? null,
        title: body.title ?? "Untitled note",
        content: body.content ?? "",
        created_at: now,
        updated_at: now,
      })
      .select("id, user_id, book_id, title, content, created_at, updated_at")
      .single();

    if (error) {
      console.error("Error creating note:", error);
      const res = NextResponse.json({ error: error.message || "Failed to create note" }, { status: 500 });
      authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    const res = NextResponse.json({ note: data }, { status: 201 });
    authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
    return res;
  } catch (error) {
    console.error("Error in POST /api/notes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
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
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    const body = updateNoteSchema.parse(await request.json());
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.content !== undefined) updatePayload.content = body.content;
    if (body.bookId !== undefined) updatePayload.book_id = body.bookId;

    const { data, error } = await supabase
      .from("user_notes")
      .update(updatePayload)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select("id, user_id, book_id, title, content, created_at, updated_at")
      .single();

    if (error) {
      console.error("Error updating note:", error);
      const res = NextResponse.json({ error: error.message || "Failed to update note" }, { status: 500 });
      authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    const res = NextResponse.json({ note: data }, { status: 200 });
    authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
    return res;
  } catch (error) {
    console.error("Error in PATCH /api/notes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
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
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      const res = NextResponse.json({ error: "Missing note id" }, { status: 400 });
      authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    const { error } = await supabase
      .from("user_notes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting note:", error);
      const res = NextResponse.json({ error: error.message || "Failed to delete note" }, { status: 500 });
      authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
      return res;
    }

    const res = NextResponse.json({ success: true }, { status: 200 });
    authResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
    return res;
  } catch (error) {
    console.error("Error in DELETE /api/notes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

