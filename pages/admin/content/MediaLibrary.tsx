import React from "react";
import { ImageUploadAndLibrary, MediaAsset } from "../../../src/components/media";

export default function MediaLibraryPage(): React.ReactElement {
  const handleSelectAsset = (asset: MediaAsset) => {
    console.log("Selected asset for block:", asset);
    // In a real implementation, you might:
    // - Store this in state
    // - Pass it to a parent component
    // - Use it to insert into a lesson/module
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="text-gray-600 mt-1">
            Upload and manage your images with AI-generated metadata.
          </p>
        </div>

        <ImageUploadAndLibrary onSelectAsset={handleSelectAsset} />
      </div>
    </div>
  );
}

