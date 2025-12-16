import React, { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  IndentIncrease,
  Palette,
  PanelsLeftRight,
  Plus,
  Stars,
  Trash2,
  X,
} from "lucide-react";
import TipTapEditor from "../../../editor/TipTapEditor";
import { BlockStyleMenu, type BlockStyle } from "../../BlockStyleMenu";
import {
  AppearancePanel,
  BlockMetadataPopover,
  BlockWrapper,
  FormatPanel,
  getBlockStyleClasses,
} from "../../shared/LessonBuilderInternals";
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
} from "../../../../pages/admin/content/LessonBuilder";
import type { BulletListItem } from "./bulletListTypes";

// ---------------------------------------------------------------------------
// BulletListBlock component - Editor for bullet list blocks
// ---------------------------------------------------------------------------

interface BulletListBlockProps {
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

export const BulletListBlock: React.FC<BulletListBlockProps> = ({
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

  // Get list items from content, or default to one empty item
  const bulletItems: BulletListItem[] = block.content.bulletItems ?? [
    { body: "<p>Bullet point content...</p>" },
  ];
  const bulletColor = block.content.bulletColor ?? "#f97316"; // Default orange-500

  // Helper to update the entire bulletItems array
  const updateBulletItems = (newItems: BulletListItem[]) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        bulletItems: newItems,
      },
    });
  };

  // Update a top-level item's body
  const handleItemChange = (index: number, value: string) => {
    const updatedItems = [...bulletItems];
    updatedItems[index] = { ...updatedItems[index], body: value };
    updateBulletItems(updatedItems);
  };

  // Update a child item's body
  const handleChildChange = (
    parentIndex: number,
    childIndex: number,
    value: string
  ) => {
    const updatedItems = [...bulletItems];
    const parent = updatedItems[parentIndex];
    const children = [...(parent.children ?? [])];
    children[childIndex] = { ...children[childIndex], body: value };
    updatedItems[parentIndex] = { ...parent, children };
    updateBulletItems(updatedItems);
  };

  // Add a new top-level item
  const handleAddItem = () => {
    updateBulletItems([...bulletItems, { body: "<p>New bullet point...</p>" }]);
  };

  // Remove a top-level item
  const handleRemoveItem = (index: number) => {
    if (bulletItems.length <= 1) return; // Keep at least one item
    const updatedItems = bulletItems.filter((_, i) => i !== index);
    updateBulletItems(updatedItems);
  };

  // Add a child item to a parent
  const handleAddChild = (parentIndex: number) => {
    const updatedItems = [...bulletItems];
    const parent = updatedItems[parentIndex];
    const children = parent.children ?? [];
    updatedItems[parentIndex] = {
      ...parent,
      children: [...children, { body: "<p>Sub-item...</p>" }],
    };
    updateBulletItems(updatedItems);
  };

  // Remove a child item
  const handleRemoveChild = (parentIndex: number, childIndex: number) => {
    const updatedItems = [...bulletItems];
    const parent = updatedItems[parentIndex];
    const children = (parent.children ?? []).filter((_, i) => i !== childIndex);
    updatedItems[parentIndex] = {
      ...parent,
      children: children.length > 0 ? children : undefined,
    };
    updateBulletItems(updatedItems);
  };

  // Indent a top-level item (make it a child of the previous item)
  const handleIndent = (index: number) => {
    if (index === 0) return; // Can't indent first item
    const updatedItems = [...bulletItems];
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

    updateBulletItems(updatedItems);
  };

  // Outdent a child item (move it to top level after its parent)
  const handleOutdent = (parentIndex: number, childIndex: number) => {
    const updatedItems = [...bulletItems];
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

    updateBulletItems(updatedItems);
  };

  // Update bullet color
  const handleBulletColorChange = (color: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        bulletColor: color,
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

        {/* Format Panel */}
        {isFormatPanelOpen && (
          <FormatPanel
            layout={layout}
            onLayoutChange={onLayoutChange}
            onClose={onToggleFormatPanel}
          />
        )}

        {/* Appearance Panel */}
        {isAppearancePanelOpen && (
          <AppearancePanel
            animation={(block.content.animation as BlockAnimation) || "none"}
            duration={
              (block.content.animationDuration as AnimationDuration) || "normal"
            }
            onChange={onAnimationChange}
            onDurationChange={onDurationChange}
            onClose={onToggleAppearancePanel}
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
            blockContent={block.content}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* INNER CONTENT */}
        <BlockWrapper layout={layout}>
          {/* Bullet color picker */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
            <span className="text-xs font-medium text-gray-500">
              Bullet color:
            </span>
            <input
              type="color"
              value={bulletColor}
              onChange={(e) => handleBulletColorChange(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-gray-300"
            />
          </div>

          {/* List items */}
          <div className="space-y-3">
            {bulletItems.map((item, index) => {
              const canIndent = index > 0; // Can indent if not first item

              return (
                <div key={index}>
                  {/* Top-level item */}
                  <div className="group/item flex items-start gap-3">
                    {/* Bullet marker */}
                    <div
                      className="flex h-4 w-4 mt-3 shrink-0 rounded-full"
                      style={{ backgroundColor: bulletColor }}
                    />

                    {/* Editable content */}
                    <div className="flex-1 min-w-0">
                      <TipTapEditor
                        content={item.body}
                        onChange={(val) => handleItemChange(index, val)}
                        className="prose prose-sm max-w-none [&>p]:m-0"
                        placeholder="Bullet point content..."
                      />
                    </div>

                    {/* Item actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      {canIndent && (
                        <button
                          type="button"
                          onClick={() => handleIndent(index)}
                          title="Indent (make sub-item)"
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        >
                          <IndentIncrease className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAddChild(index)}
                        title="Add sub-item"
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      {bulletItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          title="Remove item"
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nested children (level 2) */}
                  {item.children && item.children.length > 0 && (
                    <div className="ml-7 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
                      {item.children.map((child, childIndex) => (
                        <div
                          key={childIndex}
                          className="group/child flex items-start gap-3"
                        >
                          {/* Child bullet marker (smaller) */}
                          <div
                            className="flex h-3 w-3 mt-3 shrink-0 rounded-full opacity-70"
                            style={{ backgroundColor: bulletColor }}
                          />

                          {/* Child content */}
                          <div className="flex-1 min-w-0">
                            <TipTapEditor
                              content={child.body}
                              onChange={(val) =>
                                handleChildChange(index, childIndex, val)
                              }
                              className="prose prose-sm max-w-none [&>p]:m-0 text-gray-700"
                              placeholder="Sub-item content..."
                            />
                          </div>

                          {/* Child actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover/child:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleOutdent(index, childIndex)}
                              title="Outdent (move to top level)"
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveChild(index, childIndex)
                              }
                              title="Remove sub-item"
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
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
