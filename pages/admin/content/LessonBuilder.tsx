import React, {
  Fragment,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  X,
  LayoutGrid,
  Plus,
  Sparkles,
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import TipTapEditor from "../../../src/components/editor/TipTapEditor";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import {
  BlockStyleMenu,
  type BlockStyle,
} from "../../../src/components/blocks/BlockStyleMenu";

// Import shared block types
import {
  type BlockMetadata,
  type BlockLayout,
  type ContentWidth,
  type PaddingSize,
  DEFAULT_BLOCK_METADATA,
  DEFAULT_BLOCK_LAYOUT,
  PADDING_PRESETS,
  hasBlockMetadata,
  BEHAVIOUR_TAG_OPTIONS,
  COGNITIVE_SKILL_OPTIONS,
  LEARNING_PATTERN_OPTIONS,
} from "../../../src/types/blocks";

type LessonPage = {
  id: string;
  title: string;
};

// Block types (local to this component for now)
type LessonBlockType =
  | "heading"
  | "subheading"
  | "paragraph"
  | "paragraph-with-heading"
  | "paragraph-with-subheading"
  | "columns"
  | "table";

interface LessonBlock {
  id: string;
  type: LessonBlockType;
  orderIndex: number;
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    heading?: string; // Used by paragraph-with-heading
    subheading?: string; // Used by paragraph-with-subheading
    columnOneContent?: string; // Used by columns block
    columnTwoContent?: string; // Used by columns block
    tableContent?: unknown; // Used by table block (TipTap JSON)
    borderMode?: "normal" | "dashed" | "alternate"; // Used by table block
    html?: string;
    text?: string;
    [key: string]: unknown;
  };
}

// Helper to get Tailwind classes for block styles
function getBlockStyleClasses(style: BlockStyle): string {
  switch (style) {
    case "light":
      return "bg-gray-50 text-gray-900";
    case "gray":
      return "bg-gray-200 text-gray-900";
    case "theme":
      return "bg-[#ff7a1a] text-white";
    case "themeTint":
      return "bg-[#FFE2CC] text-gray-900";
    case "dark":
      return "bg-neutral-800 text-white";
    case "black":
      return "bg-black text-white";
    case "custom":
      // Custom is handled via inline style, keep text neutral by default
      return "text-gray-900";
    case "image":
      return "bg-cover bg-center bg-gradient-to-br from-gray-600 to-gray-800 text-white"; // placeholder gradient
    default:
      return "bg-white text-gray-900";
  }
}

// Helper to get content width classes
function getContentWidthClasses(width: ContentWidth): string {
  switch (width) {
    case "S":
      return "max-w-2xl mx-auto";
    case "M":
      return "max-w-3xl mx-auto";
    case "L":
      return "max-w-5xl mx-auto";
    default:
      return "max-w-3xl mx-auto";
  }
}

// BlockWrapper component - applies layout settings to block content
interface BlockWrapperProps {
  layout: BlockLayout;
  children: React.ReactNode;
}

const BlockWrapper: React.FC<BlockWrapperProps> = ({ layout, children }) => {
  return (
    <div
      className={`${getContentWidthClasses(layout.contentWidth)} px-8`}
      style={{
        paddingTop: `${layout.paddingTop}px`,
        paddingBottom: `${layout.paddingBottom}px`,
      }}
    >
      {children}
    </div>
  );
};

// FormatPanel component - panel for editing block layout
interface FormatPanelProps {
  layout: BlockLayout;
  onChange: (layout: BlockLayout) => void;
  onClose: () => void;
}

