import React, { useEffect, useMemo, useRef, useState } from "react";
import RichTextViewer from "../../../RichTextViewer";
import type { TabsContent, TabsStyle } from "./tabs-types";
import { supabase } from "../../../../../lib/supabaseClient";

export type TabsLearnerProps = {
  content: TabsContent;
  blockId: string;
  moduleId: string;
  lessonId?: string;
};

type LearningEventRow = {
  user_id: string;
  module_id: string | null;
  page_id: string | null;
  block_id: string;
  event_type: "tabs_started" | "tabs_tab_viewed";
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

function clampIndex(idx: number, length: number): number {
  if (length <= 0) return 0;
  if (idx < 0) return 0;
  if (idx >= length) return length - 1;
  return idx;
}

function getStyleTokens(style: TabsStyle) {
  if (style === "dark") {
    return {
      card: "bg-slate-900 border-slate-800 text-slate-100",
      headerBg: "bg-slate-900",
      headerText: "text-slate-100",
      inactiveHeaderText: "text-slate-300",
      divider: "divide-slate-800 border-slate-800",
      activeAccentText: "text-orange-300",
      activeAccentBorder: "border-orange-300",
      panel: "text-slate-200",
      gradientLeft:
        "bg-gradient-to-r from-slate-900 to-transparent border-slate-800",
      gradientRight:
        "bg-gradient-to-l from-slate-900 to-transparent border-slate-800",
    } as const;
  }

  return {
    card: "bg-white border-gray-200 text-gray-900",
    headerBg: "bg-white",
    headerText: "text-gray-900",
    inactiveHeaderText: "text-gray-900",
    divider: "divide-gray-200 border-gray-200",
    activeAccentText: "text-orange-600",
    activeAccentBorder: "border-orange-500",
    panel: "text-gray-700",
    gradientLeft:
      "bg-gradient-to-r from-white to-transparent border-gray-200",
    gradientRight:
      "bg-gradient-to-l from-white to-transparent border-gray-200",
  } as const;
}

export const TabsLearner: React.FC<TabsLearnerProps> = ({
  content,
  blockId,
  moduleId,
  lessonId,
}) => {
  const tabs = useMemo(() => content.tabs ?? [], [content.tabs]);
  const allowKeyboardNav = content.settings?.allowKeyboardNav ?? true;
  const style: TabsStyle = content.settings?.style ?? "light";

  const tokens = useMemo(() => getStyleTokens(style), [style]);

  const [activeIndex, setActiveIndex] = useState<number>(() =>
    clampIndex(0, tabs.length)
  );

  // Keep activeIndex valid if tabs change
  useEffect(() => {
    setActiveIndex((prev) => clampIndex(prev, tabs.length));
  }, [tabs.length]);

  const activeTab = tabs[activeIndex] ?? null;

  // Tab button refs for roving focus
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Learning event tracking (mirror Accordion timing + sequencing patterns)
  const startedEventFiredRef = useRef<boolean>(false);
  const viewSequenceRef = useRef<number>(0);
  const lastAnySwitchAtMsRef = useRef<number | null>(null);
  const activeTabIdRef = useRef<string | null>(null);
  const activeTabBecameActiveAtMsRef = useRef<number | null>(null);
  const lastInteractionActionRef = useRef<"click" | "keyboard" | null>(null);
  const lastInteractionPendingRef = useRef<boolean>(false);

  // Keep refs in sync with the currently active tab, without emitting events.
  // We only emit when the active tab changes due to user interaction.
  useEffect(() => {
    const tabId = activeTab?.id ?? null;
    if (!tabId) return;
    if (activeTabIdRef.current == null) {
      activeTabIdRef.current = tabId;
      activeTabBecameActiveAtMsRef.current = Date.now();
    }
  }, [activeTab?.id]);

  // Fire once when learner first sees the block (tabs_started)
  useEffect(() => {
    if (!blockId || !moduleId) return;
    if (!tabs.length) return;
    if (startedEventFiredRef.current) return;
    startedEventFiredRef.current = true;

    const now = Date.now();
    const eventTimeIso = new Date(now).toISOString();

    void (async () => {
      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          console.warn(
            "No user_id available, skipping learning_events insert (tabs_started)"
          );
          return;
        }

        const payload: LearningEventRow = {
          user_id: userId,
          module_id: moduleId ?? null,
          page_id: lessonId ?? null,
          block_id: blockId,
          event_type: "tabs_started",
          event_time: eventTimeIso,
          duration_ms: null,
          metadata: {
            tab_count: tabs.length,
          },
        };

        const { error } = await supabase.from("learning_events").insert(payload);
        if (error) {
          console.error("LEARNING EVENT INSERT ERROR (tabs_started)", error);
        }
      } catch (err) {
        console.error("Failed to save tabs_started learning event:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, moduleId, lessonId, tabs.length]);

  // Emit tabs_tab_viewed only when switching due to user interaction
  useEffect(() => {
    if (!blockId || !moduleId) return;
    if (!tabs.length) return;
    if (!activeTab) return;
    if (!lastInteractionPendingRef.current) return;

    const now = Date.now();
    const eventTimeIso = new Date(now).toISOString();

    const previousTabId = activeTabIdRef.current;
    const prevActivatedAt = activeTabBecameActiveAtMsRef.current;
    const timeOnPreviousTabMs: number | null =
      typeof prevActivatedAt === "number" ? now - prevActivatedAt : null;

    const lastAnySwitchAt = lastAnySwitchAtMsRef.current;
    const timeSinceLastTabMs: number | null =
      typeof lastAnySwitchAt === "number" ? now - lastAnySwitchAt : null;

    viewSequenceRef.current += 1;
    const viewSequence = viewSequenceRef.current;

    // Update refs for next event
    lastAnySwitchAtMsRef.current = now;
    activeTabIdRef.current = activeTab.id;
    activeTabBecameActiveAtMsRef.current = now;

    const actionSource = lastInteractionActionRef.current ?? "click";

    // Reset pending flag so re-renders don't re-log
    lastInteractionPendingRef.current = false;
    lastInteractionActionRef.current = null;

    void (async () => {
      try {
        const userId = await getCurrentUserId();
        if (!userId) {
          console.warn(
            "No user_id available, skipping learning_events insert (tabs_tab_viewed)"
          );
          return;
        }

        const payload: LearningEventRow = {
          user_id: userId,
          module_id: moduleId ?? null,
          page_id: lessonId ?? null,
          block_id: blockId,
          event_type: "tabs_tab_viewed",
          event_time: eventTimeIso,
          duration_ms: timeOnPreviousTabMs,
          metadata: {
            action: "view",
            tab_id: activeTab.id,
            tab_index: activeIndex + 1, // 1-based
            previous_tab_id: previousTabId ?? null,
            time_on_previous_tab_ms: timeOnPreviousTabMs,
            time_since_last_tab_ms: timeSinceLastTabMs,
            view_sequence: viewSequence,
            source: actionSource,
          },
        };

        const { error } = await supabase.from("learning_events").insert(payload);
        if (error) {
          console.error(
            "LEARNING EVENT INSERT ERROR (tabs_tab_viewed)",
            error
          );
        }
      } catch (err) {
        console.error("Failed to save tabs_tab_viewed learning event:", err);
      }
    })();
  }, [activeIndex, activeTab, blockId, lessonId, moduleId, tabs.length]);

  const onTabKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (!allowKeyboardNav) return;
    if (tabs.length <= 1) return;

    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();

    const dir = e.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (activeIndex + dir + tabs.length) % tabs.length;
    lastInteractionActionRef.current = "keyboard";
    lastInteractionPendingRef.current = true;
    setActiveIndex(nextIndex);

    // Move focus to the newly active tab button
    window.requestAnimationFrame(() => {
      tabButtonRefs.current[nextIndex]?.focus();
    });
  };

  if (!tabs.length) {
    return (
      <div
        className={`w-full rounded-2xl border shadow-sm p-6 ${tokens.card}`}
      >
        <div className="text-sm text-gray-500">No tabs configured.</div>
      </div>
    );
  }

  const activeButtonId = `tabs-${blockId}-tab-${activeIndex}`;
  const activePanelId = `tabs-${blockId}-panel-${activeIndex}`;

  return (
    <div className="w-full">
      <div
        className={`relative w-full rounded-2xl border shadow-sm ${tokens.card}`}
      >
        {/* Tab headers (scrollable on small screens) */}
        <div className="relative">
          <div
            className="overflow-x-auto no-scrollbar"
            onKeyDown={onTabKeyDown}
            role="tablist"
            aria-label="Tabs"
          >
            <div
              className={`flex min-w-max ${tokens.headerBg} ${tokens.divider} divide-x`}
            >
              {tabs.map((t, idx) => {
                const isActive = idx === activeIndex;
                const base =
                  "relative flex-1 min-w-[180px] sm:min-w-0 px-5 py-4 text-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2";

                return (
                  <button
                    key={t.id}
                    id={`tabs-${blockId}-tab-${idx}`}
                    ref={(el) => {
                      tabButtonRefs.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`tabs-${blockId}-panel-${idx}`}
                    tabIndex={isActive ? 0 : -1}
                    className={`${base} ${
                      isActive ? tokens.activeAccentText : tokens.inactiveHeaderText
                    }`}
                    onClick={() => {
                      if (idx === activeIndex) return;
                      lastInteractionActionRef.current = "click";
                      lastInteractionPendingRef.current = true;
                      setActiveIndex(idx);
                    }}
                  >
                    <span className="block text-[11px] sm:text-xs font-semibold tracking-[0.18em] uppercase">
                      {t.title || "Untitled"}
                    </span>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-0 bottom-0 h-0.5 ${tokens.activeAccentBorder} border-b-2`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Edge fades (mobile hint that row scrolls) */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6">
            <div className={`h-full w-full ${tokens.gradientLeft}`} />
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6">
            <div className={`h-full w-full ${tokens.gradientRight}`} />
          </div>
        </div>

        <div className={`border-t ${tokens.divider}`} />

        {/* Active panel */}
        <div
          id={activePanelId}
          role="tabpanel"
          aria-labelledby={activeButtonId}
          className="px-5 py-5 sm:px-6 sm:py-6"
        >
          <div className="transition-all duration-200 ease-out">
            <div className={tokens.panel}>
              <RichTextViewer html={activeTab?.content ?? ""} />
            </div>

            {activeTab?.image?.url ? (
              <img
                src={activeTab.image.url}
                alt={activeTab.image.alt ?? ""}
                className="mt-4 w-full max-w-full rounded-xl border border-gray-200 object-cover"
                loading="lazy"
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* local CSS for scrollbar hiding without adding deps */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};


