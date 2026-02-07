
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase";
import { isEditor } from "@/lib/user-roles";

export const runtime = "nodejs";

const updateCategorySchema = z.object({
    category: z.string().min(1, "Category cannot be empty"),
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check authentication and authorization
        const isUserEditor = await isEditor();

        if (!isUserEditor) {
            return NextResponse.json(
                { error: "Unauthorized: Only editors can update categories" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const validationResult = updateCategorySchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: "Invalid input", issues: validationResult.error.format() },
                { status: 400 }
            );
        }

        const { category } = validationResult.data;
        const { supabase } = createSupabaseRouteHandlerClient(request);

        // Update the book category
        const { data, error } = await supabase
            .from("books")
            .update({ category })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("Error updating book category:", error);
            return NextResponse.json(
                { error: "Failed to update category" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Server error updating category:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