const FormatPanel: React.FC<FormatPanelProps> = ({
  layout,
  onChange,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay adding the listener to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleContentWidthChange = (width: ContentWidth) => {
    onChange({ ...layout, contentWidth: width });
  };

  const handlePaddingSizeChange = (size: PaddingSize) => {
    const paddingValue = PADDING_PRESETS[size];
    onChange({
      ...layout,
      paddingSize: size,
      paddingTop: paddingValue,
      paddingBottom: paddingValue,
    });
  };

  const handlePaddingTopChange = (value: number) => {
    onChange({ ...layout, paddingTop: Math.max(0, Math.min(160, value)) });
  };

  const handlePaddingBottomChange = (value: number) => {
    onChange({ ...layout, paddingBottom: Math.max(0, Math.min(160, value)) });
  };

  return (
    <div
      ref={panelRef}
      className="absolute top-14 left-4 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Format</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Content Width Section */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Content width
          </label>
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {(["S", "M", "L"] as ContentWidth[]).map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => handleContentWidthChange(width)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                  layout.contentWidth === width
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {width}
              </button>
            ))}
          </div>
        </div>

        {/* Block Padding Section */}
        <div className="border-t border-slate-200 pt-4">
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Block padding
          </label>
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {(["S", "M", "L"] as PaddingSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handlePaddingSizeChange(size)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                  layout.paddingSize === size
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {size}
              </button>
            ))}
            <span className="px-4 py-1.5 text-sm text-slate-400">…</span>
          </div>
        </div>

        {/* Padding Sliders Section */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          {/* Top Padding */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Top
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="160"
                value={layout.paddingTop}
                onChange={(e) => handlePaddingTopChange(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#ff7a00]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="160"
                  value={layout.paddingTop}
                  onChange={(e) =>
                    handlePaddingTopChange(Number(e.target.value))
                  }
                  className="w-12 px-2 py-1 text-xs text-right border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00]"
                />
                <span className="text-xs text-slate-400">px</span>
              </div>
            </div>
          </div>

          {/* Bottom Padding */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Bottom
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="160"
                value={layout.paddingBottom}
                onChange={(e) =>
                  handlePaddingBottomChange(Number(e.target.value))
                }
                className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#ff7a00]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="160"
                  value={layout.paddingBottom}
                  onChange={(e) =>
                    handlePaddingBottomChange(Number(e.target.value))
                  }
                  className="w-12 px-2 py-1 text-xs text-right border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00]"
                />
                <span className="text-xs text-slate-400">px</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// BlockMetadataPopover component - panel for editing block metadata (learning fingerprint)
interface BlockMetadataPopoverProps {
  metadata: BlockMetadata | undefined;
  onChange: (metadata: BlockMetadata) => void;
  onClose: () => void;
}

const BlockMetadataPopover: React.FC<BlockMetadataPopoverProps> = ({
  metadata,
  onChange,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleFieldChange = (partial: Partial<BlockMetadata>) => {
    // Convert empty strings to null for cleaner storage
    const cleanPartial: Partial<BlockMetadata> = {};
    for (const [key, value] of Object.entries(partial)) {
      if (value === "" || value === 0) {
        cleanPartial[key as keyof BlockMetadata] = null;
      } else {
        cleanPartial[key as keyof BlockMetadata] = value as never;
      }
    }

    onChange({
      behaviourTag: metadata?.behaviourTag ?? null,
      cognitiveSkillTag: metadata?.cognitiveSkillTag ?? null,
      learningPatternTag: metadata?.learningPatternTag ?? null,
      difficulty: metadata?.difficulty ?? null,
      notes: metadata?.notes ?? null,
      ...cleanPartial,
    });
  };

  const handleClearMetadata = () => {
    onChange({ ...DEFAULT_BLOCK_METADATA });
  };

  return (
    <div
      ref={panelRef}
      className="absolute top-14 left-4 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#ff7a00]" />
          <h3 className="text-sm font-semibold text-slate-900">
            Block metadata
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Helper text */}
        <p className="text-xs text-slate-500 leading-relaxed">
          These tags help MyLMS understand how this block contributes to
          learning.
        </p>

        {/* Behaviour Tag */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Behaviour tag
          </label>
          <select
            value={metadata?.behaviourTag ?? ""}
            onChange={(e) =>
              handleFieldChange({ behaviourTag: e.target.value })
            }
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00] bg-white"
          >
            {BEHAVIOUR_TAG_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Cognitive Skill Tag */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Cognitive skill
          </label>
          <select
            value={metadata?.cognitiveSkillTag ?? ""}
            onChange={(e) =>
              handleFieldChange({ cognitiveSkillTag: e.target.value })
            }
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00] bg-white"
          >
            {COGNITIVE_SKILL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Learning Pattern Tag */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Learning pattern
          </label>
          <select
            value={metadata?.learningPatternTag ?? ""}
            onChange={(e) =>
              handleFieldChange({ learningPatternTag: e.target.value })
            }
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00] bg-white"
          >
            {LEARNING_PATTERN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty Slider */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Difficulty
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={metadata?.difficulty ?? 0}
              onChange={(e) =>
                handleFieldChange({ difficulty: Number(e.target.value) })
              }
              className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#ff7a00]"
            />
            <span className="w-8 text-right text-xs font-medium text-slate-700">
              {metadata?.difficulty ?? 0}
            </span>
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-400">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Notes for AI / analytics{" "}
            <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={metadata?.notes ?? ""}
            onChange={(e) => handleFieldChange({ notes: e.target.value })}
            rows={3}
            placeholder="Add notes about this block's learning purpose..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00] resize-none"
          />
        </div>

        {/* Clear button */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClearMetadata}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Clear metadata
          </button>
        </div>
      </div>
    </div>
  );
};

// HeadingBlock component - standalone heading without paragraph
interface HeadingBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
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
}

const HeadingBlock: React.FC<HeadingBlockProps> = ({
  block,
  onChange,
  onStyleChange,
  onLayoutChange,
  onMetadataChange,
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get heading content
  const headingContent = block.content.heading ?? "";

  const handleHeadingChange = (newHeading: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        heading: newHeading,
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
            <LayoutGrid className="h-4 w-4" />
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
            🎨
          </button>

          {/* Appearance */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            title="Block appearance"
          >
            ✏️
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
            <Sparkles className="h-4 w-4" />
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

        {/* INNER CONTENT COLUMN - Heading only */}
        <BlockWrapper layout={layout}>
          <TipTapEditor
            value={headingContent || "<p>Heading</p>"}
            onChange={handleHeadingChange}
            placeholder="Heading..."
            editorClassName="focus:outline-none text-[40px] font-semibold leading-tight text-gray-800 [&_p]:my-0"
            singleLine={true}
            disableLists={true}
          />
        </BlockWrapper>
      </div>
    </div>
  );
};

// SubheadingBlock component - standalone subheading (smaller than heading)
interface SubheadingBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
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
}

const SubheadingBlock: React.FC<SubheadingBlockProps> = ({
  block,
  onChange,
  onStyleChange,
  onLayoutChange,
  onMetadataChange,
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
            <LayoutGrid className="h-4 w-4" />
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
            🎨
          </button>

          {/* Appearance */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            title="Block appearance"
          >
            ✏️
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
            <Sparkles className="h-4 w-4" />
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

// ColumnsBlock component - two side-by-side rich text columns
interface ColumnsBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
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
}

const ColumnsBlock: React.FC<ColumnsBlockProps> = ({
  block,
  onChange,
  onStyleChange,
  onLayoutChange,
  onMetadataChange,
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get column contents
  const columnOneContent = block.content.columnOneContent ?? "";
  const columnTwoContent = block.content.columnTwoContent ?? "";

  const handleColumnOneChange = (newContent: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        columnOneContent: newContent,
      },
    });
  };

  const handleColumnTwoChange = (newContent: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        columnTwoContent: newContent,
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
            <LayoutGrid className="h-4 w-4" />
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
            🎨
          </button>

          {/* Appearance */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            title="Block appearance"
          >
            ✏️
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
            <Sparkles className="h-4 w-4" />
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

        {/* INNER CONTENT - Two columns layout */}
        <BlockWrapper layout={layout}>
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Column 1 */}
            <div className="flex-1 min-w-0">
              <TipTapEditor
                value={
                  columnOneContent ||
                  "<p>Start writing your first column...</p>"
                }
                onChange={handleColumnOneChange}
                placeholder="Start writing your first column..."
              />
            </div>

            {/* Column 2 */}
            <div className="flex-1 min-w-0">
              <TipTapEditor
                value={
                  columnTwoContent ||
                  "<p>Start writing your second column...</p>"
                }
                onChange={handleColumnTwoChange}
                placeholder="Start writing your second column..."
              />
            </div>
          </div>
        </BlockWrapper>
      </div>
    </div>
  );
};

// Default table content for new table blocks
const DEFAULT_TABLE_CONTENT = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Column 1" }],
                },
              ],
            },
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Column 2" }],
                },
              ],
            },
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Column 3" }],
                },
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 1" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 2" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 3" }],
                },
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 4" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 5" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 6" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// Color palette for table cell backgrounds
const TABLE_CELL_COLORS = [
  "#ffffff", // White
  "#FFF4E6", // Light orange
  "#FFE0B2", // Peach
  "#E8F5E9", // Light green
  "#E3F2FD", // Light blue
  "#F3E5F5", // Light purple
  "#FFEBEE", // Light red
  "#FFF8E1", // Light yellow
];

