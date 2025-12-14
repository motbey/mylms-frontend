import React, { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Palette,
  PanelsLeftRight,
  Stars,
  Trash2,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
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

// Default table content for new table blocks
export const DEFAULT_TABLE_CONTENT = {
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

export const TableBlock: React.FC<TableBlockProps> = ({
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
            blockContent=""
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


