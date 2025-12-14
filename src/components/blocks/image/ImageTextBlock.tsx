import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Palette,
  PanelsLeftRight,
  Stars,
  Trash2,
  X,
} from "lucide-react";
import TipTapEditor from "../../editor/TipTapEditor";
import { ImageUploadAndLibrary } from "../../media";
import type { MediaAsset } from "../../../lib/mediaAssets";
import { BlockStyleMenu, type BlockStyle } from "../BlockStyleMenu";
import {
  AppearancePanel,
  BlockMetadataPopover,
  BlockWrapper,
  FormatPanel,
  getBlockStyleClasses,
} from "../shared/LessonBuilderInternals";
import {
  DEFAULT_BLOCK_LAYOUT,
  hasBlockMetadata,
  type BlockLayout,
  type BlockMetadata,
} from "../../../types/blocks";
import type {
  AnimationDuration,
  BlockAnimation,
  LessonBlock,
} from "../../../../pages/admin/content/LessonBuilder";

// Content shape for image-text block
interface ImageTextContent {
  media_asset_id: string | null;
  public_url?: string | null;
  alt_text?: string;
  layout: {
    imagePosition: "left" | "right";
    imageWidth: 25 | 50 | 75;
  };
  text: {
    heading: string;
    body: string;
  };
  ai_metadata?: unknown; // Reserved for future AI integration
}