// Custom TableCell extension with additional attributes
const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-bg-color"),
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            "data-bg-color": attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
      textAlign: {
        default: "left",
        parseHTML: (element) =>
          element.getAttribute("data-text-align") || "left",
        renderHTML: (attributes) => {
          if (!attributes.textAlign || attributes.textAlign === "left")
            return {};
          return {
            "data-text-align": attributes.textAlign,
            style: `text-align: ${attributes.textAlign}`,
          };
        },
      },
      cellStyle: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-cell-style"),
        renderHTML: (attributes) => {
          if (!attributes.cellStyle) return {};
          return {
            "data-cell-style": attributes.cellStyle,
            class: `cell-${attributes.cellStyle}`,
          };
        },
      },
    };
  },
});

// TableBlock component - editable table with TipTap
interface TableBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
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
}

const TableBlock: React.FC<TableBlockProps> = ({
  block,
  onChange,
  onStyleChange,
  onLayoutChange,
  onMetadataChange,
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showBorderDropdown, setShowBorderDropdown] = useState(false);
  const [showMergeDropdown, setShowMergeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showHeaderColorDropdown, setShowHeaderColorDropdown] = useState(false);
  const [cellAlignment, setCellAlignment] = useState("left");
  const [cellHighlight, setCellHighlight] = useState("normal");
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get table content, border mode, and header color
  const tableContent = block.content.tableContent ?? DEFAULT_TABLE_CONTENT;
  const borderMode = block.content.borderMode ?? "normal";
  const headerColor = block.content.headerColor ?? "#ff6f21"; // Default orange

  // Create TipTap editor with table extensions
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Keep history enabled (default)
      }),
      Table.configure({
        resizable: true,
        lastColumnResizable: true,
        HTMLAttributes: {
          class: `mylms-table table-${borderMode}`,
        },
      }),
      TableRow,
      TableHeader,
      CustomTableCell,
    ],
    content: tableContent,
    onUpdate: ({ editor }) => {
      onChange({
        ...block,
        content: {
          ...block.content,
          tableContent: editor.getJSON(),
        },
      });
    },
  });

  // Handle focus on the table wrapper - show toolbar
  const handleWrapperFocus = () => {
    setShowToolbar(true);
  };

  // Handle blur on the table wrapper - hide toolbar only if focus leaves entirely
  const handleWrapperBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is still within our wrapper
    const wrapper = tableWrapperRef.current;
    const relatedTarget = e.relatedTarget as Node | null;

    if (wrapper && relatedTarget && wrapper.contains(relatedTarget)) {
      // Focus is still within the wrapper, don't hide toolbar
      return;
    }

    // Focus left the wrapper entirely, hide everything
    setShowToolbar(false);
    setShowBorderDropdown(false);
    setShowMergeDropdown(false);
    setShowColorDropdown(false);
    setShowHeaderColorDropdown(false);
  };

  // Handle table click to focus editor
  const handleTableClick = () => {
    if (editor && !editor.isFocused) {
      editor.chain().focus().run();
    }
  };

  // Table toolbar command handlers
  const handleToggleHeaderRow = () => {
    if (!editor) return;
    editor.chain().focus().toggleHeaderRow().run();
  };

  const handleDeleteTable = () => {
    if (!editor) return;
    editor.chain().focus().deleteTable().run();
    onDelete(); // Also delete the block
  };

  const handleAddColumnAfter = () => {
    if (!editor) return;
    editor.chain().focus().addColumnAfter().run();
  };

  const handleAddRowAfter = () => {
    if (!editor) return;
    editor.chain().focus().addRowAfter().run();
  };

  const handleMergeCells = () => {
    if (!editor) return;
    editor.chain().focus().mergeCells().run();
    setShowMergeDropdown(false);
  };

  const handleSplitCell = () => {
    if (!editor) return;
    // splitCell only works on merged cells
    if (editor.can().splitCell()) {
      editor.chain().focus().splitCell().run();
    }
    setShowMergeDropdown(false);
  };

  // Check if split is available (only for merged cells)
  const canSplitCell = editor?.can().splitCell() ?? false;

  const handleSetCellBackgroundColor = (color: string) => {
    if (!editor) return;
    editor.chain().focus().setCellAttribute("backgroundColor", color).run();
    setShowColorDropdown(false);
  };

  const handleSetCellAlignment = (align: string) => {
    if (!editor) return;
    setCellAlignment(align);
    editor.chain().focus().setCellAttribute("textAlign", align).run();
  };

  const handleSetCellHighlight = (style: string) => {
    if (!editor) return;
    setCellHighlight(style);
    editor
      .chain()
      .focus()
      .setCellAttribute("cellStyle", style === "normal" ? null : style)
      .run();
  };

  const handleBorderModeChange = (mode: "normal" | "dashed" | "alternate") => {
    onChange({
      ...block,
      content: {
        ...block.content,
        borderMode: mode,
      },
    });
    setShowBorderDropdown(false);
  };

  // Header color options
  const HEADER_COLOR_OPTIONS = [
    { color: "#ff6f21", label: "Orange" },
    { color: "#3b82f6", label: "Blue" },
    { color: "#10b981", label: "Green" },
    { color: "#8b5cf6", label: "Purple" },
    { color: "#ef4444", label: "Red" },
    { color: "#f59e0b", label: "Amber" },
    { color: "#06b6d4", label: "Cyan" },
    { color: "#ec4899", label: "Pink" },
    { color: "#6b7280", label: "Gray" },
    { color: "#1f2937", label: "Dark" },
  ];

  const handleHeaderColorChange = (color: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        headerColor: color,
      },
    });
    setShowHeaderColorDropdown(false);
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
            <LayoutGrid className="h-4 w-4" />
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
            🎨
          </button>

          {/* Appearance */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            title="Block appearance"
          >
            ✏️
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
            <Sparkles className="h-4 w-4" />
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

        {/* INNER CONTENT - Table with TipTap */}
        <BlockWrapper layout={layout}>
          <div
            ref={tableWrapperRef}
            className="relative"
            tabIndex={-1}
            onFocus={handleWrapperFocus}
            onBlur={handleWrapperBlur}
          >
            {/* Table Toolbar - shows when table is focused */}
            {showToolbar && editor && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-3 py-2 rounded-full bg-white border border-gray-200 shadow-lg">
                {/* Toggle Header Row */}
                <button
                  type="button"
                  onClick={handleToggleHeaderRow}
                  title="Toggle header row"
                  className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors font-semibold text-sm ${
                    editor.isActive("tableHeader")
                      ? "text-[#ff7a00] bg-orange-50"
                      : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                  }`}
                >
                  H
                </button>

                {/* Header Color Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHeaderColorDropdown(!showHeaderColorDropdown);
                      setShowBorderDropdown(false);
                      setShowMergeDropdown(false);
                      setShowColorDropdown(false);
                    }}
                    title="Header row color"
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                      showHeaderColorDropdown
                        ? "text-[#ff7a00] bg-orange-50"
                        : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: headerColor }}
                    />
                  </button>
                  {showHeaderColorDropdown && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-white rounded-lg border border-gray-200 shadow-xl z-30 min-w-[220px]">
                      <div className="grid grid-cols-5 gap-3">
                        {HEADER_COLOR_OPTIONS.map((option) => (
                          <button
                            key={option.color}
                            type="button"
                            className={`w-7 h-7 rounded-full border-2 hover:scale-110 transition-transform ${
                              headerColor === option.color
                                ? "border-gray-800"
                                : "border-gray-300"
                            }`}
                            style={{ backgroundColor: option.color }}
                            onClick={() =>
                              handleHeaderColorChange(option.color)
                            }
                            title={option.label}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span className="w-px h-5 bg-gray-200 mx-1" />

                {/* Delete Table */}
                <button
                  type="button"
                  onClick={handleDeleteTable}
                  title="Delete table"
                  className="inline-flex items-center justify-center h-7 w-7 text-slate-600 hover:text-red-500 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <span className="w-px h-5 bg-gray-200 mx-1" />

                {/* Add Column */}
                <button
                  type="button"
                  onClick={handleAddColumnAfter}
                  title="Add column after"
                  className="inline-flex items-center justify-center h-7 w-7 text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors text-sm"
                >
                  ⋮⋮⋮
                </button>

                {/* Add Row */}
                <button
                  type="button"
                  onClick={handleAddRowAfter}
                  title="Add row after"
                  className="inline-flex items-center justify-center h-7 w-7 text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors text-sm"
                >
                  ≡
                </button>

                <span className="w-px h-5 bg-gray-200 mx-1" />

                {/* Border Style Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBorderDropdown(!showBorderDropdown);
                      setShowMergeDropdown(false);
                      setShowColorDropdown(false);
                      setShowHeaderColorDropdown(false);
                    }}
                    title="Table style"
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                      showBorderDropdown
                        ? "text-[#ff7a00] bg-orange-50"
                        : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                    }`}
                  >
                    🎨
                  </button>
                  {showBorderDropdown && (
                    <div className="absolute top-full left-0 mt-2 py-1 bg-white rounded-lg border border-gray-200 shadow-xl min-w-[160px] z-30">
                      <button
                        type="button"
                        onClick={() => handleBorderModeChange("normal")}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          borderMode === "normal"
                            ? "text-[#ff7a00] font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        Normal borders
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBorderModeChange("dashed")}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          borderMode === "dashed"
                            ? "text-[#ff7a00] font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        Dashed borders
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBorderModeChange("alternate")}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          borderMode === "alternate"
                            ? "text-[#ff7a00] font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        Alternate row shading
                      </button>
                    </div>
                  )}
                </div>

                {/* Merge/Split Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMergeDropdown(!showMergeDropdown);
                      setShowBorderDropdown(false);
                      setShowColorDropdown(false);
                      setShowHeaderColorDropdown(false);
                    }}
                    title="Merge/Split cells"
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                      showMergeDropdown
                        ? "text-[#ff7a00] bg-orange-50"
                        : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                    }`}
                  >
                    ▢
                  </button>
                  {showMergeDropdown && (
                    <div className="absolute top-full left-0 mt-2 py-1 bg-white rounded-lg border border-gray-200 shadow-xl min-w-[140px] z-30">
                      <button
                        type="button"
                        onClick={handleMergeCells}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-slate-50"
                      >
                        Merge cells
                      </button>
                      <button
                        type="button"
                        onClick={handleSplitCell}
                        disabled={!canSplitCell}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          canSplitCell
                            ? "text-gray-700"
                            : "text-gray-400 cursor-not-allowed"
                        }`}
                        title={
                          canSplitCell
                            ? "Split merged cell"
                            : "Only merged cells can be split"
                        }
                      >
                        Split cell{" "}
                        {!canSplitCell && (
                          <span className="text-xs text-gray-400">
                            (merge first)
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Color Picker Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowColorDropdown(!showColorDropdown);
                      setShowBorderDropdown(false);
                      setShowMergeDropdown(false);
                      setShowHeaderColorDropdown(false);
                    }}
                    title="Cell background color"
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                      showColorDropdown
                        ? "text-[#ff7a00] bg-orange-50"
                        : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                    }`}
                  >
                    💧
                  </button>
                  {showColorDropdown && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-white rounded-lg border border-gray-200 shadow-xl z-30">
                      <div className="flex gap-1">
                        {TABLE_CELL_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => handleSetCellBackgroundColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span className="w-px h-5 bg-gray-200 mx-1" />

                {/* Alignment Select */}
                <select
                  className="h-7 px-2 text-xs border border-gray-200 rounded-full bg-gray-50 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#ff7a00]"
                  value={cellAlignment}
                  onChange={(e) => handleSetCellAlignment(e.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>

                {/* Highlight Select */}
                <select
                  className="h-7 px-2 text-xs border border-gray-200 rounded-full bg-gray-50 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#ff7a00]"
                  value={cellHighlight}
                  onChange={(e) => handleSetCellHighlight(e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="highlight">Highlight</option>
                  <option value="thick">Thick border</option>
                </select>
              </div>
            )}

            {/* TipTap Table Editor */}
            <div
              className={`overflow-x-auto mylms-table-container table-${borderMode}`}
              style={{ "--header-color": headerColor } as React.CSSProperties}
              onClick={handleTableClick}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </BlockWrapper>
      </div>
    </div>
  );
};

