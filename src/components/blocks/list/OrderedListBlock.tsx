import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Hash,
  IndentIncrease,
  ListOrdered,
  Palette,
  PanelsLeftRight,
  Plus,
  Stars,
  Trash2,
} from "lucide-react";
import TipTapEditor from "../../editor/TipTapEditor";
import { BlockStyleMenu, type BlockStyle } from "../BlockStyleMenu";
import {
  AppearancePanel,
  BlockMetadataPopover,
  BlockWrapper,
  FormatPanel,
  getBlockStyleClasses,
} from "../shared/LessonBuilderInternals";
import { DEFAULT_BLOCK_LAYOUT, hasBlockMetadata } from "../../../types/blocks";
import type { BlockLayout, BlockMetadata } from "../../../types/blocks";
import type {
  AnimationDuration,
  BlockAnimation,
  LessonBlock,
} from "../../../../pages/admin/content/LessonBuilder";
import type {
  NumberedListItem,
  OrderedListStyle,
} from "./ordered-list/orderedListTypes";

// List style options for the editor dropdown
const LIST_STYLE_OPTIONS: {
  value: OrderedListStyle;
  label: string;
  name: string;
}[] = [
  { value: "decimal", label: "1, 2, 3", name: "Decimal" },
  { value: "lower-alpha", label: "a, b, c", name: "Lowercase" },
  { value: "upper-alpha", label: "A, B, C", name: "Uppercase" },
  { value: "lower-roman", label: "i, ii, iii", name: "Roman (lower)" },
  { value: "upper-roman", label: "I, II, III", name: "Roman (upper)" },
];

// Helper to get style label for display
function getStyleLabel(style: OrderedListStyle | undefined): string {
  const option = LIST_STYLE_OPTIONS.find((o) => o.value === style);
  return option?.label ?? "1, 2, 3";
}

// Helper to get CSS list-style-type value
function getListStyleType(style: OrderedListStyle | undefined): string {
  switch (style) {
    case "lower-alpha":
      return "lower-alpha";
    case "upper-alpha":
      return "upper-alpha";
    case "lower-roman":
      return "lower-roman";
    case "upper-roman":
      return "upper-roman";
    case "decimal":
    default:
      return "decimal";
  }
}

// Helper to convert a number to the appropriate list marker format
function getListMarker(
  num: number,
  style: OrderedListStyle | undefined
): string {
  switch (style) {
    case "lower-alpha":
      // Convert 1 -> a, 2 -> b, etc. (wraps after z)
      return String.fromCharCode(97 + ((num - 1) % 26));
    case "upper-alpha":
      // Convert 1 -> A, 2 -> B, etc. (wraps after Z)
      return String.fromCharCode(65 + ((num - 1) % 26));
    case "lower-roman":
      return toRoman(num).toLowerCase();
    case "upper-roman":
      return toRoman(num);
    case "decimal":
    default:
      return String(num);
  }
}

