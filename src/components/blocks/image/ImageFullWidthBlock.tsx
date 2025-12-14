import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Trash2,
  PanelsLeftRight,
  Stars,
  X,
} from "lucide-react";
import {
  AppearancePanel,
  BlockMetadataPopover,
  BlockWrapper,
  FormatPanel,
} from "../shared/LessonBuilderInternals";
import type { BlockStyle } from "../BlockStyleMenu";
import {
  DEFAULT_BLOCK_LAYOUT,
  hasBlockMetadata,
  type BlockLayout,
  type BlockMetadata,
} from "../../../types/blocks";
import { ImageUploadAndLibrary } from "../../media";
import type { MediaAsset } from "../../../lib/mediaAssets";
import type {
  AnimationDuration,
  BlockAnimation,
  LessonBlock,
} from "../../../../pages/admin/content/LessonBuilder";

// Content shape for image-fullwidth block
interface ImageFullWidthContent {
  media_asset_id: string | null;
  alt_text: string;
  caption: string | null;
  public_url?: string | null; // Cached public URL for display
}

// ImageFullWidthBlock component
interface ImageFullWidthBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
  onMblMetadataCleared: () => void;
  onMblMetadataUpdated: (mblMetadata: unknown) => void;
  onAnimationChange: (animation: BlockAnimation) => void;
  onDurationChange: (duration: AnimationDuration) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isFormatPanelOpen: boolean;
  onToggleFormatPanel: () => void;
  isMetadataPanelOpen: boolean;
  onToggleMetadataPanel: () => void;
  isAppearancePanelOpen: boolean;
  onToggleAppearancePanel: () => void;
  isPreviewMode?: boolean;
}

