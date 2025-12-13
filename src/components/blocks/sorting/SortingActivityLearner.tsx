// src/components/blocks/sorting/SortingActivityLearner.tsx
// Learner-facing component for the Rise-style Sorting Activity block

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { GripVertical, Check, X, RotateCcw } from "lucide-react";
import { supabase } from "../../../../lib/supabaseClient";

import type { SortingActivityContent, SortingItem } from "./sorting-types";

/**
 * Logs a sorting activity event via Edge Function (same pattern as flashcards).
 * Fire-and-forget: errors are logged but never block the UI.
 */
async function logSortingEvent(body: any) {
  try {
    const { data, error } = await supabase.functions.invoke(
      "log-sorting-activity-event",
      {
        body,
      }
    );
    if (error) console.error("log-sorting-activity-event error", error);
    return data;
  } catch (err) {
    console.error("log-sorting-activity-event unexpected error", err);
    return null;
  }
}

interface SortingActivityLearnerProps {
  moduleId?: string | null;
  pageId?: string | null;
  blockId?: string | null;
  content: SortingActivityContent;
  onComplete?: (summary: {
    total: number;
    correct: number;
    items: {
      id: string;
      isCorrect: boolean;
      selectedCategoryId: string;
      correctCategoryId: string;
    }[];
  }) => void;
  mode?: "learner" | "builder";
}

interface AnswerState {
  itemId: string;
  selectedCategoryId: string;
  correctCategoryId: string;
  isCorrect: boolean;
}

