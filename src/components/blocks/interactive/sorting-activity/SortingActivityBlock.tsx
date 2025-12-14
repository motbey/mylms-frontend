import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Palette,
  PanelsLeftRight,
  Pencil,
  Stars,
  Trash2,
  X,
} from "lucide-react";
import {
  BlockStyleMenu,
  type BlockStyle,
} from "../../BlockStyleMenu";
import {
  BlockMetadataPopover,
  BlockWrapper,
  FormatPanel,
} from "../../shared/LessonBuilderInternals";
import type { SortingActivityContent } from "../../sorting/sorting-types";
import { SortingActivityLearner } from "../../sorting/SortingActivityLearner";
import SortingActivityEditor from "../../sorting/SortingActivityEditor";
import {
  DEFAULT_BLOCK_LAYOUT,
  DEFAULT_BLOCK_METADATA,
  hasBlockMetadata,
  type BlockLayout,
  type BlockMetadata,
} from "../../../../types/blocks";
import type {
  AnimationDuration,
  BlockAnimation,
  LessonBlock,
} from "../../../../../pages/admin/content/LessonBuilder";

function summariseSortingForAi(content: SortingActivityContent): string {
  const categories =
    content?.categories?.map((c) => c.label).filter(Boolean) ?? [];
  const items = content?.items?.map((i) => i.text).filter(Boolean) ?? [];

  const catsPart =
    categories.length > 0
      ? `Categories (${categories.length}): ${categories.join(", ")}`
      : "No categories yet";
  const itemsPart =
    items.length > 0
      ? `Items (${items.length}): ${items.join(", ")}`
      : "No items yet";

  return `Sorting activity. ${catsPart}. ${itemsPart}.`;
}

// SortingActivityBlockInternal - Editor component for sorting activity blocks
interface SortingActivityBlockInternalProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
  onMblMetadataCleared?: () => void;
  onMblMetadataUpdated?: (mblMetadata: unknown) => void;
  onAnimationChange?: (animation: BlockAnimation) => void;
  onDurationChange?: (duration: AnimationDuration) => void;
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
}

const SortingActivityBlockInternal: React.FC<
  SortingActivityBlockInternalProps
> = ({
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
  moduleId,
  pageId,
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [isEditingSorting, setIsEditingSorting] = useState(false);
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Extract content from block
  const sortingContent = block.content as SortingActivityContent;
  const title = sortingContent?.title || "Sorting activity";
  const instructions =
    sortingContent?.instructions || "Drag each item into the correct category.";
  const categories = sortingContent?.categories || [];
  const items = sortingContent?.items || [];

  // Handler to update content via onChange
  const handleContentChange = (updatedContent: SortingActivityContent) => {
    onChange({
      ...block,
      content: updatedContent,
    });
  };

  // Get background style
  const bgStyle = block.style || "light";
  const customBgColor = block.customBackgroundColor;
  const bgColorClass =
    bgStyle === "light"
      ? "bg-white"
      : bgStyle === "gray"
      ? "bg-slate-100"
      : bgStyle === "theme"
      ? "bg-orange-500"
      : bgStyle === "themeTint"
      ? "bg-orange-50"
      : bgStyle === "dark"
      ? "bg-slate-700"
      : bgStyle === "black"
      ? "bg-slate-900"
      : bgStyle === "custom" && customBgColor
      ? ""
      : "bg-white";

  const textColorClass =
    bgStyle === "dark" || bgStyle === "black" || bgStyle === "theme"
      ? "text-white"
      : "text-slate-900";

  // Use block layout or fallback to defaults
  const layout = block.layout || DEFAULT_BLOCK_LAYOUT;

  return (
    <div
      className={`group relative rounded-xl border border-gray-200 overflow-visible transition-shadow hover:shadow-md ${bgColorClass}`}
      style={
        bgStyle === "custom" && customBgColor
          ? { backgroundColor: customBgColor }
          : undefined
      }
    >
      {/* LEFT GUTTER TOOLBAR (matching Flashcards) */}
      <div className="absolute left-4 top-6 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {/* Layout / Format */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFormatPanel();
          }}
          aria-label="Block format"
          className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
            isFormatPanelOpen
              ? "text-[#ff7a00] bg-orange-50"
              : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
          }`}
        >
          <PanelsLeftRight className="h-4 w-4" />
        </button>

        {/* Style (palette) */}
        <div className="relative">
          <button
            type="button"
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              styleMenuOpen
                ? "text-[#ff7a00] bg-orange-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
            title="Block style"
            onClick={(e) => {
              e.stopPropagation();
              setStyleMenuOpen((prev) => !prev);
            }}
          >
            <Palette className="h-4 w-4" />
          </button>
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

      {/* RIGHT GUTTER TOOLBAR (matching Flashcards) */}
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
            setIsEditingSorting(true);
          }}
          className="inline-flex items-center justify-center h-6 w-6 rounded-full text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 transition-colors"
          aria-label="Edit sorting activity"
          title="Edit sorting activity"
        >
          <Pencil className="h-4 w-4" />
        </button>
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
        />
      )}

      {/* Metadata Panel */}
      {isMetadataPanelOpen && (
        <BlockMetadataPopover
          metadata={block.metadata || DEFAULT_BLOCK_METADATA}
          onChange={onMetadataChange}
          onClose={onToggleMetadataPanel}
          blockId={block.id}
          blockType={block.type}
          blockContent={summariseSortingForAi(sortingContent)}
          savedToDb={!!block.savedToDb}
          mblMetadata={block.mblMetadata}
          onMblMetadataCleared={onMblMetadataCleared}
          onMblMetadataUpdated={onMblMetadataUpdated}
          moduleId={moduleId}
          pageId={pageId}
        />
      )}

      {/* Block content matches learner preview (builder mode, non-interactive) */}
      <BlockWrapper layout={layout}>
        <SortingActivityLearner
          mode="builder"
          content={sortingContent}
          moduleId={null}
          pageId={null}
          blockId={block.id}
        />
      </BlockWrapper>

      {/* Sorting Activity Editor Modal */}
      {isEditingSorting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsEditingSorting(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit Sorting Activity
              </h2>
              <button
                type="button"
                onClick={() => setIsEditingSorting(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content - Sorting Activity Editor */}
            <div className="flex-1 overflow-y-auto p-6">
              <SortingActivityEditor
                blockId={block.id}
                content={sortingContent}
                onChange={handleContentChange}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsEditingSorting(false)}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-[#ff7a00] hover:bg-[#e56d00] text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SortingActivityBlock = SortingActivityBlockInternal;