export const ImageFullWidthBlock: React.FC<ImageFullWidthBlockProps> = ({
  block,
  onChange,
  onStyleChange,
  onLayoutChange,
  onMetadataChange,
  onMblMetadataCleared,
  onMblMetadataUpdated,
  onAnimationChange,
  onDurationChange,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isFormatPanelOpen,
  onToggleFormatPanel,
  isMetadataPanelOpen,
  onToggleMetadataPanel,
  isAppearancePanelOpen,
  onToggleAppearancePanel,
  isPreviewMode = false,
}) => {
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Extract image content from block
  const imageContent = block.content as unknown as ImageFullWidthContent;
  const mediaAssetId = imageContent?.media_asset_id || null;
  const altText = imageContent?.alt_text || "";
  const caption = imageContent?.caption || "";
  const publicUrl = imageContent?.public_url || null;

  // Handle selecting an image from the media library
  const handleSelectAsset = (asset: MediaAsset) => {
    onChange({
      ...block,
      // Set FK link at block level for database relationship
      media_asset_id: asset.id,
      // Store display info in content for rendering
      content: {
        ...block.content,
        // Keep media_asset_id in content_json too for easy access during rendering
        media_asset_id: asset.id,
        alt_text: asset.alt_text || altText || "",
        caption: caption,
        public_url: asset.public_url,
        // Store additional asset info for display
        image: {
          media_asset_id: asset.id,
          url: asset.public_url,
          alt_text: asset.alt_text || "",
          title: asset.title || "",
          description: asset.description || "",
        },
      },
    });
    setIsMediaLibraryOpen(false);
  };

  // Handle alt text change
  const handleAltTextChange = (newAltText: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        alt_text: newAltText,
      },
    });
  };

  // Handle caption change
  const handleCaptionChange = (newCaption: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        caption: newCaption || null,
      },
    });
  };

  // Use block layout or fallback to defaults
  const layout = block.layout || DEFAULT_BLOCK_LAYOUT;

  // Preview mode rendering - just show full-width image and caption
  if (isPreviewMode) {
    if (!publicUrl && !mediaAssetId) {
      return (
        <div className="py-4 text-center text-gray-400 italic text-sm">
          Image not selected
        </div>
      );
    }

    return (
      <div className="w-full">
        {publicUrl && (
          <img
            src={publicUrl}
            alt={altText || "Image"}
            className="w-full h-auto object-cover rounded-md"
          />
        )}
        {caption && (
          <p className="mt-2 text-sm text-gray-600 italic text-center">
            {caption}
          </p>
        )}
      </div>
    );
  }

  return (
    /**
     * OUTER WRAPPER with group for hover effects
     */
    <div className="w-full group">
      {/**
       * BLOCK CONTAINER – full width image (no background styling)
       */}
      <div className="relative w-full transition-all duration-300 ease-in-out">
        {/* LEFT GUTTER TOOLBAR */}
        <div className="absolute left-4 top-6 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Layout / Format */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFormatPanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isFormatPanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
            aria-label="Block format"
            title="Layout"
          >
            <PanelsLeftRight className="h-4 w-4" />
          </button>

          {/* Appearance */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
            aria-label="Block appearance"
            title="Appearance"
          >
            <Stars className="h-4 w-4" />
          </button>

          {/* MBL Metadata */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMetadataPanel();
            }}
            className={`relative inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isMetadataPanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
            aria-label="Block metadata (learning fingerprint)"
            title="Metadata"
          >
            <Database className="h-4 w-4" />
            {blockHasMetadata && !isMetadataPanelOpen && (
              <span
                className="pointer-events-none absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#ff7a00] ring-2 ring-white shadow-sm"
                aria-hidden="true"
              />
            )}
          </button>
        </div>

        {/* RIGHT GUTTER TOOLBAR */}
        <div className="absolute right-4 top-6 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Move up */}
          {canMoveUp && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              className="inline-flex items-center justify-center h-6 w-6 rounded-full text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 transition-colors"
              aria-label="Move block up"
              title="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
          {/* Move down */}
          {canMoveDown && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              className="inline-flex items-center justify-center h-6 w-6 rounded-full text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 transition-colors"
              aria-label="Move block down"
              title="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {/* Duplicate */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="inline-flex items-center justify-center h-6 w-6 rounded-full text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 transition-colors"
            aria-label="Duplicate block"
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="inline-flex items-center justify-center h-6 w-6 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label="Delete block"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Format Panel */}
        {isFormatPanelOpen && (
          <FormatPanel
            layout={layout}
            onChange={onLayoutChange}
            onClose={onToggleFormatPanel}
            hideContentWidth={true}
          />
        )}

        {/* Metadata Panel */}
        {isMetadataPanelOpen && (
          <BlockMetadataPopover
            metadata={block.metadata}
            onChange={onMetadataChange}
            onClose={onToggleMetadataPanel}
            blockId={block.id}
            blockType={block.type}
            blockContent={altText || caption || "Image block"}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Appearance/Animation Panel */}
        {isAppearancePanelOpen && (
          <AppearancePanel
            animation={block.content.animation ?? "none"}
            duration={block.content.animationDuration ?? "normal"}
            onChange={onAnimationChange}
            onDurationChange={onDurationChange}
            onClose={onToggleAppearancePanel}
          />
        )}

        {/* BLOCK CONTENT - Full width image */}
        <BlockWrapper layout={layout} fullWidth={true}>
          <div className="flex flex-col items-center gap-4 w-full">
            {/* Image or placeholder */}
            {publicUrl ? (
              <div className="flex flex-col items-center w-full">
                <img
                  src={publicUrl}
                  alt={altText || "Selected image"}
                  className="w-full h-auto object-cover rounded-md border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setIsMediaLibraryOpen(true)}
                  className="mt-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Change image
                </button>
              </div>
            ) : (
              <div
                className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-3 bg-gray-50 cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
                onClick={() => setIsMediaLibraryOpen(true)}
              >
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-gray-500">No image selected</span>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                >
                  Choose image
                </button>
              </div>
            )}

            {/* Alt text input */}
            <div className="w-full max-w-[600px] mx-auto px-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alt text
              </label>
              <input
                type="text"
                value={altText}
                onChange={(e) => handleAltTextChange(e.target.value)}
                placeholder="Describe the image for accessibility..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Caption input */}
            <div className="w-full max-w-[600px] mx-auto px-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caption (optional)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => handleCaptionChange(e.target.value)}
                placeholder="Add a caption..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Caption preview */}
            {caption && (
              <p className="w-full text-sm text-gray-500 italic text-center">
                {caption}
              </p>
            )}
          </div>
        </BlockWrapper>
      </div>

      {/* Media Library Modal */}
      {isMediaLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMediaLibraryOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Select Image
              </h2>
              <button
                type="button"
                onClick={() => setIsMediaLibraryOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ImageUploadAndLibrary onSelectAsset={handleSelectAsset} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


