import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const uploadCoverSchema = z.object({
  imageUrl: z.string().url(),
  fileName: z.string().min(1),
  folderId: z.string().min(1),
  driveAccessToken: z.string().min(1),
});

/**
 * Upload a cover image to Google Drive
 * Called by Google Apps Script or server-side with OAuth token
 */
export async function POST(request: NextRequest) {
  try {
    const secret = getRequiredEnv("GOOGLE_DRIVE_IMPORT_SECRET");
    const header = request.headers.get("x-import-secret");
    if (!header || header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = uploadCoverSchema.parse(await request.json());
    const { imageUrl, fileName, folderId, driveAccessToken } = body;

    // Download the image from Supabase Storage
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Upload to Google Drive using multipart/form-data
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
    
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const filePart = `--${boundary}\r\nContent-Type: image/png\r\n\r\n`;
    const endBoundary = `\r\n--${boundary}--\r\n`;

    const multipartBody = Buffer.concat([
      Buffer.from(metadataPart, "utf-8"),
      Buffer.from(filePart, "utf-8"),
      imageBuffer,
      Buffer.from(endBoundary, "utf-8"),
    ]);

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${driveAccessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => "");
      throw new Error(
        `Google Drive upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`
      );
    }

    const result = await uploadResponse.json();
    return NextResponse.json({
      success: true,
      fileId: result.id,
      webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    });
  } catch (error) {
    console.error("Error uploading cover to Google Drive:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body", details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