// ParagraphBlock component
interface ParagraphBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
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
}

const ParagraphBlock: React.FC<ParagraphBlockProps> = ({
  block,
  onChange,
  onStyleChange,
  onLayoutChange,
  onMetadataChange,
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get initial HTML content
  const initialHtml =
    block.content.html && block.content.html.trim().length > 0
      ? block.content.html
      : "<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>";

  const handleContentChange = (newHtml: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        html: newHtml,
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
    /**
     * OUTER WRAPPER with group for hover effects
     */
    <div className="w-full group">
      {/**
       * BLOCK CONTAINER – full width, styled background
       * Smooth transition when style changes
       */}
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
        {/* LEFT GUTTER TOOLBAR – floats outside the content area */}
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
            <LayoutGrid className="h-4 w-4" />
          </button>

          {/* Style (palette) - opens BlockStyleMenu */}
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
            🎨
          </button>

          {/* Appearance */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            title="Block appearance"
          >
            ✏️
          </button>

          {/* Block metadata (learning fingerprint) */}
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
            <Sparkles className="h-4 w-4" />
            {/* Indicator dot when metadata is set */}
            {blockHasMetadata && !isMetadataPanelOpen && (
              <span
                className="pointer-events-none absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#ff7a00] ring-2 ring-white shadow-sm"
                aria-hidden="true"
              />
            )}
          </button>
        </div>

        {/* RIGHT GUTTER TOOLBAR – for move/duplicate/delete actions */}
        <div className="absolute right-4 top-6 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Move Up - only shown if not first block */}
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

          {/* Move Down - only shown if not last block */}
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

          {/* Duplicate */}
          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate block"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete block"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-slate-50 rounded-full transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Format Panel – positioned relative to the block */}
        {isFormatPanelOpen && (
          <FormatPanel
            layout={layout}
            onChange={onLayoutChange}
            onClose={onToggleFormatPanel}
          />
        )}

        {/* Metadata Panel – positioned relative to the block */}
        {isMetadataPanelOpen && (
          <BlockMetadataPopover
            metadata={block.metadata}
            onChange={onMetadataChange}
            onClose={onToggleMetadataPanel}
          />
        )}

        {/* Block Style Menu – positioned relative to the block */}
        <BlockStyleMenu
          open={styleMenuOpen}
          onClose={() => setStyleMenuOpen(false)}
          style={block.style}
          customBackgroundColor={block.customBackgroundColor}
          onChange={(newStyle, customColor) => {
            onStyleChange(newStyle, customColor);
            // Don't close menu when selecting custom - let the color picker handle it
            if (newStyle !== "custom") {
              setStyleMenuOpen(false);
            }
          }}
          className="top-14 left-4"
        />

        {/**
         * INNER CONTENT COLUMN
         * Uses BlockWrapper for layout-based width and padding
         */}
        <BlockWrapper layout={layout}>
          <TipTapEditor
            value={initialHtml}
            onChange={handleContentChange}
            placeholder="Start writing your paragraph..."
          />
        </BlockWrapper>
      </div>
    </div>
  );
};

// ParagraphWithHeadingBlock component
interface ParagraphWithHeadingBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
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
}

