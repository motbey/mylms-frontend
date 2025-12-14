import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Palette,
  PanelsLeftRight,
  Pencil,
  Plus,
  Stars,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../../../../lib/supabaseClient";
import { ImageUploadAndLibrary } from "../../../media";
import type { MediaAsset } from "../../../../lib/mediaAssets";
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
  hasBlockMetadata,
} from "../../../../types/blocks";
import type { BlockLayout, BlockMetadata } from "../../../../types/blocks";
import type {
  AnimationDuration,
  BlockAnimation,
  LessonBlock,
} from "../../../../../pages/admin/content/LessonBuilder";

// Content shape for flashcards block
type FlashcardDisplayMode = "text" | "centeredImage" | "fullCardImage";

interface FlashcardImage {
  id: string;
  url: string;
  alt?: string;
}

interface FlashcardItem {
  id: string;
  frontHtml: string;
  backHtml: string;
  frontDisplayMode?: FlashcardDisplayMode;
  backDisplayMode?: FlashcardDisplayMode;
  frontImage?: FlashcardImage;
  backImage?: FlashcardImage;
}

interface FlashcardsContent {
  blockType: "flashcards";
  cards: FlashcardItem[];
}

// FlashcardsBlock component - interactive flashcards
interface FlashcardsBlockProps {
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

/**
 * Summarise flashcard content for AI metadata generation.
 * Returns a human-readable summary of all cards including front/back text and image alt text.
 */
function summariseFlashcardsForAi(cards: FlashcardItem[]): string {
  if (!Array.isArray(cards) || cards.length === 0) {
    return "Flashcard set with no cards defined.";
  }

  const lines: string[] = [];
  lines.push(`Flashcard set (${cards.length} cards).`);
  lines.push(
    "Each card has a front and back. Treat the whole set as a single learning activity."
  );

  // Helper to strip HTML tags
  const stripHtml = (html: string | null | undefined): string => {
    if (!html) return "";
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<\/(p|div|li|br)\s*>/gi, "$&\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  cards.forEach((card, index) => {
    const n = index + 1;
    const frontMode = card.frontDisplayMode ?? "text";
    const backMode = card.backDisplayMode ?? "text";

    const frontText = stripHtml(card.frontHtml ?? "");
    const backText = stripHtml(card.backHtml ?? "");

    lines.push("");
    lines.push(`Card ${n}:`);

    // FRONT
    if (frontMode === "text" && frontText) {
      lines.push(`  Front (text): ${frontText}`);
    } else if (card.frontImage) {
      const alt =
        card.frontImage.alt ||
        "Image used on the front of this flashcard (no text).";
      lines.push(`  Front (image): ${alt}`);
    } else {
      lines.push("  Front: (empty)");
    }

    // BACK
    if (backMode === "text" && backText) {
      lines.push(`  Back (text): ${backText}`);
    } else if (card.backImage) {
      const alt =
        card.backImage.alt ||
        "Image used on the back of this flashcard (no text).";
      lines.push(`  Back (image): ${alt}`);
    } else {
      lines.push("  Back: (empty)");
    }
  });

  const joined = lines.join("\n");
  // Truncate if too long for the AI
  return joined.length > 6000
    ? joined.slice(0, 6000) + "\n[truncated]"
    : joined;
}

