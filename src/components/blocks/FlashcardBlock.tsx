import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type FlashcardDisplayMode = "text" | "centeredImage" | "fullCardImage";

interface FlashcardImage {
  id: string;
  url: string;
  alt?: string;
}

type Flashcard = {
  id: string;
  frontHtml: string;
  backHtml: string;
  frontDisplayMode?: FlashcardDisplayMode;
  backDisplayMode?: FlashcardDisplayMode;
  frontImage?: FlashcardImage;
  backImage?: FlashcardImage;
};

interface FlashcardBlockProps {
  title?: string;
  cards?: Flashcard[];
  // IDs needed for event logging
  moduleId?: string | null;
  pageId?: string | null;
  blockId?: string | null;
}

/**
 * Logs a flashcard flip event to the learning_events table via Edge Function.
 * Fire-and-forget: errors are logged but never block the UI.
 */
async function logFlashcardEvent(params: {
  moduleId: string | null | undefined;
  pageId: string | null | undefined;
  blockId: string | null | undefined;
  cardId: string;
  side: "front" | "back";
  displayMode: FlashcardDisplayMode;
  durationMs: number | null;
}): Promise<void> {
  // Skip logging if we don't have the required IDs
  if (!params.moduleId || !params.pageId || !params.blockId) {
    console.warn("logFlashcardEvent: Missing required IDs, skipping log", {
      moduleId: params.moduleId,
      pageId: params.pageId,
      blockId: params.blockId,
    });
    return;
  }

  try {
    const { error } = await supabase.functions.invoke("log-flashcard-event", {
      body: {
        moduleId: params.moduleId,
        pageId: params.pageId,
        blockId: params.blockId,
        cardId: params.cardId,
        side: params.side,
        displayMode: params.displayMode,
        durationMs: params.durationMs,
      },
    });

    if (error) {
      console.error("Failed to log flashcard flip event:", error);
    }
  } catch (err) {
    console.error("Failed to log flashcard flip event:", err);
  }
}

const defaultCards: Flashcard[] = [
  {
    id: "card-1",
    frontHtml: "What does PPE stand for?",
    backHtml: "PPE stands for <strong>Personal Protective Equipment</strong>.",
  },
  {
    id: "card-2",
    frontHtml: "When should you report a safety hazard?",
    backHtml: "As soon as you notice it, <em>even if no one has been hurt</em>.",
  },
  {
    id: "card-3",
    frontHtml: "Why does MyLMS use Memory-Based Learning (MBL)?",
    backHtml:
      "To adapt training to each learner's behaviour, not to measure how 'smart' they are.",
  },
];

const FlashcardBlock: React.FC<FlashcardBlockProps> = ({
  title = "Check your understanding",
  cards,
  moduleId,
  pageId,
  blockId,
}) => {
  const effectiveCards = cards && cards.length > 0 ? cards : defaultCards;
  const [flippedById, setFlippedById] = useState<Record<string, boolean>>({});

  /**
   * Handles card flip: updates UI state and logs the event.
   */
  const handleFlip = (card: Flashcard) => {
    const nextSide = flippedById[card.id] ? "front" : "back";

    console.log("FLASHCARD FLIP EVENT", {
      cardId: card.id,
      flippedTo: nextSide,
      frontDisplayMode: card.frontDisplayMode,
      backDisplayMode: card.backDisplayMode,
      timestamp: new Date().toISOString(),
    });

    setFlippedById((prev) => ({
      ...prev,
      [card.id]: !prev[card.id],
    }));
  };

  // Helper to render face content based on display mode
  const renderFaceContent = (
    card: Flashcard,
    face: "front" | "back"
  ): React.ReactNode => {
    const mode =
      face === "front"
        ? card.frontDisplayMode || "text"
        : card.backDisplayMode || "text";
    const html =
      face === "front" ? card.frontHtml || "" : card.backHtml || "";
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
        className="prose max-w-none text-slate-900"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <section className="w-full max-w-[896px] mx-auto my-8">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">{title}</h2>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleFlip(card);
                }
              }}
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

                    <div className={isFrontFullImage ? "h-full w-full" : "flex-1 flex items-center justify-center"}>
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

                    <div className={isBackFullImage ? "h-full w-full" : "flex-1 flex items-center justify-center"}>
                      {renderFaceContent(card, "back")}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        Click each card to test your knowledge.
      </p>
    </section>
  );
};

export default FlashcardBlock;
