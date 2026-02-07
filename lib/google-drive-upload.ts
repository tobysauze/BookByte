/**
 * Google Drive upload utility for book covers
 * Uploads files to a specified Google Drive folder using service account
 */

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

/**
 * Upload a file buffer to Google Drive folder
 * @param fileBuffer - The file buffer to upload
 * @param fileName - Name for the file in Drive
 * @param folderId - Google Drive folder ID
 * @param mimeType - MIME type of the file (default: image/png)
 * @returns Google Drive file ID and web view link
 */
export async function uploadToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  folderId: string,
  mimeType: string = "image/png"
): Promise<{ fileId: string; webViewLink: string } | null> {
  // Check if we have the required credentials
  const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.warn("GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY not set, skipping Google Drive upload");
    return null;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountKey);
  } catch (e) {
    throw new Error("Invalid GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY JSON");
  }

  // Get access token using service account
  const accessToken = await getServiceAccountAccessToken(serviceAccount);

  // Upload file to Google Drive using multipart/form-data
  // Create multipart boundary
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
  
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  // Build multipart body manually (Node.js doesn't have FormData like browser)
  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const filePart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const endBoundary = `\r\n--${boundary}--\r\n`;

  const multipartBody = Buffer.concat([
    Buffer.from(metadataPart, "utf-8"),
    Buffer.from(filePart, "utf-8"),
    fileBuffer,
    Buffer.from(endBoundary, "utf-8"),
  ]);

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
  return {
    fileId: result.id,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
  };
}

/**
 * Get access token using service account credentials
 * Uses Node.js crypto for JWT signing
 */
async function getServiceAccountAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const crypto = await import("crypto");
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claim = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    scope: "https://www.googleapis.com/auth/drive.file",
  };

  // Encode header and claim
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedClaim = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  // Sign with RSA private key
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signatureInput);
  const signature = sign.sign(serviceAccount.private_key, "base64url");

  const jwt = `${signatureInput}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