const ParagraphWithHeadingBlock: React.FC<ParagraphWithHeadingBlockProps> = ({
  block,
  onChange,
  onStyleChange,
  onLayoutChange,
  onMetadataChange,
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get heading content
  const headingContent = block.content.heading ?? "";

  // Get initial HTML content for paragraph
  const initialHtml =
    block.content.html && block.content.html.trim().length > 0
      ? block.content.html
      : "<p>Start writing your paragraph...</p>";

  const handleHeadingChange = (newHeading: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        heading: newHeading,
      },
    });
  };

  const handleContentChange = (newHtml: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        html: newHtml,
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
            <LayoutGrid className="h-4 w-4" />
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
            🎨
          </button>

          {/* Appearance */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            title="Block appearance"
          >
            ✏️
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
            <Sparkles className="h-4 w-4" />
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

        {/* INNER CONTENT COLUMN */}
        <BlockWrapper layout={layout}>
          {/* Heading Editor - TipTap with large font styling */}
          <div className="mb-4">
            <TipTapEditor
              value={headingContent || "<p>Heading</p>"}
              onChange={handleHeadingChange}
              placeholder="Heading..."
              editorClassName="focus:outline-none text-[40px] font-semibold leading-tight text-gray-800 [&_p]:my-0"
              singleLine={true}
              disableLists={true}
            />
          </div>

          {/* Paragraph Editor */}
          <TipTapEditor
            value={initialHtml}
            onChange={handleContentChange}
            placeholder="Start writing your paragraph..."
          />
        </BlockWrapper>
      </div>
    </div>
  );
};

// ParagraphWithSubheadingBlock component - similar to ParagraphWithHeadingBlock but with smaller subheading
interface ParagraphWithSubheadingBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
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
}

const ParagraphWithSubheadingBlock: React.FC<
  ParagraphWithSubheadingBlockProps
> = ({
  block,
  onChange,
  onStyleChange,
  onLayoutChange,
  onMetadataChange,
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get subheading content
  const subheadingContent = block.content.subheading ?? "";

  // Get initial HTML content for paragraph
  const initialHtml =
    block.content.html && block.content.html.trim().length > 0
      ? block.content.html
      : "<p>Start writing your paragraph...</p>";

  const handleSubheadingChange = (newSubheading: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        subheading: newSubheading,
      },
    });
  };

  const handleContentChange = (newHtml: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        html: newHtml,
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
            <LayoutGrid className="h-4 w-4" />
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
            🎨
          </button>

          {/* Appearance */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            title="Block appearance"
          >
            ✏️
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
            <Sparkles className="h-4 w-4" />
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

        {/* INNER CONTENT COLUMN */}
        <BlockWrapper layout={layout}>
          {/* Subheading Editor - TipTap with 30px font styling (smaller than heading) */}
          <div className="mb-4">
            <TipTapEditor
              value={subheadingContent || "<p>Subheading</p>"}
              onChange={handleSubheadingChange}
              placeholder="Subheading..."
              editorClassName="focus:outline-none text-[30px] font-semibold leading-tight text-gray-800 [&_p]:my-0"
              singleLine={true}
              disableLists={true}
            />
          </div>

          {/* Paragraph Editor */}
          <TipTapEditor
            value={initialHtml}
            onChange={handleContentChange}
            placeholder="Start writing your paragraph..."
          />
        </BlockWrapper>
      </div>
    </div>
  );
};

