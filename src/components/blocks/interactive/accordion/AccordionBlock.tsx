import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Minus,
  Palette,
  PanelsLeftRight,
  Plus,
  Stars,
  Trash2,
  X,
} from "lucide-react";
import TipTapEditor from "../../../editor/TipTapEditor";
import type { AccordionContent, AccordionItem } from "./accordion-types";
import type { LessonBlock } from "../../../../../pages/admin/content/LessonBuilder";
import { supabase } from "../../../../../lib/supabaseClient";
import { ImageUploadAndLibrary } from "../../../media";
import type { MediaAsset } from "../../../../lib/mediaAssets";
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
import { BlockStyleMenu, type BlockStyle } from "../../BlockStyleMenu";
import type {
  AnimationDuration,
  BlockAnimation,
} from "../../../../../pages/admin/content/LessonBuilder";

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const summariseAccordionForAi = (content: AccordionContent) => {
  const parts: string[] = [];
  if (content.title?.trim()) parts.push(`Title: ${content.title.trim()}`);
  if (content.instructions?.trim())
    parts.push(`Instructions: ${content.instructions.trim()}`);

  parts.push("Items:");
  content.items.forEach((it, idx) => {
    const body = stripHtml(it.bodyHtml || "");
    const imageMarker = it.imageUrl ? " (image)" : "";
    parts.push(`${idx + 1}. ${it.title?.trim() || "Untitled"}${imageMarker}`);
    if (body) parts.push(body);
  });

  return parts.join("\n");
};

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn("Could not fetch current user for learning_events", error);
    return null;
  }
  return data.user?.id ?? null;
}

type AccordionBlockProps = {
  block: LessonBlock;
  onChange: (updatedBlock: LessonBlock) => void;
  isPreviewMode?: boolean;
  pageId?: string | null;
  page_id?: string | null;
  moduleId?: string | null;
  module_id?: string | null;

  // Standard block toolbar props (optional; we ignore if not provided)
  onStyleChange?: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange?: (layout: BlockLayout) => void;
  onMetadataChange?: (metadata: BlockMetadata) => void;
  onMblMetadataCleared?: () => void;
  onMblMetadataUpdated?: (mblMetadata: unknown) => void;
  onAnimationChange?: (animation: BlockAnimation) => void;
  onDurationChange?: (duration: AnimationDuration) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isFormatPanelOpen?: boolean;
  onToggleFormatPanel?: () => void;
  isMetadataPanelOpen?: boolean;
  onToggleMetadataPanel?: () => void;
  isAppearancePanelOpen?: boolean;
  onToggleAppearancePanel?: () => void;
  savedToDb?: boolean;
  mblMetadata?: unknown;

  // Accept/ignore any extra props safely (LessonBuilder may pass more later)
  [key: string]: unknown;
};

function getDefaultOpenIds(
  items: AccordionItem[],
  allowMultipleOpen: boolean
): string[] {
  const openByDefault = items.filter((i) => i.isOpenByDefault).map((i) => i.id);
  if (allowMultipleOpen) return openByDefault;
  return openByDefault.length > 0 ? [openByDefault[0]] : [];
}

