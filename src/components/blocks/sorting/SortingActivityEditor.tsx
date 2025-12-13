// src/components/blocks/sorting/SortingActivityEditor.tsx
// Editor component for Sorting Activity blocks in the LessonBuilder

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X as CloseIcon } from "lucide-react";
import { ImageUploadAndLibrary } from "../../media";
import type { MediaAsset } from "../../media";
import type {
  SortingActivityContent,
  SortingCategory,
  SortingItem,
} from "./sorting-types";

interface SortingActivityEditorProps {
  blockId: string;
  content: SortingActivityContent;
  onChange: (updatedContent: SortingActivityContent) => void;
}

/**
 * SortingActivityEditor
 *
 * Inline editor for sorting activity blocks. Allows admins to:
 * - Edit title and instructions
 * - Manage categories (add, edit, delete)
 * - Manage items (add, edit, delete, assign to category)
 */
const SortingActivityEditor: React.FC<SortingActivityEditorProps> = ({
  blockId,
  content,
  onChange,
}) => {
  const [lastAddedCategoryId, setLastAddedCategoryId] = useState<string | null>(
    null
  );
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [mediaPickerTargetItemId, setMediaPickerTargetItemId] = useState<
    string | null
  >(null);

  // Destructure content with defaults
  const categories = content.categories ?? [];
  const items = content.items ?? [];

  // Generate stable ids for legacy content (only when missing)
  useEffect(() => {
    let changed = false;
    const nextCategories: SortingCategory[] = categories.map((cat) => {
      if (!cat.id) {
        changed = true;
        return { ...cat, id: crypto.randomUUID() };
      }
      return cat;
    });

    const firstCategoryId = nextCategories[0]?.id ?? "";

    const nextItems: SortingItem[] = items.map((item) => {
      let updated = item;
      if (!item.id) {
        changed = true;
        updated = { ...updated, id: crypto.randomUUID() };
      }
      if (!updated.correctCategoryId) {
        changed = true;
        updated = { ...updated, correctCategoryId: firstCategoryId };
      }
      return updated;
    });

    if (changed) {
      onChange({
        ...content,
        categories: nextCategories,
        items: nextItems,
      });
    }
  }, [categories, content, items, onChange]);

  // ---------- Category Handlers ----------

  const handleCategoryLabelChange = (categoryId: string, newLabel: string) => {
    const updatedCategories = categories.map((cat) =>
      cat.id === categoryId ? { ...cat, label: newLabel } : cat
    );
    onChange({
      ...content,
      categories: updatedCategories,
    });
  };

  const handleAddCategory = () => {
    const newCategory: SortingCategory = {
      id: crypto.randomUUID(),
      label: `Category ${categories.length + 1}`,
    };
    setLastAddedCategoryId(newCategory.id);
    onChange({
      ...content,
      categories: [...categories, newCategory],
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
    const itemsUsingCategory = items.filter(
      (item) => item.correctCategoryId === categoryId
    );

    if (itemsUsingCategory.length > 0) {
      const confirmed = window.confirm(
        `This category has ${itemsUsingCategory.length} item(s). Delete anyway? Items in this category will also be removed.`
      );
      if (!confirmed) return;
    }

    const updatedCategories = categories.filter((cat) => cat.id !== categoryId);
    const updatedItems = items.filter(
      (item) => item.correctCategoryId !== categoryId
    );

    onChange({
      ...content,
      categories: updatedCategories,
      items: updatedItems,
    });
  };

  // Count items per category for display
  const getItemCountForCategory = (categoryId: string): number => {
    return items.filter((item) => item.correctCategoryId === categoryId).length;
  };

  // ---------- Item Handlers ----------

  const handleItemTextChange = (itemId: string, newText: string) => {
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, text: newText } : item
    );
    onChange({
      ...content,
      items: updatedItems,
    });
  };

  const handleItemImageSelect = (itemId: string, asset: MediaAsset) => {
    const updatedItems = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            imageUrl: asset.public_url ?? null,
            altText: asset.alt_text ?? null,
          }
        : item
    );
    onChange({
      ...content,
      items: updatedItems,
    });
  };

  const handleRemoveItemImage = (itemId: string) => {
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, imageUrl: null, altText: null } : item
    );
    onChange({
      ...content,
      items: updatedItems,
    });
  };

  const handleItemCategoryChange = (itemId: string, newCategoryId: string) => {
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, correctCategoryId: newCategoryId } : item
    );
    onChange({
      ...content,
      items: updatedItems,
    });
  };

  const handleAddItemToCategory = (categoryId: string) => {
    const newItem: SortingItem = {
      id: crypto.randomUUID(),
      text: "",
      correctCategoryId: categoryId,
    };
    onChange({
      ...content,
      items: [...items, newItem],
    });
  };

  const handleDeleteItem = (itemId: string) => {
    const updatedItems = items.filter((item) => item.id !== itemId);
    onChange({
      ...content,
      items: updatedItems,
    });
  };

  // Items grouped by category for easier rendering
  const itemsByCategory = useMemo(() => {
    const map: Record<string, SortingItem[]> = {};
    categories.forEach((cat) => {
      map[cat.id] = [];
    });
    items.forEach((item) => {
      if (!map[item.correctCategoryId]) {
        map[item.correctCategoryId] = [];
      }
      map[item.correctCategoryId].push(item);
    });
    return map;
  }, [categories, items]);

  return (
    <div className="space-y-6">
      {/* Categories + Items Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Categories</h3>
          <span className="text-xs text-slate-500">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </span>
        </div>

        {categories.length === 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              Add a category to start adding items.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((category) => {
            const itemsInCategory = itemsByCategory[category.id] ?? [];
            return (
              <div
                key={category.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={category.label}
                    onChange={(e) =>
                      handleCategoryLabelChange(category.id, e.target.value)
                    }
                    placeholder="Category title"
                    autoFocus={category.id === lastAddedCategoryId}
                    className="w-full bg-transparent border-none text-sm font-semibold text-slate-900 focus:outline-none focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(category.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="h-px bg-slate-200" />

                <div className="flex flex-col gap-2">
                  {itemsInCategory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white min-h-10 px-3 py-2 shadow-xs transition hover:border-slate-300"
                    >
                      {/* Image control */}
                      {!item.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMediaPickerTargetItemId(item.id);
                            setIsMediaLibraryOpen(true);
                          }}
                          className="shrink-0 text-xs font-medium text-slate-600 hover:text-[#ff7a00] hover:bg-orange-50 border border-slate-200 rounded-md px-2 py-1 transition-colors"
                          title="Add image"
                        >
                          Add image
                        </button>
                      ) : (
                        <div className="shrink-0 flex items-center gap-2">
                          <img
                            src={item.imageUrl}
                            alt={item.altText ?? "Item image"}
                            className="h-10 w-10 rounded-md object-cover border border-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setMediaPickerTargetItemId(item.id);
                              setIsMediaLibraryOpen(true);
                            }}
                            className="text-xs font-medium text-slate-600 hover:text-[#ff7a00] hover:bg-orange-50 border border-slate-200 rounded-md px-2 py-1 transition-colors"
                            title="Change image"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemImage(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Remove image"
                            aria-label="Remove image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) =>
                          handleItemTextChange(item.id, e.target.value)
                        }
                        placeholder="Item text"
                        className="flex-1 bg-transparent border-none text-sm text-slate-800 focus:outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleAddItemToCategory(category.id)}
                  className="mt-auto w-full h-11 uppercase text-xs font-semibold tracking-wide rounded-md border border-slate-300 bg-white text-slate-700 hover:border-[#ff7a00] hover:text-[#ff7a00] transition-colors"
                >
                  Add an item
                </button>
              </div>
            );
          })}

          {/* New Category Tile */}
          <button
            type="button"
            onClick={handleAddCategory}
            className="h-full min-h-[220px] border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500 hover:border-[#ff7a00] hover:text-[#ff7a00] transition-colors flex flex-col items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">New Category</span>
          </button>
        </div>
      </div>

      {/* Media Library Modal for picking an item image */}
      {isMediaLibraryOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsMediaLibraryOpen(false);
              setMediaPickerTargetItemId(null);
            }}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Select Image
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsMediaLibraryOpen(false);
                  setMediaPickerTargetItemId(null);
                }}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                aria-label="Close media library"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ImageUploadAndLibrary
                onSelectAsset={(asset) => {
                  if (!mediaPickerTargetItemId) return;
                  handleItemImageSelect(mediaPickerTargetItemId, asset);
                  setIsMediaLibraryOpen(false);
                  setMediaPickerTargetItemId(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SortingActivityEditor;
