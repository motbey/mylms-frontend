import React, { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  PanelsLeftRight,
  Palette,
  Stars,
  Database,
} from "lucide-react";
import TipTapEditor from "../../editor/TipTapEditor";
import { BlockStyleMenu, type BlockStyle } from "../BlockStyleMenu";
import {
  BlockWrapper,
  FormatPanel,
  AppearancePanel,
  BlockMetadataPopover,
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

// SubheadingBlock component - standalone subheading (smaller than heading)
interface SubheadingBlockProps {
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
  moduleId?: string | null;
  pageId?: string | null;
}

export const SubheadingBlock: React.FC<SubheadingBlockProps> = ({
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

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get subheading content
  const subheadingContent = block.content.subheading ?? "";

  const handleSubheadingChange = (newSubheading: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        subheading: newSubheading,
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

          {/* Appearance (animation) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
                ? "text-purple-500 bg-purple-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
            title="Block animation"
          >
            <Stars className="h-4 w-4" />
          </button>

          {/* Block metadata */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMetadataPanel();
            }}
            aria-label="Block metadata (learning fingerprint)"
            title="Block metadata (learning fingerprint)"
            className={`relative inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isMetadataPanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
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
              onClick={onMoveUp}
              aria-label="Move block up"
              className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}

          {canMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              aria-label="Move block down"
              className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate block"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete block"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-slate-50 rounded-full transition-colors"
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
            metadata={block.metadata}
            onChange={onMetadataChange}
            onClose={onToggleMetadataPanel}
            blockId={block.id}
            blockType={block.type}
            blockContent={block.content.subheading ?? ""}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Block Style Menu */}
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
          className="top-14 left-4"
        />

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

        {/* INNER CONTENT COLUMN - Subheading only (30px font) */}
        <BlockWrapper layout={layout}>
          <TipTapEditor
            value={subheadingContent || "<p>Subheading</p>"}
            onChange={handleSubheadingChange}
            placeholder="Subheading..."
            editorClassName="focus:outline-none text-[30px] font-semibold leading-tight text-gray-800 [&_p]:my-0"
            singleLine={true}
            disableLists={true}
          />
        </BlockWrapper>
      </div>
    </div>
  );
};


