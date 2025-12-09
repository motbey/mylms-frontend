import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  S3Client,
  PutObjectCommand,
} from "https://esm.sh/@aws-sdk/client-s3@3.609.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.609.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Env vars
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY");
const AWS_REGION = Deno.env.get("AWS_REGION");
const S3_MEDIA_BUCKET = Deno.env.get("S3_MEDIA_BUCKET");

if (
  !SUPABASE_URL || !SUPABASE_ANON_KEY ||
  !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY ||
  !AWS_REGION || !S3_MEDIA_BUCKET
) {
  console.error("Missing required environment variables for presign-image-upload");
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
});

function getExtension(fileName: string, mimeType: string): string {
  const nameExt = fileName.split(".").pop();
  if (nameExt && nameExt.length <= 5) {
    return nameExt.toLowerCase();
  }

  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  return "bin";
}

serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user (required – we want uploader_id)
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Auth error", userError);
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return new Response("Invalid JSON body", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const {
      fileName,
      mimeType,
      fileSizeBytes,
      checksum,
    } = body as {
      fileName: string;
      mimeType: string;
      fileSizeBytes?: number;
      checksum: string;
    };

    if (!fileName || !mimeType || !checksum) {
      return new Response(
        "Missing required fields: fileName, mimeType, checksum",
        { status: 400, headers: corsHeaders },
      );
    }

    // Basic image-only validation
    const allowedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      return new Response("Unsupported MIME type", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Optional: 20 MB limit
    if (fileSizeBytes && fileSizeBytes > 20 * 1024 * 1024) {
      return new Response("File too large (max 20MB)", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 1) Check if an asset with this checksum already exists (de-duplication)
    const { data: existing, error: existingError } = await supabaseClient
      .from("media_assets")
      .select("*")
      .eq("checksum", checksum)
      .eq("is_deleted", false)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing media_assets", existingError);
      return new Response("Error checking existing media", {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (existing) {
      // Already uploaded & catalogued
      return new Response(
        JSON.stringify({
          status: "exists",
          asset: existing,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // 2) Generate key using the checksum
    const ext = getExtension(fileName, mimeType);
    const objectKey = `images/${checksum}.${ext}`;

    const putCommand = new PutObjectCommand({
      Bucket: S3_MEDIA_BUCKET,
      Key: objectKey,
      ContentType: mimeType,
    });

    const signedUrl = await getSignedUrl(s3Client, putCommand, {
      expiresIn: 900, // 15 min
    });

    // 3) Create initial media_assets row with status = 'pending'
    const { data: inserted, error: insertError } = await supabaseClient
      .from("media_assets")
      .insert({
        uploader_id: user.id,
        file_name: fileName,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes ?? null,
        s3_key: objectKey,
        checksum,
        status: "pending",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Error inserting media_assets", insertError);
      return new Response("Error creating media record", {
        status: 500,
        headers: corsHeaders,
      });
    }

    // 4) Return signed URL + asset record
    return new Response(
      JSON.stringify({
        status: "upload",
        uploadUrl: signedUrl,
        asset: inserted,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("Unexpected error in presign-image-upload", err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});