// BlockHoverWrapper - wraps blocks for hover tracking
interface BlockHoverWrapperProps {
  children: React.ReactNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const BlockHoverWrapper: React.FC<BlockHoverWrapperProps> = ({
  children,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </div>
  );
};

// InsertionHandle - the "+" button that appears between blocks
interface InsertionHandleProps {
  index: number;
  aboveBlockId: string;
  belowBlockId: string;
  hoveredBlockId: string | null;
  hoveredInsertIndex: number | null;
  setHoveredInsertIndex: (index: number | null) => void;
  onInsertClick: (index: number) => void;
}

const InsertionHandle: React.FC<InsertionHandleProps> = ({
  index,
  aboveBlockId,
  belowBlockId,
  hoveredBlockId,
  hoveredInsertIndex,
  setHoveredInsertIndex,
  onInsertClick,
}) => {
  // Show when hovering the block above, below, OR the handle itself
  const isVisible =
    hoveredBlockId === aboveBlockId ||
    hoveredBlockId === belowBlockId ||
    hoveredInsertIndex === index;

  return (
    <div className="relative h-0 w-full">
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <button
          type="button"
          onClick={() => onInsertClick(index)}
          onMouseEnter={() => setHoveredInsertIndex(index)}
          onMouseLeave={() => setHoveredInsertIndex(null)}
          className={`
            h-9 w-9 rounded-full bg-slate-900 text-white 
            flex items-center justify-center shadow-lg
            hover:bg-slate-800 hover:scale-110
            transition-all duration-150
            ${
              isVisible
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }
          `}
          aria-label="Insert block here"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

// Block Library types and data
type BlockCategoryId =
  | "text"
  | "statement"
  | "quote"
  | "list"
  | "image"
  | "gallery"
  | "multimedia"
  | "interactive"
  | "knowledge_check"
  | "chart"
  | "divider"
  | "block_templates"
  | "code";

type BlockTemplate = {
  id: string;
  title: string;
  description: string;
};

const BLOCK_LIBRARY_CATEGORIES: { id: BlockCategoryId; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "statement", label: "Statement" },
  { id: "quote", label: "Quote" },
  { id: "list", label: "List" },
  { id: "image", label: "Image" },
  { id: "gallery", label: "Gallery" },
  { id: "multimedia", label: "Multimedia" },
  { id: "interactive", label: "Interactive" },
  { id: "knowledge_check", label: "Knowledge Check" },
  { id: "chart", label: "Chart" },
  { id: "divider", label: "Divider" },
  { id: "block_templates", label: "Block Templates" },
  { id: "code", label: "Code" },
];

const TEXT_TEMPLATES: BlockTemplate[] = [
  {
    id: "heading",
    title: "Heading",
    description: "Add a standalone heading to introduce a section or topic.",
  },
  {
    id: "subheading",
    title: "Subheading",
    description: "Insert a standalone subheading to organise your content.",
  },
  {
    id: "paragraph",
    title: "Paragraph",
    description: "Write free-form text with a simple paragraph block.",
  },
  {
    id: "paragraph_heading",
    title: "Paragraph with heading",
    description: "Add a heading above your paragraph to introduce the topic.",
  },
  {
    id: "paragraph_subheading",
    title: "Paragraph with subheading",
    description: "Use a smaller subheading to add structure to your content.",
  },
  {
    id: "columns",
    title: "Columns",
    description:
      "Display text in multiple columns for comparison or summaries.",
  },
  {
    id: "table",
    title: "Table",
    description: "Organise text into a simple table layout.",
  },
];

const LessonBuilder: React.FC = () => {
  const { moduleId, pageId } = useParams<{
    moduleId: string;
    pageId: string;
  }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<LessonPage | null>(null);
  const [loading, setLoading] = useState(true);

  // Author state (from authenticated user)
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorInitials, setAuthorInitials] = useState<string>("?");

  // Block Library panel state
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<BlockCategoryId | null>(null);

  // Blocks state
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);

  // Format panel state - tracks which block's format panel is open
  const [openFormatBlockId, setOpenFormatBlockId] = useState<string | null>(
    null
  );

  // Metadata panel state - tracks which block's metadata panel is open
  const [openMetadataBlockId, setOpenMetadataBlockId] = useState<string | null>(
    null
  );

  // Hover state - tracks which block is currently hovered (for insertion handles)
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  // Hover state - tracks which insertion handle is being hovered
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(
    null
  );

  // Pending insertion index - where to insert the next block when selected from Block Library
  const [pendingInsertIndex, setPendingInsertIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    const loadPageAndUser = async () => {
      if (!pageId) {
        setLoading(false);
        return;
      }

      // Load lesson page
      const { data, error } = await supabase
        .from("content_module_pages")
        .select("id, title")
        .eq("id", pageId)
        .single();

      if (error) {
        console.error("Error loading lesson page", error);
      } else {
        setPage(data as LessonPage);
      }

      // Load user profile for author display
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", user.id)
          .single();

        let displayName = user.email ?? "";

        if (profile && !profileError) {
          const parts: string[] = [];
          if (profile.first_name) parts.push(profile.first_name);
          if (profile.last_name) parts.push(profile.last_name);
          if (parts.length > 0) {
            displayName = parts.join(" ");
          } else if (profile.email) {
            displayName = profile.email;
          }
        }

        setAuthorName(displayName);

        // Compute initials
        const trimmed = displayName.trim();
        if (trimmed) {
          const words = trimmed.split(/\s+/);
          if (words.length >= 2) {
            setAuthorInitials(
              words[0].charAt(0).toUpperCase() +
                words[words.length - 1].charAt(0).toUpperCase()
            );
          } else {
            setAuthorInitials(trimmed.charAt(0).toUpperCase());
          }
        }
      }

      setLoading(false);
    };

