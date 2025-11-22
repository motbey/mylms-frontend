// server.js - MyLMS runtime server for Cloud Run

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// --- SCORM S3 bucket base URL ---
// This is PUBLIC (no secret key) because the bucket is already public.
// Change only if your bucket/domain changes.
const SCORM_BUCKET_BASE =
  "https://mylms-scorm-packages-motbey.s3.ap-southeast-2.amazonaws.com/";

/**
 * /scorm/* proxy
 *
 * Example incoming URL:
 *   /scorm/modules/<uuid>/scormcontent/index.html
 *
 * We strip the "/scorm/" prefix and append the rest to SCORM_BUCKET_BASE.
 * Then we fetch the file from S3 and stream it back to the browser.
 */
app.get("/scorm/*", async (req, res) => {
  try {
    const key = req.params[0]; // everything after /scorm/
    if (!key) {
      return res.status(400).send("Missing SCORM key");
    }

    const s3Url = `${SCORM_BUCKET_BASE}${key}`;
    console.log("[SCORM proxy] Fetching from S3:", s3Url);

    // Node 18+ has global fetch
    const upstream = await fetch(s3Url);

    if (!upstream.ok) {
      console.error(
        "[SCORM proxy] S3 responded with status",
        upstream.status,
        s3Url
      );
      return res.status(upstream.status).send("Error fetching SCORM content");
    }

    // Copy content type from S3 object
    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    // Stream body back
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error("[SCORM proxy] Unexpected error:", err);
    res.status(500).send("Internal SCORM proxy error");
  }
});

// --- Static frontend (Vite build) ---

// When we build the app, Vite will output to /dist
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback – any unknown route -> index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`MyLMS server listening on port ${PORT}`);
});