// ImageTextBlock component - image with text beside it
interface ImageTextBlockProps {
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

export const ImageTextBlock: React.FC<ImageTextBlockProps> = ({
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
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Extract content from block
  const imageTextContent = block.content as unknown as ImageTextContent;
  const mediaAssetId = imageTextContent?.media_asset_id || null;
  const publicUrl = imageTextContent?.public_url || null;
  const altText = imageTextContent?.alt_text || "";
  const imagePosition = imageTextContent?.layout?.imagePosition || "left";
  const imageWidth = imageTextContent?.layout?.imageWidth || 50;
  const heading = imageTextContent?.text?.heading || "";
  const body = imageTextContent?.text?.body || "";

  // Debug log to verify data is being passed to component
  console.log("ImageTextBlock render:", {
    blockId: block.id,
    body: body.substring(0, 100) + (body.length > 100 ? "..." : ""),
    publicUrl,
    imagePosition,
    imageWidth,
  });

  // Handle selecting an image from the media library
  const handleSelectAsset = (asset: MediaAsset) => {
    onChange({
      ...block,
      media_asset_id: asset.id,
      content: {
        ...block.content,
        media_asset_id: asset.id,
        public_url: asset.public_url,
        alt_text: asset.alt_text || "",
      },
    });
    setIsMediaLibraryOpen(false);
  };

  // Handle layout changes
  const handleImagePositionChange = (position: "left" | "right") => {
    onChange({
      ...block,
      content: {
        ...block.content,
        layout: {
          ...imageTextContent?.layout,
          imagePosition: position,
          imageWidth: imageTextContent?.layout?.imageWidth || 50,
        },
      },
    });
  };

  const handleImageWidthChange = (width: 25 | 50 | 75) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        layout: {
          ...imageTextContent?.layout,
          imagePosition: imageTextContent?.layout?.imagePosition || "left",
          imageWidth: width,
        },
      },
    });
  };

  // Handle text changes
  const handleHeadingChange = (newHeading: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        text: {
          ...imageTextContent?.text,
          heading: newHeading,
          body: imageTextContent?.text?.body || "",
        },
      },
    });
  };

  const handleBodyChange = (newBody: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        text: {
          ...imageTextContent?.text,
          heading: imageTextContent?.text?.heading || "",
          body: newBody,
        },
      },
    });
  };

  // Compute inline background color for custom style
  const inlineBackgroundColor =
    block.style === "custom" && block.customBackgroundColor
      ? block.customBackgroundColor
      : undefined;

  // Use block layout or fallback to defaults
  const layout = block.layout || DEFAULT_BLOCK_LAYOUT;

  // Image width mapping based on 896px canvas (max-w-4xl)
  // 25% = 224px, 50% = 448px, 75% = 672px
  const IMAGE_WIDTH_MAP: Record<number, string> = {
    25: "w-[224px]",
    50: "w-[448px]",
    75: "w-[672px]",
  };

  // Preview mode uses percentage-based widths to be responsive to container
  const PREVIEW_IMAGE_WIDTH_MAP: Record<number, string> = {
    25: "25%",
    50: "50%",
    75: "75%",
  };

  const imageWidthClass = IMAGE_WIDTH_MAP[imageWidth] ?? IMAGE_WIDTH_MAP[50];
  const previewImageWidth = PREVIEW_IMAGE_WIDTH_MAP[imageWidth] ?? "50%";

  // Preview mode rendering - uses container-responsive layout
  if (isPreviewMode) {
    const imageElement = (
      <div
        className="image-text-container flex-shrink-0 overflow-hidden rounded-lg"
        style={{ width: previewImageWidth, minWidth: "120px" }}
      >
        {publicUrl ? (
          <img
            src={publicUrl}
            alt={altText || "Image"}
            className="w-full h-auto object-cover"
          />
        ) : (
          <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
            <span className="text-gray-400 text-sm">No image</span>
          </div>
        )}
      </div>
    );

    const textElement = (
      <div
        className="flex-1 min-w-0 flex flex-col justify-center"
        style={{ minWidth: "150px" }}
      >
        {body && (
          <div
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}
      </div>
    );

    // Use flex-wrap so items stack when container is too narrow
    return (
      <div
        className={`flex flex-wrap gap-6 w-full items-start ${
          imagePosition === "right" ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {imageElement}
        {textElement}
      </div>
    );
  }

  // Image section with responsive container
  const imageSection = (
    <div
      className={`image-text-container relative flex-shrink-0 overflow-hidden rounded-lg ${imageWidthClass}`}
    >
      {publicUrl ? (
        <>
          <img
            src={publicUrl}
            alt={altText || "Selected image"}
            className="w-full h-auto object-cover rounded-lg border border-gray-200"
          />
          <button
            type="button"
            onClick={() => setIsMediaLibraryOpen(true)}
            className="absolute bottom-2 right-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white/90 hover:bg-white rounded-md shadow-sm transition-colors"
          >
            Change
          </button>
        </>
      ) : (
        <div
          className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 bg-gray-50 cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
          onClick={() => setIsMediaLibraryOpen(true)}
        >
          <svg
            className="w-10 h-10 text-gray-400"
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
          <span className="text-sm text-gray-500">Select image</span>
        </div>
      )}
    </div>
  );

  // Text section
  // DEBUG: Log what body value is being passed to TipTapEditor
  console.log("ImageTextBlock passing to TipTapEditor:", {
    blockId: block.id,
    bodyLength: body.length,
    bodyPreview: body.substring(0, 80),
    bodyIsEmpty: !body || body === "",
  });

  const textSection = (
    <div className="flex-1 min-w-0 flex flex-col">
      <TipTapEditor
        value={body || ""}
        onChange={handleBodyChange}
        placeholder="Enter body text..."
      />
    </div>
  );

  return (
    <div className="w-full group">
      <div
        className={`
          relative w-full transition-all duration-300 ease-in-out
          ${getBlockStyleClasses(block.style)}
        `}
        style={
          inlineBackgroundColor
            ? { backgroundColor: inlineBackgroundColor }
            : undefined
        }
      >
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

          {/* Style button */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStyleMenuOpen(!styleMenuOpen);
              }}
              className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
                styleMenuOpen
                  ? "text-[#ff7a00] bg-orange-50"
                  : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
              }`}
              aria-label="Block style"
              title="Style"
            >
              <Palette className="h-4 w-4" />
            </button>
            {styleMenuOpen && (
              <BlockStyleMenu
                open={styleMenuOpen}
                onClose={() => setStyleMenuOpen(false)}
                style={block.style}
                customBackgroundColor={block.customBackgroundColor}
                onChange={(newStyle, customColor) => {
                  onStyleChange(newStyle, customColor);
                  if (newStyle !== "custom") {
                    setStyleMenuOpen(false);
                  }
                }}
              />
            )}
          </div>

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
            imageTextConfig={{
              imagePosition,
              imageWidth,
              onImagePositionChange: handleImagePositionChange,
              onImageWidthChange: handleImageWidthChange,
            }}
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
            blockContent={heading || body || "Image + Text block"}
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

        {/* BLOCK CONTENT */}
        <BlockWrapper layout={layout}>
          {/* Image + Text content - always side by side */}
          <div
            className={`flex gap-6 w-full items-start ${
              imagePosition === "right" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {imageSection}
            {textSection}
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


