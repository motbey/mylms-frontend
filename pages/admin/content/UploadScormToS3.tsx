import React, { useState, useRef } from "react";
import { supabase } from '../../../lib/supabaseClient';

// --- Local types for API responses ---
type PresignResponse = {
  success: boolean;
  uploadUrl: string;
  s3Key: string;
  metadata: {
    title: string;
    duration_minutes: number | null;
    file_name: string;
  };
};

type FinalizeResponse = {
  success: boolean;
  message: string;
  launchUrl?: string;
  module?: unknown;
};

const UploadScormToS3: React.FC = () => {
  // --- State Management ---
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Debug State ---
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setLaunchUrl(null);
    // Clear debug info on new file selection so we know we're seeing fresh data
    setDebugInfo(null);
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);
    setLaunchUrl(null);
    setDebugInfo(null);

    // --- Validation ---
    if (!file) {
      setErrorMessage("Please choose a SCORM .zip file first.");
      return;
    }
    if (!title.trim()) {
      setErrorMessage("Module title is required.");
      return;
    }

    setIsUploading(true);

    try {
      const contentType = file.type || "application/zip";
      const trimmedTitle = title.trim();
      const durationValue =
        durationMinutes.trim() === "" ? null : Number(durationMinutes);

      // --- Step 1: Get presigned URL ---
      // We keep using invoke here as it's known to be working
      const { data: presignData, error: presignError } =
        await supabase.functions.invoke("presign-scorm-upload", {
          body: {
            title: trimmedTitle,
            duration_minutes: durationValue,
            file_name: file.name,
            content_type: contentType,
          },
        });

      if (presignError || !(presignData as any)?.success) {
        console.error("Presign error payload:", presignData, presignError);
        throw new Error(
          presignError?.message ||
            `Failed to get upload URL. Details: ${JSON.stringify(presignData)}`
        );
      }

      const { uploadUrl, s3Key } = presignData as PresignResponse;

      // --- Step 2: Upload file to S3 using the presigned URL ---
      const s3Response = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });

      if (!s3Response.ok) {
        const text = await s3Response.text().catch(() => "");
        throw new Error(
          `File upload to S3 failed. Status: ${s3Response.status}. Details: ${text}`
        );
      }

      // --- Step 3: Finalize upload (Manual Fetch for Debugging) ---
      // We manually construct the request to capture full debug details
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      
      // @ts-ignore - accessing protected property for debug purposes
      const baseUrl = supabase.supabaseUrl; 
      const functionUrl = `${baseUrl}/functions/v1/finalize-scorm-upload`;

      const finalizeBody = {
        title: trimmedTitle,
        duration_minutes: durationValue,
        zip_path: s3Key,
      };

      const requestOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalizeBody),
      };

      let rawResponseText = '';
      let responseStatus = 0;
      let fetchError = null;

      try {
        const res = await fetch(functionUrl, requestOptions);
        responseStatus = res.status;
        rawResponseText = await res.text();
      } catch (e: any) {
        fetchError = e.message;
      }

      // UPDATE DEBUG STATE IMMEDIATELY
      setDebugInfo({
        url: functionUrl,
        requestBody: finalizeBody,
        // Mask token in display for security/brevity
        requestHeaders: { ...requestOptions.headers, Authorization: `Bearer ${token.substring(0, 10)}...` },
        responseStatus,
        rawResponseText,
        fetchError
      });

      if (fetchError) {
        throw new Error(`Network error calling finalize: ${fetchError}`);
      }

      if (responseStatus < 200 || responseStatus >= 300) {
        throw new Error(`Finalize function failed (Status ${responseStatus}). See debug panel.`);
      }

      let finalizeData: FinalizeResponse;
      try {
        finalizeData = JSON.parse(rawResponseText);
      } catch (e) {
        throw new Error("Finalize response was not valid JSON. See raw output below.");
      }

      if (!finalizeData.success) {
        throw new Error(finalizeData.message || "Finalize returned success: false");
      }

      const { launchUrl: finalLaunchUrl } = finalizeData;

      // --- Success ---
      setSuccessMessage("SCORM package uploaded and processed successfully.");
      setLaunchUrl(finalLaunchUrl || null);

      // Reset form
      setFile(null);
      setTitle("");
      setDurationMinutes("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error("Upload to S3 flow failed", err);
      setErrorMessage(err?.message ?? "Something went wrong while uploading.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start py-10 pb-40">
      <div className="w-full max-w-xl bg-white shadow-lg rounded-2xl p-8">
        <h1 className="text-2xl font-bold mb-2 text-slate-900">
          Upload SCORM Package to S3
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Select a SCORM .zip package, provide details, and upload it to your AWS S3 bucket.
        </p>

        <form onSubmit={handleUpload} className="space-y-6">
          <div>
            <label htmlFor="module-title" className="block text-sm font-medium text-slate-700 mb-2">
              Module Title <span className="text-red-500">*</span>
            </label>
            <input
              id="module-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full text-sm text-slate-900 border border-slate-300 rounded-md p-2 placeholder:text-slate-400 focus:ring-2 focus:ring-secondary focus:border-secondary"
              placeholder="e.g., Fire Safety Training 2024"
              required
              disabled={isUploading}
            />
          </div>

          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-2">
              Duration (minutes) <span className="text-slate-500 text-xs">(optional)</span>
            </label>
            <input
              id="duration"
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              min="0"
              className="block w-full text-sm text-slate-900 border border-slate-300 rounded-md p-2 placeholder:text-slate-400 focus:ring-2 focus:ring-secondary focus:border-secondary"
              placeholder="e.g., 30"
              disabled={isUploading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              SCORM Package (.zip)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={onFileChange}
              className="block w-full text-sm text-slate-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
              disabled={isUploading}
            />
          </div>

          {errorMessage && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              <p>{successMessage}</p>
              {launchUrl && (
                <div className="mt-2 pt-2 border-t border-emerald-200">
                  <strong className="text-xs">Launch URL:</strong>
                  <input
                    type="text"
                    readOnly
                    value={launchUrl}
                    className="mt-1 w-full text-xs text-gray-600 bg-gray-100 p-1.5 rounded break-all border-none"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isUploading || !file}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold text-white bg-slate-900 disabled:bg-slate-400"
          >
            {isUploading ? "Uploading…" : "Upload to S3"}
          </button>
        </form>
      </div>

      {/* --- DEBUG PANEL --- */}
      {debugInfo && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50 max-h-[50vh] overflow-y-auto border-t-4 border-yellow-500 font-mono text-xs shadow-2xl">
          <div className="max-w-5xl mx-auto">
            <h3 className="text-yellow-400 font-bold text-sm mb-2 uppercase tracking-wider border-b border-gray-700 pb-1">
              Edge Function Debugger: finalize-scorm-upload
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong className="text-blue-400 block mb-1">Target URL:</strong>
                <div className="bg-black p-2 rounded mb-3 break-all">{debugInfo.url}</div>

                <strong className="text-blue-400 block mb-1">Request Body (Sent):</strong>
                <pre className="bg-black p-2 rounded mb-3 whitespace-pre-wrap text-green-300">
                  {JSON.stringify(debugInfo.requestBody, null, 2)}
                </pre>

                <strong className="text-blue-400 block mb-1">Request Headers:</strong>
                <pre className="bg-black p-2 rounded mb-3 whitespace-pre-wrap text-gray-400">
                  {JSON.stringify(debugInfo.requestHeaders, null, 2)}
                </pre>
              </div>

              <div>
                <strong className="text-blue-400 block mb-1">Response Status:</strong>
                <div className={`bg-black p-2 rounded mb-3 font-bold ${debugInfo.responseStatus === 200 ? 'text-green-400' : 'text-red-500'}`}>
                  {debugInfo.responseStatus} {debugInfo.fetchError ? `(Network Error: ${debugInfo.fetchError})` : ''}
                </div>

                <strong className="text-blue-400 block mb-1">Raw Response Body:</strong>
                <pre className="bg-black p-2 rounded mb-3 whitespace-pre-wrap break-all">
                  {debugInfo.rawResponseText || <span className="italic text-gray-600">(Empty response)</span>}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadScormToS3;