const FlashcardsBlockInternal: React.FC<FlashcardsBlockProps> = ({
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
  const [flippedById, setFlippedById] = useState<Record<string, boolean>>({});
  const [isEditingFlashcards, setIsEditingFlashcards] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<{
    cardId: string;
    face: "front" | "back";
  } | null>(null);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Extract content from block
  const flashcardsContent = block.content as {
    cards?: FlashcardItem[];
    title?: string;
  };
  const cards = flashcardsContent?.cards || [];
  const title = flashcardsContent?.title || "Flashcards";

  // Default cards if none provided
  const defaultCards: FlashcardItem[] = [
    {
      id: "card-1",
      frontHtml: "What does PPE stand for?",
      backHtml:
        "PPE stands for <strong>Personal Protective Equipment</strong>.",
    },
    {
      id: "card-2",
      frontHtml: "When should you report a safety hazard?",
      backHtml:
        "As soon as you notice it, <em>even if no one has been hurt</em>.",
    },
    {
      id: "card-3",
      frontHtml: "Why does MyLMS use Memory-Based Learning (MBL)?",
      backHtml:
        "To adapt training to each learner's behaviour, not to measure how 'smart' they are.",
    },
  ];

  const effectiveCards = cards.length > 0 ? cards : defaultCards;

  // Editable state for the modal
  const [editingCards, setEditingCards] = useState<FlashcardItem[]>([]);

  // Initialize editing cards when modal opens
  const openEditModal = () => {
    setEditingCards([...effectiveCards]);
    setIsEditingFlashcards(true);
  };

  // Update a single card's text field
  const handleCardChange = (
    cardId: string,
    field: "frontHtml" | "backHtml",
    value: string
  ) => {
    setEditingCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, [field]: value } : card
      )
    );
  };

  // Update a card's display mode
  const handleDisplayModeChange = (
    cardId: string,
    face: "front" | "back",
    mode: FlashcardDisplayMode
  ) => {
    setEditingCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              [face === "front" ? "frontDisplayMode" : "backDisplayMode"]: mode,
            }
          : card
      )
    );
  };

  // Open media picker for a specific card face
  const openMediaPicker = (cardId: string, face: "front" | "back") => {
    setMediaPickerTarget({ cardId, face });
    setIsMediaLibraryOpen(true);
  };

  // Handle selecting an image from media library
  const handleSelectAsset = (asset: MediaAsset) => {
    if (!mediaPickerTarget) return;

    const { cardId, face } = mediaPickerTarget;
    const imageField = face === "front" ? "frontImage" : "backImage";

    setEditingCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              [imageField]: {
                id: asset.id,
                url: asset.public_url,
                alt: asset.alt_text || "",
              },
            }
          : card
      )
    );

    setIsMediaLibraryOpen(false);
    setMediaPickerTarget(null);
  };

  // Clear an image from a card face
  const clearImage = (cardId: string, face: "front" | "back") => {
    const imageField = face === "front" ? "frontImage" : "backImage";
    setEditingCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, [imageField]: undefined } : card
      )
    );
  };

  // Add a new card
  const handleAddCard = () => {
    const newCard: FlashcardItem = {
      id: `card-${Date.now()}`,
      frontHtml: "",
      backHtml: "",
      frontDisplayMode: "text",
      backDisplayMode: "text",
    };
    setEditingCards((prev) => [...prev, newCard]);
  };

  // Remove a card
  const handleRemoveCard = (cardId: string) => {
    setEditingCards((prev) => prev.filter((card) => card.id !== cardId));
  };

  // Save changes and close modal
  const handleSaveCards = () => {
    onChange({
      ...block,
      content: {
        ...block.content,
        cards: editingCards,
      },
    });
    setIsEditingFlashcards(false);
  };

  const toggleCard = (id: string) => {
    setFlippedById((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
          {/* Edit Flashcards */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal();
            }}
            className="inline-flex items-center justify-center h-6 w-6 rounded-full text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 transition-colors"
            aria-label="Edit flashcards"
            title="Edit flashcards"
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
            metadata={block.metadata}
            onChange={onMetadataChange}
            onClose={onToggleMetadataPanel}
            blockId={block.id}
            blockType={block.type}
            blockContent={summariseFlashcardsForAi(cards)}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
            moduleId={moduleId}
            pageId={pageId}
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

        {/* BLOCK CONTENT - Flashcards */}
        <BlockWrapper layout={layout}>
          <div className="w-full">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {effectiveCards.map((card, index) => {
                const flipped = !!flippedById[card.id];

                const innerBaseClasses =
                  "relative h-full w-full rounded-2xl border shadow-sm transition-transform duration-500 [transform-style:preserve-3d]";
                const innerStateClasses = flipped
                  ? "border-slate-200 bg-sky-50 [transform:rotateY(180deg)]"
                  : "border-slate-200 bg-white";

                // Determine display modes
                const frontMode = card.frontDisplayMode || "text";
                const backMode = card.backDisplayMode || "text";
                const isFrontFullImage = frontMode === "fullCardImage";
                const isBackFullImage = backMode === "fullCardImage";

                // Helper to render face content based on display mode
                const renderFaceContent = (
                  face: "front" | "back"
                ): React.ReactNode => {
                  const mode = face === "front" ? frontMode : backMode;
                  const html =
                    face === "front"
                      ? card.frontHtml || ""
                      : card.backHtml || "";
                  const image =
                    face === "front" ? card.frontImage : card.backImage;

                  // Centered image mode - IMAGE ONLY, no text
                  if (mode === "centeredImage" && image) {
                    return (
                      <div className="flex h-full w-full items-center justify-center">
                        <img
                          src={image.url}
                          alt={image.alt || ""}
                          className="max-h-[70%] max-w-[80%] rounded-lg object-contain"
                        />
                      </div>
                    );
                  }

                  // Full card image mode - full-bleed image, no text
                  if (mode === "fullCardImage" && image) {
                    return (
                      <div className="h-full w-full overflow-hidden rounded-2xl">
                        <img
                          src={image.url}
                          alt={image.alt || ""}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    );
                  }

                  // Default: text mode
                  return (
                    <div
                      className="prose max-w-none text-slate-900 text-center"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  );
                };

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => toggleCard(card.id)}
                    className="relative w-full aspect-square outline-none ring-0 focus:outline-none focus:ring-0"
                  >
                    <div className="relative h-full w-full [perspective:1200px]">
                      <div
                        className={`${innerBaseClasses} ${innerStateClasses}`}
                      >
                        {/* FRONT */}
                        <div
                          className={`absolute inset-0 flex flex-col [backface-visibility:hidden] ${
                            isFrontFullImage ? "p-0" : "p-4"
                          }`}
                        >
                          {/* Flip icon - always visible, positioned absolutely for full image */}
                          <div
                            className={
                              isFrontFullImage
                                ? "absolute top-2 right-2 z-10"
                                : "flex justify-end mb-2"
                            }
                          >
                            <div
                              className={
                                isFrontFullImage
                                  ? "bg-white/80 rounded-full p-1.5 shadow-sm"
                                  : ""
                              }
                            >
                              <svg
                                className={`w-5 h-5 ${
                                  isFrontFullImage
                                    ? "text-slate-600"
                                    : "text-slate-400"
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </div>
                          </div>

                          <div
                            className={
                              isFrontFullImage
                                ? "h-full w-full"
                                : "flex-1 flex items-center justify-center"
                            }
                          >
                            {renderFaceContent("front")}
                          </div>
                        </div>

                        {/* BACK */}
                        <div
                          className={`absolute inset-0 flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                            isBackFullImage ? "p-0" : "p-4"
                          }`}
                        >
                          {/* Flip icon - always visible, positioned absolutely for full image */}
                          <div
                            className={
                              isBackFullImage
                                ? "absolute top-2 right-2 z-10"
                                : "flex justify-end mb-2"
                            }
                          >
                            <div
                              className={
                                isBackFullImage
                                  ? "bg-white/80 rounded-full p-1.5 shadow-sm"
                                  : ""
                              }
                            >
                              <svg
                                className={`w-5 h-5 ${
                                  isBackFullImage
                                    ? "text-slate-600"
                                    : "text-slate-400"
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </div>
                          </div>

                          <div
                            className={
                              isBackFullImage
                                ? "h-full w-full"
                                : "flex-1 flex items-center justify-center"
                            }
                          >
                            {renderFaceContent("back")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </BlockWrapper>
      </div>

      {/* Flashcard Editor Modal */}
      {isEditingFlashcards && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsEditingFlashcards(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit Flashcards
              </h2>
              <button
                type="button"
                onClick={() => setIsEditingFlashcards(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {editingCards.map((card, index) => (
                  <div
                    key={card.id}
                    className="border border-slate-200 rounded-lg p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">
                        Card {index + 1}
                      </span>
                      {editingCards.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCard(card.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Remove card"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* FRONT SIDE */}
                    <div className="bg-slate-50 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                          Front
                        </label>
                        <select
                          value={card.frontDisplayMode || "text"}
                          onChange={(e) =>
                            handleDisplayModeChange(
                              card.id,
                              "front",
                              e.target.value as FlashcardDisplayMode
                            )
                          }
                          className="text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#ff7a00]"
                        >
                          <option value="text">Text</option>
                          <option value="centeredImage">Centered Image</option>
                          <option value="fullCardImage">Full Card Image</option>
                        </select>
                      </div>

                      {/* Text input - always show for caption in image modes */}
                      <textarea
                        value={card.frontHtml}
                        onChange={(e) =>
                          handleCardChange(card.id, "frontHtml", e.target.value)
                        }
                        placeholder={
                          (card.frontDisplayMode || "text") === "text"
                            ? "Enter the question..."
                            : "Optional caption..."
                        }
                        className="w-full p-2 border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff7a00] focus:border-transparent resize-none bg-white"
                        rows={
                          (card.frontDisplayMode || "text") === "text" ? 2 : 1
                        }
                      />

                      {/* Image picker for image modes */}
                      {(card.frontDisplayMode === "centeredImage" ||
                        card.frontDisplayMode === "fullCardImage") && (
                        <div className="space-y-2">
                          {card.frontImage ? (
                            <div className="flex items-center gap-3 p-2 bg-white rounded-md border border-slate-200">
                              <img
                                src={card.frontImage.url}
                                alt={card.frontImage.alt || ""}
                                className="h-12 w-12 rounded object-cover"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-600 truncate">
                                  {card.frontImage.alt || "Image selected"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  openMediaPicker(card.id, "front")
                                }
                                className="text-xs font-medium text-[#ff7a00] hover:text-[#e56d00]"
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                onClick={() => clearImage(card.id, "front")}
                                className="text-xs text-slate-400 hover:text-red-500"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openMediaPicker(card.id, "front")}
                              className="w-full py-2 px-3 border border-dashed border-slate-300 rounded-md text-sm text-slate-500 hover:border-[#ff7a00] hover:text-[#ff7a00] transition-colors bg-white"
                            >
                              + Select image from library
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* BACK SIDE */}
                    <div className="bg-sky-50 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                          Back
                        </label>
                        <select
                          value={card.backDisplayMode || "text"}
                          onChange={(e) =>
                            handleDisplayModeChange(
                              card.id,
                              "back",
                              e.target.value as FlashcardDisplayMode
                            )
                          }
                          className="text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#ff7a00]"
                        >
                          <option value="text">Text</option>
                          <option value="centeredImage">Centered Image</option>
                          <option value="fullCardImage">Full Card Image</option>
                        </select>
                      </div>

                      {/* Text input - always show for caption in image modes */}
                      <textarea
                        value={card.backHtml}
                        onChange={(e) =>
                          handleCardChange(card.id, "backHtml", e.target.value)
                        }
                        placeholder={
                          (card.backDisplayMode || "text") === "text"
                            ? "Enter the answer..."
                            : "Optional caption..."
                        }
                        className="w-full p-2 border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff7a00] focus:border-transparent resize-none bg-white"
                        rows={
                          (card.backDisplayMode || "text") === "text" ? 2 : 1
                        }
                      />

                      {/* Image picker for image modes */}
                      {(card.backDisplayMode === "centeredImage" ||
                        card.backDisplayMode === "fullCardImage") && (
                        <div className="space-y-2">
                          {card.backImage ? (
                            <div className="flex items-center gap-3 p-2 bg-white rounded-md border border-slate-200">
                              <img
                                src={card.backImage.url}
                                alt={card.backImage.alt || ""}
                                className="h-12 w-12 rounded object-cover"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-600 truncate">
                                  {card.backImage.alt || "Image selected"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => openMediaPicker(card.id, "back")}
                                className="text-xs font-medium text-[#ff7a00] hover:text-[#e56d00]"
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                onClick={() => clearImage(card.id, "back")}
                                className="text-xs text-slate-400 hover:text-red-500"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openMediaPicker(card.id, "back")}
                              className="w-full py-2 px-3 border border-dashed border-slate-300 rounded-md text-sm text-slate-500 hover:border-[#ff7a00] hover:text-[#ff7a00] transition-colors bg-white"
                            >
                              + Select image from library
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Card Button */}
              <button
                type="button"
                onClick={handleAddCard}
                className="mt-4 w-full py-2 px-4 border-2 border-dashed border-slate-300 rounded-lg text-sm font-medium text-slate-500 hover:border-[#ff7a00] hover:text-[#ff7a00] transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Card
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditingFlashcards(false)}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCards}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-[#ff7a00] hover:bg-[#e56d00] text-white transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Library Modal for Flashcards */}
      {isMediaLibraryOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsMediaLibraryOpen(false);
              setMediaPickerTarget(null);
            }}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Select Image for{" "}
                {mediaPickerTarget?.face === "front" ? "Front" : "Back"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsMediaLibraryOpen(false);
                  setMediaPickerTarget(null);
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

export const FlashcardsBlock = FlashcardsBlockInternal;

// Helper to get current Supabase auth user id
async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn("Could not fetch current user for learning_events", error);
    return null;
  }
  return data.user?.id ?? null;
}

// Types for flashcard summary tracking
type FlipSide = "front" | "back";

interface FlipEventForSummary {
  cardId: string;
  flippedTo: FlipSide;
  timestamp: string; // ISO time
  durationMs: number | null;
}

// Helper component for flashcards preview
const FlashcardsPreviewInternal: React.FC<{
  cards?: FlashcardItem[];
  previewWidth?: "desktop" | "tablet" | "mobile";
  blockId?: string;
  pageId?: string;
}> = ({ cards, previewWidth = "desktop", blockId, pageId }) => {
  const [flippedById, setFlippedById] = useState<Record<string, boolean>>({});

  // Timing refs for tracking flip events
  const lastFlipGlobalRef = useRef<number | null>(null);
  const lastFlipPerCardRef = useRef<
    Record<string, { lastTimestamp: number; lastSide: "front" | "back" }>
  >({});
  const flipSequenceRef = useRef<number>(0);

  // Ref to capture all flip events for summary on unmount
  const flipEventsRef = useRef<FlipEventForSummary[]>([]);
  // Ref to store the last known userId for use in cleanup
  const lastUserIdRef = useRef<string | null>(null);

  // Default cards if none provided
  const defaultCards: FlashcardItem[] = [
    {
      id: "card-1",
      frontHtml: "What does PPE stand for?",
      backHtml:
        "PPE stands for <strong>Personal Protective Equipment</strong>.",
    },
    {
      id: "card-2",
      frontHtml: "When should you report a safety hazard?",
      backHtml:
        "As soon as you notice it, <em>even if no one has been hurt</em>.",
    },
    {
      id: "card-3",
      frontHtml: "Why does MyLMS use Memory-Based Learning (MBL)?",
      backHtml:
        "To adapt training to each learner's behaviour, not to measure how 'smart' they are.",
    },
  ];

  const effectiveCards = cards && cards.length > 0 ? cards : defaultCards;

  const handleFlip = async (card: FlashcardItem) => {
    const flippedTo: "front" | "back" = flippedById[card.id] ? "front" : "back";
    const cardId = card.id;
    const frontDisplayMode = card.frontDisplayMode;
    const backDisplayMode = card.backDisplayMode;

    // Compute timing metrics
    const now = Date.now();

    const globalPrev = lastFlipGlobalRef.current;
    const cardPrev = lastFlipPerCardRef.current[cardId];

    const timeSinceAnyFlipMs: number | null =
      typeof globalPrev === "number" ? now - globalPrev : null;

    const timeOnPreviousSideMs: number | null =
      cardPrev && typeof cardPrev.lastTimestamp === "number"
        ? now - cardPrev.lastTimestamp
        : null;

    const timeSinceLastFlipForCardMs: number | null =
      cardPrev && typeof cardPrev.lastTimestamp === "number"
        ? now - cardPrev.lastTimestamp
        : null;

    // Increment flip sequence for this preview session
    flipSequenceRef.current += 1;
    const flipSequence = flipSequenceRef.current;

    // Update refs for next time
    lastFlipGlobalRef.current = now;
    lastFlipPerCardRef.current[cardId] = {
      lastTimestamp: now,
      lastSide: flippedTo,
    };

    // Log flip event with timing data
    console.log("FLASHCARD FLIP EVENT", {
      cardId,
      flippedTo,
      frontDisplayMode,
      backDisplayMode,
      timestamp: new Date(now).toISOString(),
      timeOnPreviousSideMs,
      timeSinceAnyFlipMs,
      timeSinceLastFlipForCardMs,
      flipSequence,
    });

    // Update UI state immediately
    setFlippedById((prev) => ({
      ...prev,
      [card.id]: !prev[card.id],
    }));

    // Insert learning event to database
    try {
      // 1) Get current user id
      const userId = await getCurrentUserId();
      if (!userId) {
        console.warn("No user_id available, skipping learning_events insert");
        return;
      }

      // Store userId for use in cleanup/summary
      lastUserIdRef.current = userId;

      // 2) Build payload including user_id and timing data
      const eventTimeIso = new Date(now).toISOString();

      const payload: {
        user_id: string;
        module_id: null;
        page_id: string | null;
        block_id: string | undefined;
        event_type: string;
        event_time: string;
        duration_ms: number | null;
        metadata: Record<string, unknown>;
      } = {
        user_id: userId,
        module_id: null,
        page_id: pageId ?? null,
        block_id: blockId,
        event_type: "flashcard_flip",
        event_time: eventTimeIso,
        // time spent looking at the previous side before flipping
        duration_ms: timeOnPreviousSideMs,
        metadata: {
          cardId,
          flippedTo,
          frontDisplayMode,
          backDisplayMode,
          time_on_previous_side_ms: timeOnPreviousSideMs,
          time_since_any_flip_ms: timeSinceAnyFlipMs,
          time_since_last_flip_for_card_ms: timeSinceLastFlipForCardMs,
          flip_sequence: flipSequence,
        },
      };

      // Push flip event into ref for summary tracking
      flipEventsRef.current.push({
        cardId,
        flippedTo: flippedTo as FlipSide,
        timestamp: payload.event_time,
        durationMs: payload.duration_ms ?? null,
      });

      console.log("LEARNING EVENT INSERT PAYLOAD", payload);

      const { data, error } = await supabase
        .from("learning_events")
        .insert(payload);

      if (error) {
        console.error("LEARNING EVENT INSERT ERROR", error);
      } else {
        console.log("Saved learning event to DB", data);
      }
    } catch (err) {
      console.error("Failed to save learning event:", err);
    }
  };

  // On preview unmount, insert per-card summary rows
  useEffect(() => {
    // Cleanup runs when the preview unmounts
    return () => {
      const events = flipEventsRef.current;
      if (!events.length) return;

      type CardSummary = {
        cardId: string;
        totalDurationMs: number;
        flipCount: number;
        firstFlipAt: string;
        lastFlipAt: string;
        sides: Set<FlipSide>;
      };

      const byCard = new Map<string, CardSummary>();

      for (const e of events) {
        let summary = byCard.get(e.cardId);
        if (!summary) {
          summary = {
            cardId: e.cardId,
            totalDurationMs: 0,
            flipCount: 0,
            firstFlipAt: e.timestamp,
            lastFlipAt: e.timestamp,
            sides: new Set<FlipSide>(),
          };
          byCard.set(e.cardId, summary);
        }

        summary.flipCount += 1;
        summary.totalDurationMs += e.durationMs ?? 0;

        if (e.timestamp < summary.firstFlipAt) {
          summary.firstFlipAt = e.timestamp;
        }
        if (e.timestamp > summary.lastFlipAt) {
          summary.lastFlipAt = e.timestamp;
        }

        summary.sides.add(e.flippedTo);
      }

      if (!byCard.size) return;

      const nowIso = new Date().toISOString();
      const userId = lastUserIdRef.current;

      if (!userId) {
        console.warn(
          "No user_id available for flashcard_summary, skipping insert"
        );
        return;
      }

      const rows = Array.from(byCard.values()).map((summary) => ({
        user_id: userId,
        module_id: null,
        page_id: pageId ?? null,
        block_id: blockId,
        event_type: "flashcard_summary" as const,
        event_time: nowIso,
        duration_ms: summary.totalDurationMs,
        metadata: {
          card_id: summary.cardId,
          flip_count: summary.flipCount,
          total_view_ms: summary.totalDurationMs,
          avg_view_ms:
            summary.flipCount > 0
              ? Math.round(summary.totalDurationMs / summary.flipCount)
              : 0,
          first_flip_at: summary.firstFlipAt,
          last_flip_at: summary.lastFlipAt,
          unique_sides_seen: Array.from(summary.sides),
        },
      }));

      if (!rows.length) return;

      console.log("FLASHCARD SUMMARY ROWS TO INSERT", rows);

      // Fire-and-forget insert; log any errors to the console
      void supabase
        .from("learning_events")
        .insert(rows)
        .then(({ error }) => {
          if (error) {
            console.error("Error inserting flashcard_summary events", error);
          } else {
            console.log(
              "Inserted flashcard_summary events",
              rows.length,
              "rows"
            );
          }
        });
    };
  }, [blockId, pageId]);

  // Helper to render face content based on display mode
  const renderFaceContent = (
    card: FlashcardItem,
    face: "front" | "back"
  ): React.ReactNode => {
    const mode =
      face === "front"
        ? card.frontDisplayMode || "text"
        : card.backDisplayMode || "text";
    const html = face === "front" ? card.frontHtml || "" : card.backHtml || "";
    const image = face === "front" ? card.frontImage : card.backImage;

    // Centered image mode - IMAGE ONLY, no text
    if (mode === "centeredImage" && image) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <img
            src={image.url}
            alt={image.alt || ""}
            className="max-h-[70%] max-w-[80%] rounded-lg object-contain"
          />
        </div>
      );
    }

    // Full card image mode - full-bleed image, no text
    if (mode === "fullCardImage" && image) {
      return (
        <div className="h-full w-full overflow-hidden rounded-2xl">
          <img
            src={image.url}
            alt={image.alt || ""}
            className="h-full w-full object-cover"
          />
        </div>
      );
    }

    // Default: text mode
    return (
      <div
        className="prose max-w-none text-slate-900 text-center"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  // Determine grid columns based on preview width
  const gridColsClass =
    previewWidth === "mobile"
      ? "grid-cols-1"
      : previewWidth === "tablet"
      ? "grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={`grid gap-6 ${gridColsClass}`}>
      {effectiveCards.map((card) => {
        const flipped = !!flippedById[card.id];

        const innerBaseClasses =
          "relative h-full w-full rounded-2xl border shadow-sm transition-transform duration-500 [transform-style:preserve-3d]";
        const innerStateClasses = flipped
          ? "border-slate-200 bg-sky-50 [transform:rotateY(180deg)]"
          : "border-slate-200 bg-white";

        // Determine display modes
        const frontMode = card.frontDisplayMode || "text";
        const backMode = card.backDisplayMode || "text";
        const isFrontFullImage = frontMode === "fullCardImage";
        const isBackFullImage = backMode === "fullCardImage";

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => handleFlip(card)}
            className="relative w-full aspect-square outline-none ring-0 focus:outline-none focus:ring-0"
          >
            <div className="relative h-full w-full [perspective:1200px]">
              <div className={`${innerBaseClasses} ${innerStateClasses}`}>
                {/* FRONT */}
                <div
                  className={`absolute inset-0 flex flex-col [backface-visibility:hidden] ${
                    isFrontFullImage ? "p-0" : "p-4"
                  }`}
                >
                  {/* Flip icon - always visible, positioned absolutely for full image */}
                  <div
                    className={
                      isFrontFullImage
                        ? "absolute top-2 right-2 z-10"
                        : "flex justify-end mb-2"
                    }
                  >
                    <div
                      className={
                        isFrontFullImage
                          ? "bg-white/80 rounded-full p-1.5 shadow-sm"
                          : ""
                      }
                    >
                      <svg
                        className={`w-5 h-5 ${
                          isFrontFullImage ? "text-slate-600" : "text-slate-400"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </div>
                  </div>

                  <div
                    className={
                      isFrontFullImage
                        ? "h-full w-full"
                        : "flex-1 flex items-center justify-center"
                    }
                  >
                    {renderFaceContent(card, "front")}
                  </div>
                </div>

                {/* BACK */}
                <div
                  className={`absolute inset-0 flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    isBackFullImage ? "p-0" : "p-4"
                  }`}
                >
                  {/* Flip icon - always visible, positioned absolutely for full image */}
                  <div
                    className={
                      isBackFullImage
                        ? "absolute top-2 right-2 z-10"
                        : "flex justify-end mb-2"
                    }
                  >
                    <div
                      className={
                        isBackFullImage
                          ? "bg-white/80 rounded-full p-1.5 shadow-sm"
                          : ""
                      }
                    >
                      <svg
                        className={`w-5 h-5 ${
                          isBackFullImage ? "text-slate-600" : "text-slate-400"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </div>
                  </div>

                  <div
                    className={
                      isBackFullImage
                        ? "h-full w-full"
                        : "flex-1 flex items-center justify-center"
                    }
                  >
                    {renderFaceContent(card, "back")}
                  </div>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export const FlashcardsPreview = FlashcardsPreviewInternal;
