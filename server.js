const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// --- Constants ---
const SCORM_BUCKET_BASE = "https://mylms-scorm-packages-motbey.s3.ap-southeast-2.amazonaws.com/";

// --- SCORM Proxy Route ---
app.get("/scorm/*", async (req, res) => {
  try {
    const s3Key = req.params[0];
    if (!s3Key) return res.status(400).send("Missing SCORM key");

    const s3Url = SCORM_BUCKET_BASE + s3Key;
    console.log("[SCORM proxy] Fetching:", s3Url);

    const response = await fetch(s3Url);

    if (!response.ok) {
      console.error("[SCORM proxy] S3 error:", response.status);
      return res.status(response.status).send("Error fetching SCORM content");
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error("[SCORM proxy] Unexpected error:", err);
    res.status(500).send("Internal SCORM proxy error");
  }
});

// --- Serve frontend ---
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});