function makeNewItem(): AccordionItem {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto.randomUUID as () => string)()
      : `acc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    title: "New item",
    bodyHtml: "<p>Type your content...</p>",
  };
}

export const AccordionBlock: React.FC<AccordionBlockProps> = (props) => {
  const {
    block,
    onChange,
    isPreviewMode = false,
    pageId,
    page_id,
    moduleId,
    module_id,
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
    canMoveUp = false,
    canMoveDown = false,
    isFormatPanelOpen = false,
    onToggleFormatPanel,
    isMetadataPanelOpen = false,
    onToggleMetadataPanel,
    isAppearancePanelOpen = false,
    onToggleAppearancePanel,
    savedToDb,
    mblMetadata,
  } = props;

  const content = (block.content ?? {}) as AccordionContent;
  const items = content.items ?? [];
  const allowMultipleOpen = content.settings?.allowMultipleOpen ?? false;
  const resolvedPageId = pageId ?? page_id ?? null;
  const resolvedModuleId = moduleId ?? module_id ?? null;

  const stableId = useId();

  const initialOpenIds = useMemo(
    () => getDefaultOpenIds(items, allowMultipleOpen),
    // Only use defaults on first mount for a given block/items snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [block.id]
  );

  const [openIds, setOpenIds] = useState<string[]>(initialOpenIds);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [mediaPickerItemId, setMediaPickerItemId] = useState<string | null>(
    null
  );

  // Learning event tracking (same timing + sequencing pattern as flashcards)
  const startedEventFiredRef = useRef<boolean>(false);
  const toggleSequenceRef = useRef<number>(0);
  const lastAnyToggleAtRef = useRef<number | null>(null);
  const lastToggleAtByItemIdRef = useRef<Record<string, number>>({});
  const lastToggledItemIdRef = useRef<string | null>(null);

  // If items list changes drastically (e.g. all items deleted), keep state sane
  useEffect(() => {
    const itemIdSet = new Set(items.map((i) => i.id));
    setOpenIds((prev) => prev.filter((id) => itemIdSet.has(id)));
  }, [items]);

  // Fire once when learner first sees the block in preview mode
  useEffect(() => {
    if (!isPreviewMode) return;
    if (startedEventFiredRef.current) return;
    startedEventFiredRef.current = true;

    const now = Date.now();
    const eventTimeIso = new Date(now).toISOString();
    const initiallyOpenCount = items.filter((it) => it.isOpenByDefault).length;

    void (async () => {
      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          console.warn(
            "No user_id available, skipping learning_events insert (accordion_started)"
          );
          return;
        }

        const payload = {
          user_id: userId,
          module_id: resolvedModuleId,
          page_id: resolvedPageId,
          block_id: block.id,
          event_type: "accordion_started" as const,
          event_time: eventTimeIso,
          duration_ms: null,
          metadata: {
            item_count: items.length,
            initially_open_count: initiallyOpenCount,
          },
        };

        const { error } = await supabase
          .from("learning_events")
          .insert(payload);
        if (error) {
          console.error(
            "LEARNING EVENT INSERT ERROR (accordion_started)",
            error
          );
        }
      } catch (err) {
        console.error("Failed to save accordion_started learning event:", err);
      }
    })();
  }, [block.id, isPreviewMode, items, props]);

  const toggleItem = (itemId: string) => {
    const isOpenNow = openIds.includes(itemId);
    const action: "open" | "close" = isOpenNow ? "close" : "open";

    const nextOpenIds = (() => {
      if (allowMultipleOpen) {
        return isOpenNow
          ? openIds.filter((id) => id !== itemId)
          : [...openIds, itemId];
      }
      return isOpenNow ? [] : [itemId];
    })();

    setOpenIds(nextOpenIds);

    // Only log learner interactions in preview mode
    if (!isPreviewMode) return;

    const now = Date.now();
    const globalPrev = lastAnyToggleAtRef.current;
    const timeSinceAnyToggleMs: number | null =
      typeof globalPrev === "number" ? now - globalPrev : null;

    const prevItemId = lastToggledItemIdRef.current;
    const prevItemLast = prevItemId
      ? lastToggleAtByItemIdRef.current[prevItemId]
      : undefined;
    const timeOnPreviousItemMs: number | null =
      typeof prevItemLast === "number" ? now - prevItemLast : null;

    const itemPrev = lastToggleAtByItemIdRef.current[itemId];
    const timeSinceLastToggleForItemMs: number | null =
      typeof itemPrev === "number" ? now - itemPrev : null;

    // Increment sequence for this preview session
    toggleSequenceRef.current += 1;
    const toggleSequence = toggleSequenceRef.current;

    // Update refs for next time
    lastAnyToggleAtRef.current = now;
    lastToggleAtByItemIdRef.current[itemId] = now;
    lastToggledItemIdRef.current = itemId;

    const eventTimeIso = new Date(now).toISOString();

    void (async () => {
      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          console.warn(
            "No user_id available, skipping learning_events insert (accordion_toggle)"
          );
          return;
        }

        const payload = {
          user_id: userId,
          module_id: resolvedModuleId,
          page_id: resolvedPageId,
          block_id: block.id,
          event_type: "accordion_toggle" as const,
          event_time: eventTimeIso,
          // Mirror flashcards: duration_ms captures time spent on previous item before this toggle
          duration_ms: timeOnPreviousItemMs,
          metadata: {
            itemId,
            action,
            toggle_sequence: toggleSequence,
            time_since_any_toggle_ms: timeSinceAnyToggleMs,
            time_on_previous_item_ms: timeOnPreviousItemMs,
            time_since_last_toggle_for_item_ms: timeSinceLastToggleForItemMs,
          },
        };

        const { error } = await supabase
          .from("learning_events")
          .insert(payload);
        if (error) {
          console.error(
            "LEARNING EVENT INSERT ERROR (accordion_toggle)",
            error
          );
        }
      } catch (err) {
        console.error("Failed to save accordion_toggle learning event:", err);
      }
    })();
  };

  const updateContent = (next: AccordionContent) => {
    onChange({
      ...block,
      content: next,
    });
  };

  const updateItem = (itemId: string, patch: Partial<AccordionItem>) => {
    const nextItems = items.map((it) =>
      it.id === itemId ? { ...it, ...patch } : it
    );
    updateContent({
      ...content,
      items: nextItems,
    });
  };

  const addItem = () => {
    const newItem = makeNewItem();
    updateContent({
      ...content,
      items: [...items, newItem],
    });
  };

  const deleteItem = (itemId: string) => {
    updateContent({
      ...content,
      items: items.filter((it) => it.id !== itemId),
    });
    setOpenIds((prev) => prev.filter((id) => id !== itemId));
  };

  // Handle selecting an image from the media library
  const handleSelectAsset = (asset: MediaAsset) => {
    if (!mediaPickerItemId) return;
    updateItem(mediaPickerItemId, {
      imageUrl: asset.public_url,
      imageAlt: asset.alt_text || "",
    });
    setIsMediaLibraryOpen(false);
    setMediaPickerItemId(null);
  };

  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const blockHasMetadata = hasBlockMetadata((block as any).metadata);

  const savedToDbResolved = (block as any).savedToDb ?? savedToDb;
  const mblMetadataResolved = (block as any).mblMetadata ?? mblMetadata;

  const inlineBackgroundColor =
    (block as any).style === "custom" && (block as any).customBackgroundColor
      ? ((block as any).customBackgroundColor as string)
      : undefined;

  const layout = (block as any).layout || DEFAULT_BLOCK_LAYOUT;

  const cardClass =
    "w-full rounded-xl border border-gray-200 bg-white shadow-sm";

  const dividerClass = "border-t border-gray-200";

  return (
    <div className="w-full group">
      <div
        className={`
          relative w-full transition-all duration-300 ease-in-out
          ${getBlockStyleClasses((block as any).style)}
        `}
        style={
          inlineBackgroundColor
            ? { backgroundColor: inlineBackgroundColor }
            : undefined
        }
      >
        {/* Toolbars + panels only in builder mode */}
        {!isPreviewMode && (
          <>
            {/* LEFT GUTTER TOOLBAR */}
            <div className="absolute left-4 top-6 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {/* Layout / Format */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFormatPanel?.();
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
                  onToggleAppearancePanel?.();
                }}
                className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
                  isAppearancePanelOpen
                    ? "text-[#ff7a00] bg-orange-50"
                    : (block as any).content?.animation &&
                      (block as any).content?.animation !== "none"
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
                  onToggleMetadataPanel?.();
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
              style={(block as any).style}
              customBackgroundColor={(block as any).customBackgroundColor}
              onChange={(newStyle, customColor) => {
                onStyleChange?.(newStyle, customColor);
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
                onLayoutChange={(nextLayout) => onLayoutChange?.(nextLayout)}
                onClose={() => onToggleFormatPanel?.()}
              />
            )}

            {/* Appearance Panel */}
            {isAppearancePanelOpen && (
              <AppearancePanel
                animation={
                  ((block as any).content?.animation as BlockAnimation) ||
                  "none"
                }
                duration={
                  ((block as any).content
                    ?.animationDuration as AnimationDuration) || "normal"
                }
                onChange={(val) => onAnimationChange?.(val)}
                onDurationChange={(val) => onDurationChange?.(val)}
                onClose={() => onToggleAppearancePanel?.()}
              />
            )}

            {/* Metadata Panel */}
            {isMetadataPanelOpen && (
              <BlockMetadataPopover
                metadata={(block as any).metadata || DEFAULT_BLOCK_METADATA}
                onChange={(next) => onMetadataChange?.(next)}
                onClose={() => onToggleMetadataPanel?.()}
                blockId={block.id}
                blockType={block.type}
                blockContent={summariseAccordionForAi(content)}
                savedToDb={savedToDbResolved}
                mblMetadata={mblMetadataResolved}
                onMblMetadataCleared={onMblMetadataCleared ?? (() => {})}
                onMblMetadataUpdated={onMblMetadataUpdated ?? (() => {})}
              />
            )}
          </>
        )}

        <BlockWrapper layout={layout}>
          <div className={cardClass}>
            {items.length === 0 ? (
              <div className="p-5 text-sm text-gray-600">
                {isPreviewMode
                  ? "No items."
                  : "No items yet. Add your first accordion item."}
              </div>
            ) : (
              items.map((item, idx) => {
                const isOpen = openIds.includes(item.id);
                const panelId = `accordion-panel-${stableId}-${item.id}`;
                const buttonId = `accordion-button-${stableId}-${item.id}`;

                return (
                  <div key={item.id} className={idx === 0 ? "" : dividerClass}>
                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                      {!isPreviewMode ? (
                        <div className="flex-1 min-w-0">
                          <label className="sr-only">
                            Accordion item title
                          </label>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) =>
                              updateItem(item.id, { title: e.target.value })
                            }
                            className="w-full bg-transparent text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
                            placeholder="Item title..."
                          />
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {item.title}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        {!isPreviewMode && (
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            aria-label="Delete item"
                            title="Delete item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          id={buttonId}
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                        >
                          {isOpen ? (
                            <Minus className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Smooth expand/collapse */}
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className={`grid overflow-hidden px-5 ${
                        isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr] pb-0"
                      } transition-[grid-template-rows,padding] duration-200 ease-in-out`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        {!isPreviewMode ? (
                          <div className="pt-2 space-y-4">
                            {/* Image (optional) */}
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-2">
                                Image
                              </div>

                              {!item.imageUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMediaPickerItemId(item.id);
                                    setIsMediaLibraryOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  Choose image
                                </button>
                              ) : (
                                <div className="space-y-3">
                                  <div className="w-full rounded-xl border border-gray-200 overflow-hidden bg-white">
                                    <img
                                      src={item.imageUrl}
                                      alt={item.imageAlt || ""}
                                      className="w-full h-auto object-cover"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMediaPickerItemId(item.id);
                                        setIsMediaLibraryOpen(true);
                                      }}
                                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      Change image
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateItem(item.id, {
                                          imageUrl: undefined,
                                          imageAlt: undefined,
                                        })
                                      }
                                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      Remove
                                    </button>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Alt text
                                    </label>
                                    <input
                                      type="text"
                                      value={item.imageAlt ?? ""}
                                      onChange={(e) =>
                                        updateItem(item.id, {
                                          imageAlt: e.target.value,
                                        })
                                      }
                                      placeholder="Describe the image for accessibility..."
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Body */}
                            <TipTapEditor
                              content={item.bodyHtml}
                              onChange={(val) =>
                                updateItem(item.id, { bodyHtml: val })
                              }
                              className="prose prose-sm max-w-none [&>p]:m-0"
                              placeholder="Type content..."
                            />
                          </div>
                        ) : (
                          <div className="pt-2 space-y-4">
                            <div
                              className="prose prose-sm max-w-none text-gray-800 [&>p]:m-0 [&>p:not(:last-child)]:mb-2"
                              dangerouslySetInnerHTML={{
                                __html: item.bodyHtml,
                              }}
                            />

                            {item.imageUrl && (
                              <div className="w-full rounded-xl border border-gray-200 overflow-hidden bg-white">
                                <img
                                  src={item.imageUrl}
                                  alt={item.imageAlt || ""}
                                  className="w-full h-auto object-cover"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!isPreviewMode && (
            <div className="mt-4">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Add item
              </button>
            </div>
          )}
        </BlockWrapper>
      </div>

      {/* Media Library Modal */}
      {!isPreviewMode && isMediaLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsMediaLibraryOpen(false);
              setMediaPickerItemId(null);
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
                  setMediaPickerItemId(null);
                }}
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
