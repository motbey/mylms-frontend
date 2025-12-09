import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  S3Client,
  GetObjectCommand,
} from "https://esm.sh/@aws-sdk/client-s3@3.609.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.609.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY");
const AWS_REGION = Deno.env.get("AWS_REGION");
const S3_MEDIA_BUCKET = Deno.env.get("S3_MEDIA_BUCKET");

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (
  !SUPABASE_URL || !SUPABASE_ANON_KEY ||
  !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY ||
  !AWS_REGION || !S3_MEDIA_BUCKET || !OPENAI_API_KEY
) {
  console.error("Missing required environment variables for ai-generate-image-metadata");
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
});

serve(async (req) => {
  // Preflight
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

    // Ensure user is logged in (RLS ties asset to uploader)
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

    const { assetId } = body as { assetId: string };

    if (!assetId) {
      return new Response("Missing assetId", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 1) Fetch media_assets row; RLS ensures user owns it
    const { data: asset, error: assetError } = await supabaseClient
      .from("media_assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      console.error("Error fetching media asset", assetError);
      return new Response("Media asset not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // 2) Signed GET URL for the image
    const getCommand = new GetObjectCommand({
      Bucket: S3_MEDIA_BUCKET,
      Key: asset.s3_key,
    });

    const signedGetUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 900, // 15 minutes
    });

    // 3) Call OpenAI Vision
    const systemPrompt =
      "You are an assistant that analyses training images for a Learning Management System. " +
      "Return concise alt text, a short title, description, tags, and Memory-Based Learning (MBL) metadata. " +
      "Respond ONLY in valid JSON that matches the provided schema.";

    const userTextPrompt =
      "Analyse this image used in workplace training. " +
      "Return JSON with:\n" +
      "- alt_text: accessible alt text (max ~120 chars)\n" +
      "- title: short human-friendly title (max ~60 chars)\n" +
      "- description: 1–3 sentence description of what is happening\n" +
      "- tags: array of 3–10 lowercase keywords (no spaces in each tag, use-kebab-case-or-underscores)\n" +
      "- behaviour_tag: one of: 'reflection', 'scenario', 'knowledge', 'process', 'safety', 'visual-aid', 'other'\n" +
      "- cognitive_skill: Bloom-style verb, e.g. 'Remember', 'Understand', 'Apply', 'Analyse', 'Evaluate', 'Create'\n" +
      "- learning_pattern: one of: 'Microlearning', 'Scenario-based', 'Reference', 'Job-aid', 'Other'\n" +
      "- difficulty: integer 0–10 where 0 is trivial decorative image and 10 is highly complex/abstract.\n" +
      "If unsure, choose the closest reasonable values.";

    const schema = {
      name: "ImageMetadata",
      schema: {
        type: "object",
        properties: {
          alt_text: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
          behaviour_tag: { type: "string" },
          cognitive_skill: { type: "string" },
          learning_pattern: { type: "string" },
          difficulty: { type: "integer" },
        },
        required: [
          "alt_text",
          "title",
          "description",
          "tags",
          "behaviour_tag",
          "cognitive_skill",
          "learning_pattern",
          "difficulty",
        ],
        additionalProperties: true,
      },
      strict: true,
    };

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        response_format: { type: "json_schema", json_schema: schema },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userTextPrompt },
              {
                type: "image_url",
                image_url: { url: signedGetUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      console.error("OpenAI error", errorText);

      // Mark asset as error
      await supabaseClient
        .from("media_assets")
        .update({
          status: "error",
          ai_raw: { error: errorText },
        })
        .eq("id", assetId);

      return new Response("OpenAI request failed", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const completion = await openaiRes.json();

    const contentText =
      completion.choices?.[0]?.message?.content ??
      completion.choices?.[0]?.message?.content?.[0]?.text ??
      "{}";

    let metadata: any;
    try {
      metadata = JSON.parse(contentText);
    } catch (parseErr) {
      console.error("Failed to parse OpenAI JSON", parseErr, contentText);

      await supabaseClient
        .from("media_assets")
        .update({
          status: "error",
          ai_raw: { parse_error: String(parseErr), raw: contentText },
        })
        .eq("id", assetId);

      return new Response("Failed to parse AI response", {
        status: 500,
        headers: corsHeaders,
      });
    }

    // 4) Update media_assets with AI metadata
    const { data: updated, error: updateError } = await supabaseClient
      .from("media_assets")
      .update({
        status: "ready",
        alt_text: metadata.alt_text ?? asset.alt_text,
        title: metadata.title ?? asset.title,
        description: metadata.description ?? asset.description,
        tags: metadata.tags ?? asset.tags,
        behaviour_tag: metadata.behaviour_tag ?? asset.behaviour_tag,
        cognitive_skill: metadata.cognitive_skill ?? asset.cognitive_skill,
        learning_pattern: metadata.learning_pattern ?? asset.learning_pattern,
        difficulty: metadata.difficulty ?? asset.difficulty,
        ai_source: "openai",
        ai_raw: metadata,
      })
      .eq("id", assetId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Error updating media_assets with AI metadata", updateError);
      return new Response("Failed to update media asset", {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        asset: updated,
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
    console.error("Unexpected error in ai-generate-image-metadata", err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});

