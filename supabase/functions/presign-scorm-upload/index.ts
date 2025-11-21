// supabase/functions/presign-scorm-upload/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@^3.585.0';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@^3.585.0';
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// Standard CORS headers for Supabase functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// FIX: Declare the Deno global to satisfy the TypeScript type checker.
// This is a type-level fix and does not affect the runtime, where 'Deno' is globally available.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { file_name, content_type, title, duration_minutes } = body;

    // Fallback to old param names if snake_case ones aren't present, for backward compatibility if needed,
    // though the frontend update now strictly sends snake_case.
    const fName = file_name || body.fileName;
    const cType = content_type || body.contentType;

    if (!fName || typeof fName !== 'string' || !cType || typeof cType !== 'string') {
      throw new Error('file_name (string) and content_type (string) are required in the request body.')
    }
    
    // Read AWS credentials and configuration securely from environment variables
    const region = Deno.env.get('AWS_REGION');
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const bucket = Deno.env.get('S3_SCORM_BUCKET');

    if (!region || !accessKeyId || !secretAccessKey || !bucket) {
        throw new Error("AWS configuration is missing from environment variables.");
    }

    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    // Generate a unique key for the S3 object to prevent file collisions
    const s3Key = `scorm-packages/${crypto.randomUUID()}/${fName}`

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: cType,
    })

    // Generate the pre-signed URL, valid for 1 hour (3600 seconds)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

    // Return structure matching the new frontend expectation
    return new Response(
      JSON.stringify({ 
        success: true, 
        uploadUrl, 
        s3Key, // Used by frontend step 3
        metadata: {
            title: title || null,
            duration_minutes: duration_minutes || null,
            file_name: fName
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})