    loadPageAndUser();
  }, [pageId]);

  // Block handlers
  const handleAddParagraphBlock = () => {
    // Use pendingInsertIndex if set, otherwise append to end
    createParagraphBlockAtIndex(pendingInsertIndex);
  };

  const handleUpdateBlock = (updatedBlock: LessonBlock) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === updatedBlock.id ? updatedBlock : b))
    );
  };

  const handleBlockStyleChange = (
    blockId: string,
    newStyle: BlockStyle,
    customBackgroundColor?: string
  ) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, style: newStyle, customBackgroundColor } : b
      )
    );
  };

  const handleLayoutChange = (blockId: string, newLayout: BlockLayout) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, layout: newLayout } : b))
    );
  };

  const handleToggleFormatPanel = useCallback((blockId: string) => {
    setOpenFormatBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  const handleToggleMetadataPanel = useCallback((blockId: string) => {
    setOpenMetadataBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  const handleMetadataChange = (
    blockId: string,
    newMetadata: BlockMetadata
  ) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, metadata: newMetadata } : b))
    );
  };

  // Handle click on insertion handle between blocks
  const handleInsertClick = (index: number) => {
    setPendingInsertIndex(index);
    setIsBlockLibraryOpen(true);
  };

  // Create a new heading block at a specific index or at the end
  const createHeadingBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "heading",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          heading: "<p>Heading</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddHeadingBlock = () => {
    createHeadingBlockAtIndex(pendingInsertIndex);
  };

  // Create a new subheading block at a specific index or at the end
  const createSubheadingBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "subheading",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          subheading: "<p>Subheading</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddSubheadingBlock = () => {
    createSubheadingBlockAtIndex(pendingInsertIndex);
  };

  // Create a new columns block at a specific index or at the end
  const createColumnsBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "columns",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          columnOneContent: "<p>Start writing your first column...</p>",
          columnTwoContent: "<p>Start writing your second column...</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddColumnsBlock = () => {
    createColumnsBlockAtIndex(pendingInsertIndex);
  };

  // Create a new table block at a specific index or at the end
  const createTableBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "table",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          tableContent: DEFAULT_TABLE_CONTENT,
          borderMode: "normal",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddTableBlock = () => {
    createTableBlockAtIndex(pendingInsertIndex);
  };

  // Create a new paragraph block at a specific index or at the end
  const createParagraphBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "paragraph",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          html: "<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        // Insert at specific index
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        // Append to end
        newBlocks = [...prev, newBlock];
      }

      // Re-normalise orderIndex
      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    // Close block library and reset pending insert index
    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  // Create a new paragraph-with-heading block at a specific index or at the end
  const createParagraphWithHeadingBlockAtIndex = (
    insertIndex: number | null
  ) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "paragraph-with-heading",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          heading: "<p>Heading</p>",
          html: "<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddParagraphWithHeadingBlock = () => {
    createParagraphWithHeadingBlockAtIndex(pendingInsertIndex);
  };

  // Create a new paragraph-with-subheading block at a specific index or at the end
  const createParagraphWithSubheadingBlockAtIndex = (
    insertIndex: number | null
  ) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "paragraph-with-subheading",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          subheading: "<p>Subheading</p>",
          html: "<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddParagraphWithSubheadingBlock = () => {
    createParagraphWithSubheadingBlockAtIndex(pendingInsertIndex);
  };

  const handleDeleteBlock = (blockId: string) => {
    setBlocks((prev) =>
      prev
        .filter((block) => block.id !== blockId)
        .map((block, index) => ({
          ...block,
          orderIndex: index, // keep orderIndex sequential after deletion
        }))
    );
  };

  const handleDuplicateBlock = (blockId: string) => {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;

      const original = prev[index];

      const duplicated: LessonBlock = {
        ...original,
        id: crypto.randomUUID(), // new ID for the duplicate
        orderIndex: original.orderIndex + 0.5, // temp index to insert after
        layout: { ...original.layout }, // copy layout with fresh reference
        metadata: original.metadata ? { ...original.metadata } : undefined, // copy metadata
        content: { ...original.content }, // copy content with fresh reference
      };

      // insert duplicate *after* the original
      const withDuplicate = [
        ...prev.slice(0, index + 1),
        duplicated,
        ...prev.slice(index + 1),
      ];

      // re-normalise orderIndex so it's 0,1,2,... again
      return withDuplicate.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });
  };

  const moveBlock = (blockId: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      // If we can't move (already at top or bottom), return as-is
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;

      // Normalise orderIndex after reordering
      return next.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });
  };

  const handleMoveBlockUp = (blockId: string) => moveBlock(blockId, "up");
  const handleMoveBlockDown = (blockId: string) => moveBlock(blockId, "down");

  const title = page?.title || "Lesson";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading lesson...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header section - centered */}
      <div className="max-w-4xl mx-auto px-8 pt-12">
        {/* Back link */}
        <button
          type="button"
          onClick={() => {
            if (moduleId) {
              navigate(`/admin/content/module-builder/${moduleId}`);
            } else {
              navigate("/admin/content/module-builder");
            }
          }}
          className="text-blue-600 hover:underline mb-6 inline-block text-sm"
        >
          &larr; Back to Module Builder
        </button>

        {/* Lesson title */}
        <h1 className="text-4xl font-light text-gray-700 mb-6">{title}</h1>

        {/* Author row */}
        {authorName && (
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-full bg-[#4a90a4] text-white flex items-center justify-center text-sm font-semibold">
              {authorInitials}
            </div>
            <span className="font-medium text-gray-700">{authorName}</span>
          </div>
        )}

        {/* Orange underline */}
        <div className="h-1 w-36 bg-orange-500 mb-12" />
      </div>

      {/* Blocks workspace - FULL WIDTH (edge-to-edge) */}
      <div className="pb-24">
        {/* Blocks workspace */}
        {blocks.length === 0 ? (
          /* Add your first block area - shown when no blocks exist (centered) */
          <div className="max-w-4xl mx-auto px-8">
            <div className="border border-dashed border-gray-300 rounded-xl py-8 px-6">
              <div className="flex items-start gap-6">
                {/* Block Library button */}
                <button
                  type="button"
                  onClick={() => setIsBlockLibraryOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 w-16 h-20 bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="4" y="4" width="6" height="6" rx="1" />
                    <rect x="14" y="4" width="6" height="6" rx="1" />
                    <rect x="4" y="14" width="6" height="6" rx="1" />
                    <rect x="14" y="14" width="6" height="6" rx="1" />
                  </svg>
                  <span className="text-[10px] text-white font-medium leading-tight">
                    Block
                  </span>
                  <span className="text-[10px] text-white font-medium leading-tight -mt-0.5">
                    Library
                  </span>
                </button>

                {/* Block type icons */}
                <div className="flex items-center gap-4">
                  {/* Text */}
                  <button
                    type="button"
                    onClick={handleAddParagraphBlock}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 6h16M4 12h16M4 18h7"
                      />
                    </svg>
                    <span className="text-xs text-red-500 font-medium">
                      Text
                    </span>
                  </button>

                  {/* List */}
                  <button
                    type="button"
                    onClick={() => console.log("List block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 6h16M4 10h16M4 14h16M4 18h16"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      List
                    </span>
                  </button>

                  {/* Image */}
                  <button
                    type="button"
                    onClick={() => console.log("Image block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
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
                    <span className="text-xs text-gray-600 font-medium">
                      Image
                    </span>
                  </button>

                  {/* Video */}
                  <button
                    type="button"
                    onClick={() => console.log("Video block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Video
                    </span>
                  </button>

                  {/* Process */}
                  <button
                    type="button"
                    onClick={() => console.log("Process block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Process
                    </span>
                  </button>

                  {/* Flashcards */}
                  <button
                    type="button"
                    onClick={() => console.log("Flashcards block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-20 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Flashcards
                    </span>
                  </button>

                  {/* Sorting */}
                  <button
                    type="button"
                    onClick={() => console.log("Sorting block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Sorting
                    </span>
                  </button>

                  {/* Continue */}
                  <button
                    type="button"
                    onClick={() => console.log("Continue block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Continue
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Blocks list - FULL WIDTH (edge-to-edge) */
          <div>
            {(() => {
              const sortedBlocks = blocks
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex);
              return sortedBlocks.map((block, index) => {
                // Common block props
                const commonBlockProps = {
                  block,
                  onChange: handleUpdateBlock,
                  onStyleChange: (newStyle: BlockStyle, customColor?: string) =>
                    handleBlockStyleChange(block.id, newStyle, customColor),
                  onLayoutChange: (newLayout: BlockLayout) =>
                    handleLayoutChange(block.id, newLayout),
                  onMetadataChange: (newMetadata: BlockMetadata) =>
                    handleMetadataChange(block.id, newMetadata),
                  onDuplicate: () => handleDuplicateBlock(block.id),
                  onDelete: () => handleDeleteBlock(block.id),
                  onMoveUp: () => handleMoveBlockUp(block.id),
                  onMoveDown: () => handleMoveBlockDown(block.id),
                  canMoveUp: index > 0,
                  canMoveDown: index < sortedBlocks.length - 1,
                  isFormatPanelOpen: openFormatBlockId === block.id,
                  onToggleFormatPanel: () => handleToggleFormatPanel(block.id),
                  isMetadataPanelOpen: openMetadataBlockId === block.id,
                  onToggleMetadataPanel: () =>
                    handleToggleMetadataPanel(block.id),
                };

                // Render the appropriate block component
                let blockComponent: React.ReactNode = null;

                if (block.type === "heading") {
                  blockComponent = <HeadingBlock {...commonBlockProps} />;
                } else if (block.type === "subheading") {
                  blockComponent = <SubheadingBlock {...commonBlockProps} />;
                } else if (block.type === "paragraph") {
                  blockComponent = <ParagraphBlock {...commonBlockProps} />;
                } else if (block.type === "paragraph-with-heading") {
                  blockComponent = (
                    <ParagraphWithHeadingBlock {...commonBlockProps} />
                  );
                } else if (block.type === "paragraph-with-subheading") {
                  blockComponent = (
                    <ParagraphWithSubheadingBlock {...commonBlockProps} />
                  );
                } else if (block.type === "columns") {
                  blockComponent = <ColumnsBlock {...commonBlockProps} />;
                } else if (block.type === "table") {
                  blockComponent = <TableBlock {...commonBlockProps} />;
                }

                if (!blockComponent) return null;

                return (
                  <Fragment key={block.id}>
                    <BlockHoverWrapper
                      onMouseEnter={() => setHoveredBlockId(block.id)}
                      onMouseLeave={() => setHoveredBlockId(null)}
                    >
                      {blockComponent}
                    </BlockHoverWrapper>

                    {/* Insertion handle between this block and the next */}
                    {index < sortedBlocks.length - 1 && (
                      <InsertionHandle
                        index={index + 1}
                        aboveBlockId={block.id}
                        belowBlockId={sortedBlocks[index + 1].id}
                        hoveredBlockId={hoveredBlockId}
                        hoveredInsertIndex={hoveredInsertIndex}
                        setHoveredInsertIndex={setHoveredInsertIndex}
                        onInsertClick={handleInsertClick}
                      />
                    )}
                  </Fragment>
                );
              });
            })()}

            {/* Add block button below existing blocks (centered) */}
            <div className="max-w-4xl mx-auto px-8 mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setIsBlockLibraryOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add block
              </button>
            </div>
          </div>
        )}

        {/* Debug info (can be removed later) */}
        <div className="max-w-4xl mx-auto px-8 mt-8 text-xs text-gray-400">
          Module ID: {moduleId} | Page ID: {pageId} | Blocks: {blocks.length}
        </div>
      </div>

      {/* Block Library slide-out panel */}
      <div
        className={`fixed inset-0 z-50 ${
          isBlockLibraryOpen ? "visible" : "invisible"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
            isBlockLibraryOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => {
            setIsBlockLibraryOpen(false);
            setPendingInsertIndex(null);
          }}
        />

        {/* Slide-out panel with categories + templates */}
        <div
          className={`absolute inset-y-0 left-0 bg-white shadow-xl border-r border-gray-200 transform transition-all duration-200 flex flex-col ${
            isBlockLibraryOpen ? "translate-x-0" : "-translate-x-full"
          } ${selectedCategory ? "w-[500px]" : "w-48"}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">
              Block Library
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsBlockLibraryOpen(false);
                setPendingInsertIndex(null);
              }}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Body: categories (left) + templates (right) */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Categories list */}
            <nav className="w-44 border-r border-gray-200 overflow-y-auto px-2 py-3 space-y-1 text-sm bg-white">
              {BLOCK_LIBRARY_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              ))}
            </nav>

            {/* Templates panel - hidden until a category is selected */}
            <section
              className={`absolute top-0 bottom-0 left-44 right-0 bg-gray-50 border-l border-gray-200 px-4 py-4 overflow-y-auto transform transition-transform duration-200 ${
                selectedCategory ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {selectedCategory === "text" ? (
                <div className="space-y-3">
                  {TEXT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        if (tpl.id === "heading") {
                          handleAddHeadingBlock();
                        } else if (tpl.id === "subheading") {
                          handleAddSubheadingBlock();
                        } else if (tpl.id === "paragraph") {
                          handleAddParagraphBlock();
                        } else if (tpl.id === "paragraph_heading") {
                          handleAddParagraphWithHeadingBlock();
                        } else if (tpl.id === "paragraph_subheading") {
                          handleAddParagraphWithSubheadingBlock();
                        } else if (tpl.id === "columns") {
                          handleAddColumnsBlock();
                        } else if (tpl.id === "table") {
                          handleAddTableBlock();
                        } else {
                          console.log("Selected text template", tpl.id);
                          // TODO: implement other block types
                        }
                      }}
                      className="w-full bg-white rounded-lg border border-gray-200 hover:border-orange-500 hover:shadow-sm text-left overflow-hidden transition-all"
                    >
                      {/* Simple visual preview rectangle */}
                      <div className="h-16 bg-gray-100 border-b border-gray-200 flex items-center justify-center">
                        <div className="w-3/4 space-y-1.5">
                          <div className="h-2 bg-gray-300 rounded" />
                          <div className="h-2 bg-gray-300 rounded w-5/6" />
                          <div className="h-2 bg-gray-300 rounded w-4/6" />
                        </div>
                      </div>
                      <div className="px-3 py-2.5">
                        <div className="text-sm font-medium text-gray-900">
                          {tpl.title}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 leading-relaxed">
                          {tpl.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : selectedCategory ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">
                  <div className="text-center">
                    <div className="text-2xl mb-2">📦</div>
                    <div>
                      Templates for{" "}
                      <span className="font-medium text-gray-700">
                        {
                          BLOCK_LIBRARY_CATEGORIES.find(
                            (c) => c.id === selectedCategory
                          )?.label
                        }
                      </span>
                    </div>
                    <div className="text-xs mt-1">Coming soon</div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonBuilder;