export const SortingActivityLearner: React.FC<SortingActivityLearnerProps> = ({
  moduleId,
  pageId,
  blockId,
  content,
  onComplete,
  mode = "learner",
}) => {
  const isBuilderMode = mode === "builder";
  const { categories, items, settings } = content;

  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<AnswerState | null>(null);
  const [shakingItemId, setShakingItemId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [itemOrder, setItemOrder] = useState<string[]>([]);
  const [justCorrectId, setJustCorrectId] = useState<string | null>(null);
  const [placedCorrect, setPlacedCorrect] = useState<{
    itemId: string;
    categoryId: string;
    text: string;
  } | null>(null);
  const [placedWrong, setPlacedWrong] = useState<{
    itemId: string;
    categoryId: string;
    text: string;
  } | null>(null);

  // Attempt/timing refs (do not trigger re-renders)
  const startedAtMsRef = useRef<number | null>(null);
  const lastAnyAttemptAtMsRef = useRef<number | null>(null);
  const attemptSeqRef = useRef<number>(0);
  const perItemLastAttemptAtMsRef = useRef<Record<string, number>>({});
  const perItemLastCorrectAtMsRef = useRef<Record<string, number>>({});
  const dragStartAtMsRef = useRef<number | null>(null);
  const totalAttemptsRef = useRef<number>(0);
  const replayCountRef = useRef<number>(0);
  const lastCompletedAtMsRef = useRef<number | null>(null);
  const runIdRef = useRef<string>(crypto.randomUUID());

  // Normalize items to ensure ids/correctCategoryId exist for older content
  const normalizedItems: SortingItem[] = useMemo(() => {
    const fallbackCategory = categories[0]?.id ?? "category-1";
    return items.map((item, idx) => ({
      ...item,
      id: item.id || `item-${idx}`,
      correctCategoryId: item.correctCategoryId || fallbackCategory,
    }));
  }, [items, categories]);

  const placedCorrectItem = useMemo(() => {
    if (!placedCorrect) return null;
    return normalizedItems.find((i) => i.id === placedCorrect.itemId) ?? null;
  }, [placedCorrect, normalizedItems]);

  const placedWrongItem = useMemo(() => {
    if (!placedWrong) return null;
    return normalizedItems.find((i) => i.id === placedWrong.itemId) ?? null;
  }, [placedWrong, normalizedItems]);

  // Reset activity (optionally randomised)
  const resetActivity = () => {
    const baseOrder = normalizedItems.map((i) => i.id);
    const shuffled =
      settings?.randomizeOrder && normalizedItems.length > 1
        ? [...baseOrder].sort(() => Math.random() - 0.5)
        : baseOrder;
    setItemOrder(shuffled);
    setAnswers([]);
    setLastAnswer(null);
    setShakingItemId(null);
    setIsLocked(false);
    setJustCorrectId(null);
    setPlacedCorrect(null);
    setPlacedWrong(null);
  };

  const handleReplay = () => {
    if (isBuilderMode) {
      resetActivity();
      return;
    }

    const now = Date.now();
    replayCountRef.current += 1;

    const time_since_started_ms =
      startedAtMsRef.current != null ? now - startedAtMsRef.current : null;

    const time_since_completed_ms =
      lastCompletedAtMsRef.current != null
        ? now - lastCompletedAtMsRef.current
        : null;

    const last_accuracy_percent =
      answers.length > 0
        ? Math.round(
            (answers.filter((a) => a.isCorrect).length / answers.length) * 100
          )
        : null;

    if (moduleId && pageId && blockId) {
      void logSortingEvent({
        moduleId,
        pageId,
        blockId,
        eventType: "sorting_activity_replayed",
        extra: {
          run_id: runIdRef.current,
          replay_count: replayCountRef.current,
          time_since_started_ms,
          time_since_completed_ms,
          last_total_attempts: totalAttemptsRef.current,
          last_accuracy_percent,
        },
      });
    } else {
      console.warn("Skipping sorting replay event log: missing IDs", {
        moduleId,
        pageId,
        blockId,
      });
    }

    // New run id for the next run (after we log replay with the old run id)
    runIdRef.current = crypto.randomUUID();

    // Reset “run” timing for the new attempt
    startedAtMsRef.current = Date.now();
    lastAnyAttemptAtMsRef.current = null;
    attemptSeqRef.current = 0;
    totalAttemptsRef.current = 0;
    perItemLastAttemptAtMsRef.current = {};
    perItemLastCorrectAtMsRef.current = {};
    dragStartAtMsRef.current = null;

    resetActivity();
  };

  // Build initial order on mount / content change
  useEffect(() => {
    resetActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedItems, settings?.randomizeOrder]);

  const answeredIds = useMemo(
    () => new Set(answers.map((a) => a.itemId)),
    [answers]
  );

  const remainingItems: SortingItem[] = useMemo(() => {
    const remainingIds = itemOrder.filter((id) => !answeredIds.has(id));
    const map = new Map(normalizedItems.map((i) => [i.id, i]));
    const itemsList = remainingIds
      .map((id) => map.get(id))
      .filter(Boolean) as SortingItem[];
    if (placedCorrect) {
      return itemsList.filter((i) => i.id !== placedCorrect.itemId);
    }
    if (placedWrong) {
      return itemsList.filter((i) => i.id !== placedWrong.itemId);
    }
    return itemsList;
  }, [itemOrder, answeredIds, normalizedItems, placedCorrect, placedWrong]);

  const currentItem = remainingItems[0] ?? null;
  const totalItems = normalizedItems.length;
  const isComplete = answers.length === totalItems;
  const correctCount = useMemo(
    () => answers.filter((a) => a.isCorrect).length,
    [answers]
  );

  // Randomize items on initial load if setting is enabled
  const randomisedRemaining = useMemo(() => {
    if (!settings?.randomizeOrder) return remainingItems;
    // Only randomize once at the start, not on every re-render
    return [...remainingItems].sort(() => Math.random() - 0.5);
  }, [
    remainingItems.length === items.length ? "initial" : "subsequent",
    settings?.randomizeOrder,
  ]);

  const handleDragEnd = async (result: DropResult) => {
    if (isBuilderMode) return;
    const { destination, draggableId } = result;
    if (!destination) {
      dragStartAtMsRef.current = null;
      return;
    }
    if (!currentItem || draggableId !== currentItem.id || isLocked) return;

    const destId = destination.droppableId;
    if (destId === "item-home") {
      // Dropped back to home; nothing to do
      dragStartAtMsRef.current = null;
      return;
    }

    if (!destId.startsWith("category-")) {
      dragStartAtMsRef.current = null;
      return;
    }

    const categoryId = destId.replace("category-", "");
    const item = currentItem;

    const isCorrect = item.correctCategoryId === categoryId;

    // Always increment attempt counters + update timing refs for every category drop
    const now = Date.now();

    attemptSeqRef.current += 1;
    totalAttemptsRef.current += 1;

    const time_since_any_attempt_ms =
      lastAnyAttemptAtMsRef.current != null
        ? now - lastAnyAttemptAtMsRef.current
        : null;

    const lastAttemptForItem = perItemLastAttemptAtMsRef.current[item.id];
    const time_since_last_attempt_for_item_ms =
      typeof lastAttemptForItem === "number" ? now - lastAttemptForItem : null;

    const lastCorrectForItem = perItemLastCorrectAtMsRef.current[item.id];
    const time_since_last_correct_for_item_ms =
      typeof lastCorrectForItem === "number" ? now - lastCorrectForItem : null;

    const drag_duration_ms =
      dragStartAtMsRef.current != null ? now - dragStartAtMsRef.current : null;

    // Update refs (attempt always; correct only when correct)
    lastAnyAttemptAtMsRef.current = now;
    perItemLastAttemptAtMsRef.current[item.id] = now;
    if (isCorrect) {
      perItemLastCorrectAtMsRef.current[item.id] = now;
    }
    dragStartAtMsRef.current = null;

    // Log per-item attempt via Edge Function (fire-and-forget)
    if (moduleId && pageId && blockId) {
      void logSortingEvent({
        moduleId,
        pageId,
        blockId,
        eventType: "sorting_activity_item_answered",
        itemId: item.id,
        itemText: item.text ?? null,
        selectedCategoryId: categoryId,
        correctCategoryId: item.correctCategoryId,
        isCorrect,
        position: answers.length + 1,
        totalItems,
        attempt_sequence: attemptSeqRef.current,
        time_since_any_attempt_ms,
        time_since_last_attempt_for_item_ms,
        time_since_last_correct_for_item_ms,
        drag_duration_ms,
        extra: {
          run_id: runIdRef.current,
        },
      });
    } else {
      console.warn("Skipping sorting activity event log: missing IDs", {
        moduleId,
        pageId,
        blockId,
      });
    }

    if (!isCorrect) {
      setIsLocked(true);
      setPlacedWrong({
        itemId: item.id,
        categoryId,
        text: item.text,
      });
      setShakingItemId(item.id);
      setTimeout(() => {
        setShakingItemId(null);
        setPlacedWrong(null);
        setIsLocked(false);
      }, 450);
      return;
    }

    const newAnswer: AnswerState = {
      itemId: item.id,
      selectedCategoryId: categoryId,
      correctCategoryId: item.correctCategoryId,
      isCorrect,
    };

    // Briefly place the card in the target, then advance
    setIsLocked(true);
    setPlacedCorrect({
      itemId: item.id,
      categoryId,
      text: item.text,
    });
    setJustCorrectId(item.id);

    setTimeout(() => {
      setPlacedCorrect(null);
      setJustCorrectId(null);
      setIsLocked(false);

      setAnswers((prev) => [...prev, newAnswer]);
      setLastAnswer(newAnswer);

      if (answers.length + 1 === totalItems) {
        const summary = {
          total: totalItems,
          correct:
            answers.filter((a) => a.isCorrect).length + (isCorrect ? 1 : 0),
          items: [...answers, newAnswer],
        };

        setShowCompletion(true);

        // Completion event via Edge Function
        if (moduleId && pageId && blockId) {
          const now = Date.now();
          lastCompletedAtMsRef.current = now;
          const time_to_complete_ms =
            startedAtMsRef.current != null
              ? now - startedAtMsRef.current
              : null;
          const total_attempts = totalAttemptsRef.current;
          const accuracyPercent =
            summary.total > 0
              ? Math.round((summary.correct / summary.total) * 100)
              : 0;

          void logSortingEvent({
            moduleId,
            pageId,
            blockId,
            eventType: "sorting_activity_completed",
            totalItems: summary.total,
            correctItems: summary.correct,
            accuracyPercent,
            total_attempts,
            time_to_complete_ms,
            items: summary.items,
            extra: {
              run_id: runIdRef.current,
            },
          });
        }

        if (onComplete) {
          onComplete(summary);
        }
      }
    }, 600);
  };

  // Log activity started on mount
  useEffect(() => {
    if (!moduleId || !pageId || !blockId) return;
    if (items.length <= 0) return;
    if (categories.length <= 0) return;

    // Reset attempt/timing refs for this run
    startedAtMsRef.current = Date.now();
    lastAnyAttemptAtMsRef.current = null;
    attemptSeqRef.current = 0;
    perItemLastAttemptAtMsRef.current = {};
    perItemLastCorrectAtMsRef.current = {};
    dragStartAtMsRef.current = null;
    totalAttemptsRef.current = 0;

    // Started event
    void logSortingEvent({
      moduleId,
      pageId,
      blockId,
      eventType: "sorting_activity_started",
      totalItems: items.length,
      totalCategories: categories.length,
      categoryLabels: categories.map((c) => c.label),
      itemIds: normalizedItems.map((i, idx) => i.id ?? `item-${idx}`),
      attempt_sequence: 1,
      started_at_client_iso: new Date().toISOString(),
      extra: {
        run_id: runIdRef.current,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, pageId, blockId, items.length, categories.length]);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <style>{`
        @keyframes riseShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .rise-shake { animation: riseShake 0.4s ease-in-out; }
      `}</style>
      {/* Header removed for Rise-style (no title, instructions, or progress line) */}

      <DragDropContext
        onDragStart={() => {
          dragStartAtMsRef.current = Date.now();
        }}
        onDragEnd={handleDragEnd}
      >
        {/* Top card area – current item (home droppable). Hide when complete. */}
        {!isComplete && (
          <Droppable
            droppableId="item-home"
            direction="horizontal"
            isDropDisabled={isBuilderMode}
          >
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="mb-8 flex justify-center items-center"
              >
                {currentItem &&
                !(placedCorrect && placedCorrect.itemId === currentItem.id) &&
                !(placedWrong && placedWrong.itemId === currentItem.id) ? (
                  <Draggable
                    draggableId={currentItem.id}
                    index={0}
                    isDragDisabled={!!shakingItemId || isBuilderMode}
                  >
                    {(provided, snapshot) => (
                      <div className="w-full md:w-1/2 flex justify-center mx-auto">
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`relative aspect-square w-full max-w-[320px] bg-white rounded-lg border border-slate-200 shadow-md flex flex-col items-center justify-center text-center cursor-grab active:cursor-grabbing transition-transform ${
                            snapshot.isDragging ? "shadow-xl scale-[1.05]" : ""
                          } ${
                            shakingItemId === currentItem.id ? "rise-shake" : ""
                          }`}
                        >
                          {/* Top accent bar */}
                          <div className="absolute inset-x-0 top-0 h-1.5 bg-orange-500 rounded-t-lg z-20" />
                          {currentItem.imageUrl ? (
                            <img
                              src={currentItem.imageUrl}
                              alt={currentItem.altText ?? currentItem.text}
                              className="absolute inset-0 h-full w-full object-cover rounded-lg z-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-center px-3 pt-3">
                              <div className="text-sm md:text-base font-medium text-slate-800 break-words">
                                {currentItem.text}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ) : null}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        )}

        {/* Category drop zones (targets only) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center">
          {categories.map((category) => {
            return (
              <Droppable
                key={category.id}
                droppableId={`category-${category.id}`}
                isDropDisabled={isBuilderMode}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`aspect-square w-full max-w-[320px] rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3 flex flex-col transition-all ${
                      snapshot.isDraggingOver
                        ? "bg-sky-50 border-sky-400 shadow-sm"
                        : ""
                    }`}
                  >
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                      {placedCorrect?.categoryId === category.id ? (
                        <div className="relative w-full max-w-[320px] aspect-square bg-white rounded-lg border border-slate-200 shadow-md flex flex-col items-center justify-center text-center mx-auto px-3 py-3">
                          <div className="absolute -top-3 -left-3 h-10 w-10 rounded-full bg-orange-500 text-white shadow flex items-center justify-center z-30">
                            <Check className="h-5 w-5" />
                          </div>
                          {placedCorrectItem?.imageUrl ? (
                            <img
                              src={placedCorrectItem.imageUrl}
                              alt={
                                placedCorrectItem.altText ?? placedCorrect.text
                              }
                              className="absolute inset-0 h-full w-full object-cover rounded-lg z-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="text-sm md:text-base font-medium text-slate-800 break-words">
                              {placedCorrect.text}
                            </div>
                          )}
                        </div>
                      ) : placedWrong?.categoryId === category.id ? (
                        <div
                          className={`relative w-full max-w-[320px] aspect-square bg-white rounded-lg border border-slate-200 shadow-md flex flex-col items-center justify-center text-center mx-auto px-3 py-3 ${
                            shakingItemId === placedWrong.itemId
                              ? "rise-shake"
                              : ""
                          }`}
                        >
                          <div className="absolute -top-3 -left-3 h-10 w-10 rounded-full bg-red-500 text-white shadow flex items-center justify-center z-30">
                            <X className="h-5 w-5" />
                          </div>
                          {placedWrongItem?.imageUrl ? (
                            <img
                              src={placedWrongItem.imageUrl}
                              alt={placedWrongItem.altText ?? placedWrong.text}
                              className="absolute inset-0 h-full w-full object-cover rounded-lg z-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="text-sm md:text-base font-medium text-slate-800 break-words">
                              {placedWrong.text}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="text-sm font-semibold text-slate-800">
                            {category.label}
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Drag the card here
                          </div>
                        </div>
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* Completion header (Rise-style) */}
      {isComplete && (
        <div className="text-center mt-6 mb-10">
          <div className="text-lg font-semibold tracking-tight text-slate-900">
            {correctCount}/{totalItems} Cards Correct
          </div>
          <div className="mt-6 text-sm font-semibold tracking-widest text-slate-600">
            REPLAY
          </div>
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={handleReplay}
              className="h-12 w-12 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center shadow-sm transition"
              aria-label="Replay"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SortingActivityLearner;
