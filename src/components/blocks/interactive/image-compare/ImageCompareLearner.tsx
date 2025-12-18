import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { supabase } from "../../../../../lib/supabaseClient";
import type {
  ImageCompareContent,
  ImageCompareSettings,
  ImageCompareStyle,
} from "./image-compare-types";

export type ImageCompareLearnerProps = {
  blockId: string;
  content: ImageCompareContent;
  settings?: ImageCompareSettings;
  style?: ImageCompareStyle;
};

function clampPercent(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

type LearningEventRow = {
  user_id: string;
  module_id: string | null;
  page_id: string | null;
  block_id: string;
  event_type:
    | "image_compare_started"
    | "image_compare_interacted"
    | "image_compare_completed";
  event_time: string;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
};

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn("Could not fetch current user for learning_events", error);
    return null;
  }
  return data.user?.id ?? null;
}

type StyleTokens = {
  frame: string;
  placeholder: string;
  label: string;
  handleLine: string;
  handleKnob: string;
};

function getTokens(style: ImageCompareStyle | undefined): StyleTokens {
  const mode = style?.style ?? "light";
  if (mode === "dark") {
    return {
      frame: "border-slate-800 bg-slate-900",
      placeholder: "text-slate-200",
      label: "bg-black/50 text-white",
      handleLine: "bg-slate-700",
      handleKnob:
        "bg-white border border-gray-300 shadow-sm text-gray-500 hover:border-gray-400 active:scale-105 active:shadow-md transition-transform transition-shadow",
    };
  }
  return {
    frame: "border-gray-200 bg-white",
    placeholder: "text-gray-600",
    label: "bg-white/80 text-gray-900",
    handleLine: "bg-gray-300",
    handleKnob:
      "bg-white border border-gray-300 shadow-sm text-gray-500 hover:border-gray-400 active:scale-105 active:shadow-md transition-transform transition-shadow",
  };
}

