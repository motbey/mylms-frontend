// supabase/functions/finalize-scorm-upload/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { S3Client, GetObjectCommand, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.609.0";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

/* ------------------------------------------------------------------ */
/*  Environment + constants                                           */
/* ------------------------------------------------------------------ */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const S3_BUCKET = Deno.env.get("S3_SCORM_BUCKET"); 
const AWS_REGION = Deno.env.get("AWS_REGION");
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function guessContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".js")) return "application/javascript";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}


/* ------------------------------------------------------------------ */
/*  Main handler                                                      */
/* ------------------------------------------------------------------ */

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  // Check AWS env vars
  if (!S3_BUCKET || !AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.error("Missing one or more AWS env vars");
    return jsonResponse({ success: false, error: "Missing AWS configuration (S3_SCORM_BUCKET / AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)" }, 500);
  }
  
  // Supabase env
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse({ success: false, error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set" }, 500);
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch (_err) {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { title, duration_minutes, zip_path } = body ?? {};
  if (!title || !zip_path) {
    return jsonResponse({ success: false, error: "Missing required fields: title, zip_path" }, 400);
  }

  // S3 key is just the file name/path inside the bucket
  const s3Key = String(zip_path);
  console.log("Finalize SCORM upload - downloading ZIP from S3", { bucket: S3_BUCKET, key: s3Key });

  /* ---------------------------- Init clients ---------------------------- */

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const s3 = new S3Client({
    region: AWS_REGION,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  });

  /* --------------------------- Download ZIP ----------------------------- */

  let zipBytes: Uint8Array;
  try {
    const getResp = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
    if (!getResp.Body) {
      throw new Error("S3 GetObject returned empty Body");
    }
    // @ts-ignore - transformToByteArray is available at runtime in Deno AWS SDK
    zipBytes = await getResp.Body.transformToByteArray();
  } catch (err) {
    console.error("Error downloading ZIP from S3:", err);
    return jsonResponse({ success: false, error: "Failed to download ZIP from S3", details: err instanceof Error ? err.message : String(err) }, 500);
  }
  
  /* ---------------------------- Unzip & upload -------------------------- */

  let zip;
  try {
    zip = await JSZip.loadAsync(zipBytes);
  } catch (err) {
    console.error("Error reading ZIP file:", err);
    return jsonResponse({ success: false, error: "Failed to read ZIP archive", details: err instanceof Error ? err.message : String(err) }, 500);
  }

  const moduleFolder = crypto.randomUUID();
  const basePath = `modules/${moduleFolder}/`; // S3 prefix
  let launchRelativePath: string | null = null;
  
  // Parallel upload setup
  const uploadPromises = [];
  const entries = Object.entries(zip.files);
  console.log(`Unzipping ${entries.length} entries into S3 prefix`, basePath);

  for (const [relativePath, entry] of entries) {
    // @ts-ignore JSZip types
    if (entry.dir) continue;
    
    // We start the upload process for each file
    uploadPromises.push(async () => {
      // @ts-ignore JSZip types
      const fileData = await entry.async("uint8array");
      const destKey = `${basePath}${relativePath}`;
      const contentType = guessContentType(relativePath);

      await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: destKey, Body: fileData, ContentType: contentType }));
    });

    const lower = relativePath.toLowerCase();
    if (!launchRelativePath && (lower.endsWith("index.html") || lower.endsWith("story.html") || lower.endsWith("index_lms.html"))) {
      launchRelativePath = relativePath;
    }
  }

  try {
    // Execute uploads in batches to avoid overwhelming resources, or all at once if list is small.
    // For simplicity in this environment, Promise.all works well for moderate sizes.
    await Promise.all(uploadPromises.map(p => p()));
  } catch (err) {
    console.error("Error during parallel upload:", err);
    return jsonResponse({ success: false, error: "Failed to upload unzipped files to S3", details: err instanceof Error ? err.message : String(err) }, 500);
  }

  if (!launchRelativePath) {
    launchRelativePath = "index.html";
  }

  const storagePath = basePath; // prefix inside bucket
  const launchKey = `${basePath}${launchRelativePath}`;
  
  // We store ONLY the S3 key (modules/uuid/index.html) in the DB now.
  // This aligns with the new /scorm/ proxy logic.
  const dbLaunchPath = launchKey;

  console.log("Calling create_scorm_module with:", {
    p_title: title,
    p_storage_path: storagePath,
    p_launch_url: dbLaunchPath,
    p_duration_minutes: duration_minutes ?? null,
  });

  /* ---------------------- Insert DB record via RPC ---------------------- */

  let moduleData;
  try {
    const { data, error } = await supabase.rpc("create_scorm_module", {
      p_title: title,
      p_storage_path: storagePath,
      p_launch_url: dbLaunchPath,
      p_duration_minutes: duration_minutes ?? null,
    });
    if (error) {
      console.error("create_scorm_module error:", error);
      return jsonResponse({ success: false, error: "Error creating SCORM module", details: { message: error.message, hint: error.hint ?? null, code: error.code ?? null }}, 500);
    }
    moduleData = data;
  } catch (err) {
    console.error("Unexpected error calling create_scorm_module:", err);
    return jsonResponse({ success: false, error: "Unexpected error calling create_scorm_module", details: err instanceof Error ? err.message : String(err) }, 500);
  }

  /* ------------------------------ Success ------------------------------- */
  
  return jsonResponse({
    success: true,
    message: "SCORM package processed successfully.",
    module: moduleData,
    launchUrl: dbLaunchPath,
  });
});