import { supabase } from '../../lib/supabaseClient';

// ============================================================================
// S3 Media Images Base URL
// ============================================================================

export const MEDIA_IMAGES_BASE_URL = "https://mylms-media-images.s3.ap-southeast-2.amazonaws.com";

// ============================================================================
// MediaAsset Interface - maps to public.media_assets table
// ============================================================================

export interface MediaAsset {
  id: string;
  created_at: string;
  updated_at: string;
  uploader_id: string | null;
  file_name: string;
  mime_type: string;
  file_size_bytes: number | null;
  s3_key: string;
  checksum: string;
  width: number | null;
  height: number | null;
  status: "pending" | "processing" | "ready" | "error";
  alt_text: string | null;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  behaviour_tag: string | null;
  cognitive_skill: string | null;
  learning_pattern: string | null;
  difficulty: number | null;
  ai_source: string | null;
  ai_raw: unknown;
  is_deleted: boolean;
  public_url: string;
}

// ============================================================================
// Allowed image MIME types
// ============================================================================

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// ============================================================================
// Helper: Convert ArrayBuffer to lowercase hex string
// ============================================================================

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// ============================================================================
// Helper: Add public_url to an asset
// ============================================================================

function withPublicUrl<T extends { s3_key: string }>(asset: T): T & { public_url: string } {
  return {
    ...asset,
    public_url: `${MEDIA_IMAGES_BASE_URL}/${asset.s3_key}`,
  };
}

// ============================================================================
// Compute SHA-256 checksum of a File
// ============================================================================

export async function computeFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return arrayBufferToHex(digest);
}

// ============================================================================
// Upload image with AI metadata generation
// ============================================================================

interface PresignResponse {
  status: "exists" | "upload";
  asset: Omit<MediaAsset, "public_url">;
  uploadUrl?: string;
}

interface AiMetadataResponse {
  status: "ok" | "error";
  asset?: Omit<MediaAsset, "public_url">;
  error?: string;
}

export async function uploadImageWithAI(file: File): Promise<MediaAsset> {
  // 1) Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    throw new Error(
      `Invalid file type: "${file.type}". Allowed types are: PNG, JPEG, WebP, and SVG.`
    );
  }

  // 2) Compute checksum
  console.log("[uploadImageWithAI] Computing checksum for:", file.name);
  const checksum = await computeFileChecksum(file);
  console.log("[uploadImageWithAI] Checksum:", checksum);

  // 3) Call presign-image-upload Edge Function
  console.log("[uploadImageWithAI] Requesting presigned upload URL...");
  const { data, error } = await supabase.functions.invoke<PresignResponse>(
    "presign-image-upload",
    {
      body: {
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        checksum,
      },
    }
  );

  if (error) {
    console.error("[uploadImageWithAI] presign-image-upload error:", error);
    throw new Error(`Failed to request upload URL: ${error.message}`);
  }

  if (!data || !data.status || !data.asset) {
    console.error("[uploadImageWithAI] Invalid response from presign-image-upload:", data);
    throw new Error("Invalid response from presign-image-upload");
  }

  console.log("[uploadImageWithAI] Presign response status:", data.status);

  // 4a) If asset already exists, return it immediately
  if (data.status === "exists") {
    console.log("[uploadImageWithAI] Asset already exists, returning existing asset");
    return withPublicUrl(data.asset);
  }

  // 4b) If we need to upload, do the PUT request
  if (data.status === "upload") {
    const { uploadUrl, asset } = data;

    if (!uploadUrl) {
      console.error("[uploadImageWithAI] No uploadUrl in response:", data);
      throw new Error("No upload URL provided in response");
    }

    console.log("[uploadImageWithAI] Uploading file to S3...");
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      console.error(
        "[uploadImageWithAI] S3 upload failed:",
        uploadResponse.status,
        uploadResponse.statusText
      );
      throw new Error(
        `Failed to upload file to storage: ${uploadResponse.status} ${uploadResponse.statusText}`
      );
    }

    console.log("[uploadImageWithAI] S3 upload complete");

    // 5) Call ai-generate-image-metadata Edge Function
    console.log("[uploadImageWithAI] Triggering AI metadata for asset", asset.id);
    const { data: aiData, error: aiError } =
      await supabase.functions.invoke<AiMetadataResponse>(
        "ai-generate-image-metadata",
        {
          body: { assetId: asset.id },
        }
      );

    if (aiError) {
      console.error("[uploadImageWithAI] ai-generate-image-metadata error:", aiError);
      throw new Error(`Failed to generate AI metadata: ${aiError.message}`);
    }

    if (!aiData) {
      console.error("[uploadImageWithAI] No data returned from ai-generate-image-metadata");
      throw new Error("Failed to generate AI metadata: No response data");
    }

    if (aiData.status !== "ok") {
      console.error("[uploadImageWithAI] AI metadata status not ok:", aiData);
      throw new Error(`Failed to generate AI metadata: ${aiData.error || "Unknown error"}`);
    }

    if (!aiData.asset) {
      console.error("[uploadImageWithAI] AI metadata response missing asset:", aiData);
      throw new Error("Failed to generate AI metadata: Response missing asset data");
    }

    console.log("[uploadImageWithAI] AI metadata generated", aiData.asset);
    return withPublicUrl(aiData.asset);
  }

  // Unexpected status
  console.error("[uploadImageWithAI] Unexpected status:", data.status);
  throw new Error(`Unexpected response status: ${data.status}`);
}

// ============================================================================
// List media assets for the current user
// ============================================================================

export async function listMediaAssets(): Promise<MediaAsset[]> {
  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listMediaAssets] Error fetching media assets:", error);
    return [];
  }

  return (data ?? []).map((asset) => withPublicUrl(asset as Omit<MediaAsset, "public_url">));
}