// Helper to convert number to Roman numerals
function toRoman(num: number): string {
  if (num < 1 || num > 3999) return String(num);
  const romanNumerals: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  for (const [value, symbol] of romanNumerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// OrderedListControlsBar - Modern icon controls for ordered list settings
// ---------------------------------------------------------------------------

interface OrderedListControlsBarProps {
  startNumber: number;
  listStyle: OrderedListStyle;
  subStyle: OrderedListStyle;
  onStartNumberChange: (value: number) => void;
  onListStyleChange: (style: OrderedListStyle) => void;
  onSubStyleChange: (style: OrderedListStyle) => void;
}

const OrderedListControlsBar: React.FC<OrderedListControlsBarProps> = ({
  startNumber,
  listStyle,
  subStyle,
  onStartNumberChange,
  onListStyleChange,
  onSubStyleChange,
}) => {
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [stylePopoverOpen, setStylePopoverOpen] = useState(false);
  const [subStylePopoverOpen, setSubStylePopoverOpen] = useState(false);

  const startRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const subStyleRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (startRef.current && !startRef.current.contains(e.target as Node)) {
        setStartPopoverOpen(false);
      }
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) {
        setStylePopoverOpen(false);
      }
      if (
        subStyleRef.current &&
        !subStyleRef.current.contains(e.target as Node)
      ) {
        setSubStylePopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStartPopoverOpen(false);
        setStylePopoverOpen(false);
        setSubStylePopoverOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const chipClass =
    "relative flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 cursor-pointer hover:bg-gray-200 transition text-gray-700 select-none";
  const iconClass = "h-4 w-4 text-gray-500";
  const labelClass = "text-sm font-medium text-gray-700";

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Start At Control */}
      <div ref={startRef} className="relative">
        <button
          type="button"
          onClick={() => setStartPopoverOpen(!startPopoverOpen)}
          className={chipClass}
          aria-label="Change start number"
          aria-expanded={startPopoverOpen}
        >
          <Hash className={iconClass} />
          <span className={labelClass}>{startNumber}</span>
        </button>

        {startPopoverOpen && (
          <div className="absolute z-50 mt-1 left-0 rounded-lg bg-white shadow-lg border border-gray-200 p-3 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Start numbering at
            </label>
            <input
              type="number"
              min={1}
              value={startNumber}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onStartNumberChange(val >= 1 ? val : 1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") setStartPopoverOpen(false);
              }}
              autoFocus
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        )}
      </div>

      {/* Style Control (Level 1) */}
      <div ref={styleRef} className="relative">
        <button
          type="button"
          onClick={() => setStylePopoverOpen(!stylePopoverOpen)}
          className={chipClass}
          aria-label="Change list style"
          aria-expanded={stylePopoverOpen}
        >
          <ListOrdered className={iconClass} />
          <span className={labelClass}>{getStyleLabel(listStyle)}</span>
        </button>

        {stylePopoverOpen && (
          <div className="absolute z-50 mt-1 left-0 rounded-lg bg-white shadow-lg border border-gray-200 p-2 min-w-[160px]">
            <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">
              List style
            </div>
            {LIST_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onListStyleChange(option.value);
                  setStylePopoverOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 transition ${
                  option.value === listStyle
                    ? "bg-orange-50 text-orange-700 font-semibold"
                    : "text-gray-700"
                }`}
              >
                <span>{option.label}</span>
                <span className="text-xs text-gray-400">{option.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sub-Style Control (Level 2) */}
      <div ref={subStyleRef} className="relative">
        <button
          type="button"
          onClick={() => setSubStylePopoverOpen(!subStylePopoverOpen)}
          className={chipClass}
          aria-label="Change sub-list style"
          aria-expanded={subStylePopoverOpen}
        >
          <IndentIncrease className={iconClass} />
          <span className={labelClass}>{getStyleLabel(subStyle)}</span>
        </button>

        {subStylePopoverOpen && (
          <div className="absolute z-50 mt-1 left-0 rounded-lg bg-white shadow-lg border border-gray-200 p-2 min-w-[160px]">
            <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">
              Sub-list style
            </div>
            {LIST_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onSubStyleChange(option.value);
                  setSubStylePopoverOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 transition ${
                  option.value === subStyle
                    ? "bg-orange-50 text-orange-700 font-semibold"
                    : "text-gray-700"
                }`}
              >
                <span>{option.label}</span>
                <span className="text-xs text-gray-400">{option.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// OrderedListBlock component - Editor for ordered list blocks
// ---------------------------------------------------------------------------

interface NumberedListBlockProps {
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
}

export const NumberedListBlock: React.FC<NumberedListBlockProps> = ({
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
  // Toggle for style target: 'background' or 'numbers'
  const [styleTarget, setStyleTarget] = useState<"background" | "numbers">(
    "background"
  );

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get list items from content, or default to one empty item
  const listItems: NumberedListItem[] = block.content.listItems ?? [
    { body: "<p>List item content...</p>" },
  ];
  const startNumber = block.content.startNumber ?? 1;
  const listStyle = block.content.listStyle ?? "decimal";
  const subStyle = block.content.subStyle ?? "lower-alpha";
  const numberColor = block.content.numberColor ?? "#f97316"; // Default orange-500

  // Helper to update the entire listItems array
  const updateListItems = (newItems: NumberedListItem[]) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        listItems: newItems,
      },
    });
  };

  // Update a top-level item's body
  const handleItemChange = (index: number, value: string) => {
    const updatedItems = [...listItems];
    updatedItems[index] = { ...updatedItems[index], body: value };
    updateListItems(updatedItems);
  };

  // Update a child item's body
  const handleChildChange = (
    parentIndex: number,
    childIndex: number,
    value: string
  ) => {
    const updatedItems = [...listItems];
    const parent = updatedItems[parentIndex];
    const children = [...(parent.children ?? [])];
    children[childIndex] = { ...children[childIndex], body: value };
    updatedItems[parentIndex] = { ...parent, children };
    updateListItems(updatedItems);
  };

  // Add a new top-level list item
  const handleAddItem = () => {
    updateListItems([...listItems, { body: "<p>New item...</p>" }]);
  };

  // Remove a top-level list item (and its children)
  const handleRemoveItem = (index: number) => {
    if (listItems.length <= 1) return; // Keep at least one item
    updateListItems(listItems.filter((_, i) => i !== index));
  };

  // Remove a child item
  const handleRemoveChild = (parentIndex: number, childIndex: number) => {
    const updatedItems = [...listItems];
    const parent = updatedItems[parentIndex];
    const children = (parent.children ?? []).filter((_, i) => i !== childIndex);
    updatedItems[parentIndex] = {
      ...parent,
      children: children.length > 0 ? children : undefined,
    };
    updateListItems(updatedItems);
  };

  // Indent a top-level item (move it into previous item's children)
  const handleIndent = (index: number) => {
    // Can't indent the first item (no previous sibling)
    if (index === 0) return;

    const updatedItems = [...listItems];
    const itemToIndent = updatedItems[index];
    const previousItem = updatedItems[index - 1];

    // Remove from top level
    updatedItems.splice(index, 1);

    // Add to previous item's children
    const previousChildren = previousItem.children ?? [];
    updatedItems[index - 1] = {
      ...previousItem,
      children: [...previousChildren, { body: itemToIndent.body }],
    };

    updateListItems(updatedItems);
  };

  // Outdent a child item (move it to top level after its parent)
  const handleOutdent = (parentIndex: number, childIndex: number) => {
    const updatedItems = [...listItems];
    const parent = updatedItems[parentIndex];
    const children = parent.children ?? [];
    const childToOutdent = children[childIndex];

    // Remove from parent's children
    const newChildren = children.filter((_, i) => i !== childIndex);
    updatedItems[parentIndex] = {
      ...parent,
      children: newChildren.length > 0 ? newChildren : undefined,
    };

    // Insert after parent in top-level items
    updatedItems.splice(parentIndex + 1, 0, { body: childToOutdent.body });

    updateListItems(updatedItems);
  };

  // Update start number
  const handleStartNumberChange = (value: number) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        startNumber: Math.max(1, value),
      },
    });
  };

  // Update level-1 list style
  const handleListStyleChange = (style: OrderedListStyle) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        listStyle: style,
      },
    });
  };

  // Update level-2 (sub) list style
  const handleSubStyleChange = (style: OrderedListStyle) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        subStyle: style,
      },
    });
  };

  // Update number badge color (for editor visual only)
  const handleNumberColorChange = (color: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        numberColor: color,
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

          {/* Metadata */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMetadataPanel();
            }}
            aria-label="Block metadata"
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isMetadataPanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : blockHasMetadata
                ? "text-green-600 bg-green-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
          >
            <Database className="h-4 w-4" />
          </button>

          {/* Animation */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAppearancePanel();
            }}
            title="Block animation"
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
                ? "text-purple-600 bg-purple-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
          >
            <Stars className="h-4 w-4" />
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

          {(canMoveUp || canMoveDown) && (
            <span className="w-px h-4 bg-gray-200 mx-1" />
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
            blockContent={listItems.map((item) => item.body).join(" ")}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Custom Style Menu for Ordered List - includes toggle for background vs numbers */}
        {styleMenuOpen && (
          <div className="absolute top-14 left-4 z-40 rounded-xl border border-gray-200 bg-white shadow-xl w-[300px] text-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="font-medium text-gray-900">Style</div>
              <button
                type="button"
                onClick={() => setStyleMenuOpen(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Toggle: Background vs Numbers */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Apply color to
              </div>
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setStyleTarget("background")}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    styleTarget === "background"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Background
                </button>
                <button
                  type="button"
                  onClick={() => setStyleTarget("numbers")}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    styleTarget === "numbers"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Numbers
                </button>
              </div>
            </div>

            {/* Color options */}
            <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Color
            </div>
            <div className="px-3 pb-3 space-y-2">
              {/* Preset colors */}
              {[
                {
                  value: "light",
                  label: "Light",
                  bg: "bg-gray-50",
                  color: "#f9fafb",
                },
                {
                  value: "gray",
                  label: "Gray",
                  bg: "bg-gray-200",
                  color: "#e5e7eb",
                },
                {
                  value: "theme",
                  label: "Theme",
                  bg: "bg-[#ff7a1a]",
                  color: "#ff7a1a",
                },
                {
                  value: "themeTint",
                  label: "Theme tint",
                  bg: "bg-[#FFE2CC]",
                  color: "#FFE2CC",
                },
                {
                  value: "dark",
                  label: "Dark",
                  bg: "bg-neutral-800",
                  color: "#262626",
                },
                {
                  value: "black",
                  label: "Black",
                  bg: "bg-black",
                  color: "#000000",
                },
              ].map((option) => {
                const isActive =
                  styleTarget === "background"
                    ? option.value === block.style
                    : option.color === numberColor;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (styleTarget === "background") {
                        onStyleChange(
                          option.value as BlockStyle,
                          block.customBackgroundColor
                        );
                      } else {
                        handleNumberColorChange(option.color);
                      }
                      setStyleMenuOpen(false);
                    }}
                    className={`
                      flex w-full items-center justify-between rounded-lg px-3 py-2
                      text-left transition
                      ${
                        isActive
                          ? "ring-1 ring-[#ff7a1a] bg-orange-50"
                          : "hover:bg-gray-50"
                      }
                    `}
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {option.label}
                    </span>
                    <div
                      className={`ml-3 h-6 w-16 rounded-md border border-gray-200/70 ${option.bg}`}
                    />
                  </button>
                );
              })}

              {/* Custom color option */}
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      Custom
                    </span>
                    <span className="block text-xs text-gray-500">
                      Choose any colour
                    </span>
                  </div>
                  <input
                    type="color"
                    value={
                      styleTarget === "background"
                        ? block.customBackgroundColor || "#ffffff"
                        : numberColor
                    }
                    onChange={(e) => {
                      if (styleTarget === "background") {
                        onStyleChange("custom", e.target.value);
                      } else {
                        handleNumberColorChange(e.target.value);
                      }
                    }}
                    className="h-8 w-12 rounded border border-gray-300 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
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

        {/* INNER CONTENT */}
        <BlockWrapper layout={layout}>
          {/* Modern Inline Icon Controls Bar */}
          <OrderedListControlsBar
            startNumber={startNumber}
            listStyle={listStyle}
            subStyle={subStyle}
            onStartNumberChange={handleStartNumberChange}
            onListStyleChange={handleListStyleChange}
            onSubStyleChange={handleSubStyleChange}
          />

          {/* List items - with nested support */}
          <div className="space-y-3">
            {listItems.map((item, index) => {
              const number = startNumber + index;
              const marker = getListMarker(number, listStyle);
              const canIndent = index > 0; // Can indent if not first item

              return (
                <div key={index}>
                  {/* Top-level item */}
                  <div className="group flex items-start gap-3">
                    {/* Orange marker badge */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white font-semibold text-sm"
                      style={{ backgroundColor: numberColor }}
                      aria-hidden="true"
                    >
                      {marker}
                    </div>

                    {/* Content editor */}
                    <div className="flex-1 min-w-0">
                      <TipTapEditor
                        value={item.body || "<p>Item content...</p>"}
                        onChange={(newHtml) => handleItemChange(index, newHtml)}
                        placeholder="Item content..."
                      />
                    </div>

                    {/* Action buttons (appear on hover) */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      {/* Indent button */}
                      <button
                        type="button"
                        onClick={() => handleIndent(index)}
                        disabled={!canIndent}
                        aria-label="Indent item"
                        title="Indent (make sub-item)"
                        className={`inline-flex items-center justify-center h-6 w-6 rounded transition ${
                          canIndent
                            ? "text-gray-400 hover:text-[#ff7a00] hover:bg-gray-100"
                            : "text-gray-200 cursor-not-allowed"
                        }`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      {/* Delete button */}
                      {listItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          aria-label="Delete item"
                          title="Delete item"
                          className="inline-flex items-center justify-center h-6 w-6 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nested children (level 2) */}
                  {item.children && item.children.length > 0 && (
                    <div className="ml-12 mt-2 space-y-2">
                      {item.children.map((child, childIndex) => {
                        const childMarker = getListMarker(
                          childIndex + 1,
                          subStyle
                        );
                        return (
                          <div
                            key={childIndex}
                            className="group/child flex items-start gap-3"
                          >
                            {/* Child marker badge (smaller, lighter) */}
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white font-medium text-xs"
                              style={{
                                backgroundColor: numberColor,
                                opacity: 0.7,
                              }}
                              aria-hidden="true"
                            >
                              {childMarker}
                            </div>

                            {/* Child content editor */}
                            <div className="flex-1 min-w-0">
                              <TipTapEditor
                                value={child.body || "<p>Sub-item...</p>"}
                                onChange={(newHtml) =>
                                  handleChildChange(index, childIndex, newHtml)
                                }
                                placeholder="Sub-item content..."
                              />
                            </div>

                            {/* Child action buttons */}
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/child:opacity-100 transition">
                              {/* Outdent button */}
                              <button
                                type="button"
                                onClick={() => handleOutdent(index, childIndex)}
                                aria-label="Outdent item"
                                title="Outdent (move to top level)"
                                className="inline-flex items-center justify-center h-6 w-6 rounded text-gray-400 hover:text-[#ff7a00] hover:bg-gray-100 transition"
                              >
                                <ArrowLeft className="h-4 w-4" />
                              </button>

                              {/* Delete child button */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveChild(index, childIndex)
                                }
                                aria-label="Delete sub-item"
                                title="Delete sub-item"
                                className="inline-flex items-center justify-center h-6 w-6 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add item button */}
          <button
            type="button"
            onClick={handleAddItem}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-dashed border-gray-300"
          >
            <Plus className="h-4 w-4" />
            Add item
          </button>
        </BlockWrapper>
      </div>
    </div>
  );
};
