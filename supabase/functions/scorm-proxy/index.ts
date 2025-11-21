import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.609.0";

// FIX: Declare the Deno global to satisfy the TypeScript type checker.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// --- Configuration ---
const S3_BUCKET = Deno.env.get("S3_SCORM_BUCKET");
const AWS_REGION = Deno.env.get("AWS_REGION");
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // 1. Parse the S3 Key from the URL
    const url = new URL(req.url);
    let key = url.pathname;

    // Handle routing: strip '/scorm/' prefix if present (standard proxy route)
    if (key.startsWith("/scorm/")) {
      key = key.replace("/scorm/", "");
    } 
    // Handle direct invocation: strip '/functions/v1/scorm-proxy/'
    else if (key.includes("/scorm-proxy/")) {
      const parts = key.split("/scorm-proxy/");
      key = parts[1] || "";
    }
    // Fallback: remove leading slash
    else if (key.startsWith("/")) {
      key = key.substring(1);
    }

    key = decodeURIComponent(key);

    if (!key || key.trim() === "") {
      return new Response("File not found", { status: 404 });
    }

    if (!S3_BUCKET || !AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.error("Missing AWS configuration");
      return new Response("Internal Server Configuration Error", { status: 500 });
    }

    // 2. Fetch from S3
    const s3 = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    const s3Response = await s3.send(command);

    // 3. Stream response back
    const headers = new Headers(corsHeaders);
    if (s3Response.ContentType) {
      headers.set("Content-Type", s3Response.ContentType);
    }
    if (s3Response.ContentLength) {
      headers.set("Content-Length", String(s3Response.ContentLength));
    }
    // Cache static assets for 1 hour
    headers.set("Cache-Control", "public, max-age=3600");

    // s3Response.Body is a stream in the Edge Runtime
    // @ts-ignore: AWS SDK Body type vs Deno Response body compatibility
    return new Response(s3Response.Body.transformToWebStream ? s3Response.Body.transformToWebStream() : s3Response.Body, {
      status: 200,
      headers,
    });

  } catch (err: any) {
    console.error("SCORM Proxy Error:", err);
    
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return new Response("File not found", { status: 404 });
    }

    return new Response("Internal Server Error", { status: 500 });
  }
});