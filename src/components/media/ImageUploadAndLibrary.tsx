import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MediaAsset,
  uploadImageWithAI,
  listMediaAssets,
} from "../../lib/mediaAssets";

// ============================================================================
// Upload status types
// ============================================================================

type UploadStatus =
  | "idle"
  | "computing_checksum"
  | "requesting_url"
  | "uploading"
  | "generating_metadata"
  | "done"
  | "error";

const STATUS_MESSAGES: Record<UploadStatus, string> = {
  idle: "Ready to upload",
  computing_checksum: "Computing checksum...",
  requesting_url: "Requesting upload URL...",
  uploading: "Uploading to storage...",
  generating_metadata: "Generating AI metadata...",
  done: "Done!",
  error: "Error – see details below",
};

// ============================================================================
// Props interface
// ============================================================================

export interface ImageUploadAndLibraryProps {
  /** Called when user clicks "Use this image" on an asset */
  onSelectAsset?: (asset: MediaAsset) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ImageUploadAndLibrary({
  onSelectAsset,
}: ImageUploadAndLibraryProps): React.ReactElement {
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Load existing assets on mount
  // -------------------------------------------------------------------------
  const loadAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    try {
      const fetchedAssets = await listMediaAssets();
      setAssets(fetchedAssets);
    } catch (err) {
      console.error("[ImageUploadAndLibrary] Failed to load assets:", err);
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // -------------------------------------------------------------------------
  // Handle file selection
  // -------------------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMessage(null);
    setUploadStatus("idle");
  };

  // -------------------------------------------------------------------------
  // Handle upload
  // -------------------------------------------------------------------------
  const handleUpload = async () => {
    if (!selectedFile) return;

    setErrorMessage(null);

    try {
      // We can't easily hook into the exact stages inside uploadImageWithAI,
      // so we simulate the progression based on typical timing
      setUploadStatus("computing_checksum");

      // Small delay to show the status
      await new Promise((r) => setTimeout(r, 100));
      setUploadStatus("requesting_url");

      // Call the upload function
      const asset = await uploadImageWithAI(selectedFile);

      // If we got here without error, it worked
      setUploadStatus("done");

      // Add the new asset to the top of the list
      setAssets((prev) => [asset, ...prev.filter((a) => a.id !== asset.id)]);

      // Clear the file input
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("[ImageUploadAndLibrary] Upload failed:", err);
      setUploadStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    }
  };

  // -------------------------------------------------------------------------
  // Handle selecting an asset for use
  // -------------------------------------------------------------------------
  const handleSelectAsset = (asset: MediaAsset) => {
    setSelectedAssetId(asset.id);
    onSelectAsset?.(asset);
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const renderStatusBadge = (status: MediaAsset["status"]) => {
    const colors: Record<MediaAsset["status"], string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      ready: "bg-green-100 text-green-800",
      error: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${colors[status]}`}
      >
        {status}
      </span>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6 p-4 bg-white rounded-lg shadow">
      {/* Upload Section */}
      <div className="flex flex-col gap-4 p-4 border border-gray-200 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-800">Upload Image</h2>

        {/* File Input */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="image-upload-input"
            className="text-sm font-medium text-gray-700"
          >
            Select an image file
          </label>
          <input
            ref={fileInputRef}
            id="image-upload-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
          />
          {selectedFile && (
            <p className="text-sm text-gray-600">
              Selected: <span className="font-medium">{selectedFile.name}</span>{" "}
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Upload Button */}
        <button
          type="button"
          onClick={handleUpload}
          disabled={
            !selectedFile ||
            (uploadStatus !== "idle" &&
              uploadStatus !== "done" &&
              uploadStatus !== "error")
          }
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg
            hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
            transition-colors duration-200"
        >
          Upload Image
        </button>

        {/* Status Display */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Status:</span>
          <span
            className={`text-sm font-medium ${
              uploadStatus === "done"
                ? "text-green-600"
                : uploadStatus === "error"
                ? "text-red-600"
                : "text-gray-700"
            }`}
          >
            {STATUS_MESSAGES[uploadStatus]}
          </span>
          {(uploadStatus === "computing_checksum" ||
            uploadStatus === "requesting_url" ||
            uploadStatus === "uploading" ||
            uploadStatus === "generating_metadata") && (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}
      </div>

      {/* Media Library Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Media Library</h2>
          <button
            type="button"
            onClick={loadAssets}
            disabled={isLoadingAssets}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded
              hover:bg-gray-200 disabled:opacity-50 transition-colors duration-200"
          >
            {isLoadingAssets ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Loading State */}
        {isLoadingAssets && assets.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-gray-600">Loading assets...</span>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingAssets && assets.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            No images found. Upload your first image above!
          </div>
        )}

        {/* Asset Grid */}
        {assets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className={`flex flex-col gap-2 p-3 border rounded-lg transition-all duration-200 ${
                  selectedAssetId === asset.id
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
                }`}
              >
                {/* Image / Placeholder Area */}
                <div className="flex items-center justify-center h-32 bg-gray-200 rounded text-gray-500 text-sm overflow-hidden">
                  {asset.public_url ? (
                    <img
                      src={asset.public_url}
                      alt={
                        asset.alt_text ||
                        asset.title ||
                        asset.file_name ||
                        "Uploaded image"
                      }
                      className="w-full h-full object-contain"
                    />
                  ) : asset.width && asset.height ? (
                    <span>
                      {asset.width} × {asset.height}
                    </span>
                  ) : (
                    <span>Image</span>
                  )}
                </div>

                {/* Asset Info */}
                <div className="flex flex-col gap-1">
                  <p
                    className="text-sm font-medium text-gray-800 truncate"
                    title={asset.file_name}
                  >
                    {asset.file_name}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderStatusBadge(asset.status)}
                    <span className="text-xs text-gray-500">
                      {asset.mime_type}
                    </span>
                  </div>
                </div>

                {/* AI Metadata */}
                {asset.status === "ready" && (
                  <div className="flex flex-col gap-1 p-2 bg-white rounded border border-gray-100">
                    {asset.title && (
                      <p className="text-xs text-gray-700">
                        <span className="font-medium">Title:</span> {asset.title}
                      </p>
                    )}
                    {asset.alt_text && (
                      <p className="text-xs text-gray-700">
                        <span className="font-medium">Alt:</span> {asset.alt_text}
                      </p>
                    )}
                    {asset.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        <span className="font-medium">Desc:</span>{" "}
                        {asset.description}
                      </p>
                    )}
                    {asset.tags && asset.tags.length > 0 && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Tags:</span>{" "}
                        {asset.tags.join(", ")}
                      </p>
                    )}
                    {asset.behaviour_tag && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Behaviour:</span>{" "}
                        {asset.behaviour_tag}
                      </p>
                    )}
                    {asset.cognitive_skill && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Cognitive:</span>{" "}
                        {asset.cognitive_skill}
                      </p>
                    )}
                    {asset.learning_pattern && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Pattern:</span>{" "}
                        {asset.learning_pattern}
                      </p>
                    )}
                    {asset.difficulty !== null && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Difficulty:</span>{" "}
                        {asset.difficulty}
                      </p>
                    )}
                  </div>
                )}

                {/* Error state info */}
                {asset.status === "error" && (
                  <div className="p-2 bg-red-50 rounded text-xs text-red-700">
                    Metadata generation failed
                  </div>
                )}

                {/* Use Button */}
                <button
                  type="button"
                  onClick={() => handleSelectAsset(asset)}
                  className={`mt-auto px-3 py-1.5 text-sm font-medium rounded transition-colors duration-200 ${
                    selectedAssetId === asset.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {selectedAssetId === asset.id ? "Selected" : "Use this image"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageUploadAndLibrary;