export const ImageCompareLearner: React.FC<ImageCompareLearnerProps> = ({
  blockId,
  content,
  settings,
  style,
}) => {
  const tokens = useMemo(() => getTokens(style), [style]);
  const effectiveSettings: ImageCompareSettings = settings ?? content.settings;

  const hasBothImages = Boolean(content.topImageUrl) && Boolean(content.bottomImageUrl);

  const [percent, setPercent] = useState<number>(() =>
    clampPercent(content.initialPercent ?? 50)
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<boolean>(false);

  // Learning events (mirror other interactive blocks)
  const startedFiredRef = useRef<boolean>(false);
  const interactedFiredRef = useRef<boolean>(false);
  const completedFiredRef = useRef<boolean>(false);
  const initialPercentRef = useRef<number>(clampPercent(content.initialPercent ?? 50));
  const lastPercentRef = useRef<number>(clampPercent(content.initialPercent ?? 50));

  useEffect(() => {
    // Fire once on mount (only when the block is usable)
    if (!hasBothImages) return;
    if (startedFiredRef.current) return;
    startedFiredRef.current = true;

    const now = Date.now();
    const eventTimeIso = new Date(now).toISOString();

    void (async () => {
      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          console.warn(
            "No user_id available, skipping learning_events insert (image_compare_started)"
          );
          return;
        }

        const payload: LearningEventRow = {
          user_id: userId,
          module_id: null,
          page_id: null,
          block_id: blockId,
          event_type: "image_compare_started",
          event_time: eventTimeIso,
          duration_ms: null,
          metadata: {
            initial_percent: initialPercentRef.current,
          },
        };

        const { error } = await supabase.from("learning_events").insert(payload);
        if (error) {
          console.error(
            "LEARNING EVENT INSERT ERROR (image_compare_started)",
            error
          );
        }
      } catch (err) {
        console.error("Failed to save image_compare_started learning event:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, hasBothImages]);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const nextRaw = (x / rect.width) * 100;
    const nextPercent = clampPercent(nextRaw);

    // Track last known percent (for "moved" detection)
    const prevPercent = lastPercentRef.current;
    const moved = nextPercent !== prevPercent;
    lastPercentRef.current = nextPercent;

    // Fire "interacted" once on first actual movement
    if (moved && !interactedFiredRef.current) {
      interactedFiredRef.current = true;

      const now = Date.now();
      const eventTimeIso = new Date(now).toISOString();

      void (async () => {
        try {
          const userId = await getCurrentUserId();
          if (!userId) {
            console.warn(
              "No user_id available, skipping learning_events insert (image_compare_interacted)"
            );
            return;
          }

          const payload: LearningEventRow = {
            user_id: userId,
            module_id: null,
            page_id: null,
            block_id: blockId,
            event_type: "image_compare_interacted",
            event_time: eventTimeIso,
            duration_ms: null,
            metadata: {
              initial_percent: initialPercentRef.current,
              first_interaction_percent: nextPercent,
            },
          };

          const { error } = await supabase.from("learning_events").insert(payload);
          if (error) {
            console.error(
              "LEARNING EVENT INSERT ERROR (image_compare_interacted)",
              error
            );
          }
        } catch (err) {
          console.error(
            "Failed to save image_compare_interacted learning event:",
            err
          );
        }
      })();
    }

    // Fire "completed" once when crossing the threshold
    if (!completedFiredRef.current && (nextPercent <= 10 || nextPercent >= 90)) {
      completedFiredRef.current = true;

      const now = Date.now();
      const eventTimeIso = new Date(now).toISOString();

      void (async () => {
        try {
          const userId = await getCurrentUserId();
          if (!userId) {
            console.warn(
              "No user_id available, skipping learning_events insert (image_compare_completed)"
            );
            return;
          }

          const payload: LearningEventRow = {
            user_id: userId,
            module_id: null,
            page_id: null,
            block_id: blockId,
            event_type: "image_compare_completed",
            event_time: eventTimeIso,
            duration_ms: null,
            metadata: {
              completed_percent: nextPercent,
            },
          };

          const { error } = await supabase.from("learning_events").insert(payload);
          if (error) {
            console.error(
              "LEARNING EVENT INSERT ERROR (image_compare_completed)",
              error
            );
          }
        } catch (err) {
          console.error(
            "Failed to save image_compare_completed learning event:",
            err
          );
        }
      })();
    }

    setPercent(nextPercent);
  }, []);

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!hasBothImages) return;
    draggingRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };

  const endDrag: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore (can happen if capture was not set)
    }
  };

  if (!hasBothImages) {
    return (
      <div
        className={`w-full rounded-2xl border ${tokens.frame} p-6 text-sm ${tokens.placeholder}`}
      >
        Add both images to use Image Compare.
      </div>
    );
  }

  const topLabel = effectiveSettings.topLabel ?? "Before";
  const bottomLabel = effectiveSettings.bottomLabel ?? "After";

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        data-block-id={blockId}
        className={`relative w-full overflow-hidden rounded-2xl border ${tokens.frame} aspect-[16/9] select-none touch-none`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="group"
        aria-label="Image compare"
      >
        {/* Bottom image (Before) */}
        <img
          src={content.topImageUrl ?? ""}
          alt={content.topImageAlt ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {/* Top image (After) - clipped */}
        <div
          className="absolute inset-0"
          style={{
            // inset(top right bottom left) - clip the LEFT side so the "After" image shows on the right
            clipPath: `inset(0 0 0 ${percent}%)`,
          }}
          aria-hidden="true"
        >
          <img
            src={content.bottomImageUrl ?? ""}
            alt={content.bottomImageAlt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>

        {/* Labels */}
        {effectiveSettings.showLabels && (
          <>
            <div
              className={`absolute bottom-3 left-3 rounded-md px-2 py-1 text-[11px] font-medium ${tokens.label}`}
            >
              {topLabel}
            </div>
            <div
              className={`absolute bottom-3 right-3 rounded-md px-2 py-1 text-[11px] font-medium ${tokens.label}`}
            >
              {bottomLabel}
            </div>
          </>
        )}

        {/* Handle line */}
        <div
          className="absolute inset-y-0"
          style={{ left: `${percent}%`, transform: "translateX(-1px)" }}
          aria-hidden="true"
        >
          <div className={`h-full w-px ${tokens.handleLine}`} />
        </div>

        {/* Handle knob */}
        <div
          className="absolute inset-y-0 flex items-center"
          style={{ left: `${percent}%`, transform: "translateX(-50%)" }}
          aria-hidden="true"
        >
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center cursor-ew-resize ${tokens.handleKnob}`}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
};


