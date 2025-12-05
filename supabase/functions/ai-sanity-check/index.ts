// Supabase Edge Function: ai-sanity-check
// Performs AI-powered sanity checking on block metadata

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { block_id, block_content, ai1_metadata } = await req.json();

    if (!ai1_metadata) {
      return new Response(
        JSON.stringify({ error: "No ai1_metadata provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI for sanity check
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `You are a metadata QA assistant for an LMS (Learning Management System). You will review block metadata and return a JSON array of corrections for fields that are inconsistent, inaccurate, or logically flawed.

Review these fields:
- behaviour_tag: Should match the content's purpose (instruction, assessment, reflection, etc.)
- cognitive_skill: Should align with what the learner is actually doing (remember, understand, apply, analyse, evaluate, create)
- learning_pattern: Should match how the content is structured (microlearning, scenario-based, spaced-repetition, etc.)
- difficulty: Should be 0-10 and match the actual complexity of the content

Return ONLY a JSON array of corrections. If everything looks correct, return an empty array [].

Use this shape for each correction:
{
  "field_name": "difficulty",
  "original_value": "7",
  "suggested_value": "5",
  "reason": "The task is simple reflection and does not warrant a high difficulty.",
  "confidence": 0.85
}

Be constructive and explain why changes are needed.`
          },
          {
            role: "user",
            content: `Please review this block metadata:\n\nBlock Content Preview:\n${block_content?.slice(0, 500) || "No content"}\n\nAI-Generated Metadata:\n${JSON.stringify(ai1_metadata, null, 2)}`
          }
        ]
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "OpenAI API error", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const aiContent = openaiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse AI response
    let suggestions = [];
    try {
      // Extract JSON from response (in case AI adds extra text)
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        suggestions = JSON.parse(aiContent);
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", aiContent);
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse AI response", 
          raw: aiContent 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optionally log to database
    if (suggestions.length > 0 && block_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          for (const suggestion of suggestions) {
            await supabase.from("metadata_review_log").insert({
              block_id: block_id,
              field_name: suggestion.field_name,
              original_value: String(suggestion.original_value),
              suggested_value: String(suggestion.suggested_value),
              reason: suggestion.reason,
              confidence: suggestion.confidence,
              created_by: "ai-sanity-checker",
            });
          }
        }
      } catch (dbErr) {
        // Log but don't fail - the sanity check result is still valid
        console.error("Failed to log to database:", dbErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        suggestions,
        checked_at: new Date().toISOString(),
        issues_found: suggestions.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Sanity check error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

