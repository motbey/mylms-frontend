import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import TipTapEditor from "../../../editor/TipTapEditor";
import type { TabsContent, TabsStyle, TabsTab } from "./tabs-types";
import { ImageUploadAndLibrary } from "../../../media";
import type { MediaAsset } from "../../../media";

export type TabsEditorProps = {
  blockId: string;
  content: TabsContent;
  onChange: (updatedContent: TabsContent) => void;
};

function generateStableId(prefix: string): string {
  const cryptoObj: Crypto | undefined =
    typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoObj && "randomUUID" in cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return `${prefix}-${cryptoObj.randomUUID()}`;
  }

  // Fallback: stable-ish, low collision in practice for authoring UI
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}-${Date.now()}-${rand}`;
}

function makeDefaultTab(indexOneBased: number): TabsTab {
  return {
    id: generateStableId("tab"),
    title: `Tab ${indexOneBased}`,
    content: "<p>Start writing your tab content...</p>",
    image: null,
  };
}

function normalizeTabs(tabs: TabsTab[]): TabsTab[] {
  return tabs.map((t, idx) => ({
    id: t.id?.trim() ? t.id : generateStableId(`tab-${idx + 1}`),
    title: t.title ?? "",
    content: t.content ?? "",
    image: t.image ?? null,
  }));
}

function clampIndex(idx: number, length: number): number {
  if (length <= 0) return 0;
  if (idx < 0) return 0;
  if (idx >= length) return length - 1;
  return idx;
}

export const TabsEditor: React.FC<TabsEditorProps> = ({
  blockId,
  content,
  onChange,
}) => {
  const tabs = useMemo(() => normalizeTabs(content.tabs ?? []), [content.tabs]);
  const settings = content.settings ?? {};
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    clampIndex(0, tabs.length)
  );
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [mediaPickerTabId, setMediaPickerTabId] = useState<string | null>(null);

  useEffect(() => {
    setActiveIndex((prev) => clampIndex(prev, tabs.length));
  }, [tabs.length]);

  // Initialize defaults when empty (V1 authoring convenience)
  const initializedRef = useRef<boolean>(false);
  useEffect(() => {
    if (initializedRef.current) return;
    if ((content.tabs ?? []).length > 0) return;
    initializedRef.current = true;

    onChange({
      ...content,
      tabs: [makeDefaultTab(1), makeDefaultTab(2), makeDefaultTab(3)],
      settings: {
        style: settings.style ?? "light",
        allowKeyboardNav: settings.allowKeyboardNav ?? true,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  const updateTab = (tabId: string, patch: Partial<TabsTab>) => {
    const nextTabs = tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t));
    onChange({
      ...content,
      tabs: nextTabs,
    });
  };

  const moveTab = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= tabs.length) return;
    if (fromIndex === toIndex) return;
    const next = [...tabs];
    const [picked] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, picked);
    onChange({
      ...content,
      tabs: next,
    });
    // Keep the same tab selected after reorder
    const movedTabId = picked.id;
    const nextActiveIndex = next.findIndex((t) => t.id === movedTabId);
    if (nextActiveIndex >= 0) setActiveIndex(nextActiveIndex);
  };

  const removeTab = (tabId: string) => {
    const next = tabs.filter((t) => t.id !== tabId);
    onChange({
      ...content,
      tabs: next,
    });
    setActiveIndex((prev) => clampIndex(prev, next.length));
  };

  const addTab = () => {
    const nextTab = makeDefaultTab(tabs.length + 1);
    const nextTabs = [...tabs, nextTab];
    onChange({
      ...content,
      tabs: nextTabs,
    });
    setActiveIndex(nextTabs.length - 1);
  };

  const updateSettings = (patch: Partial<{ style: TabsStyle; allowKeyboardNav: boolean }>) => {
    onChange({
      ...content,
      settings: {
        style: (settings.style ?? "light") as TabsStyle,
        allowKeyboardNav: settings.allowKeyboardNav ?? true,
        ...patch,
      },
    });
  };

  const activeTab = tabs[activeIndex] ?? null;
  const canMoveUp = activeIndex > 0;
  const canMoveDown = activeIndex < tabs.length - 1;

  const handleSelectAsset = (asset: MediaAsset) => {
    if (!mediaPickerTabId) return;
    updateTab(mediaPickerTabId, {
      image: {
        mediaId: asset.id,
        url: asset.public_url ?? null,
        alt: asset.alt_text ?? asset.title ?? "",
      },
    });
    setIsMediaLibraryOpen(false);
    setMediaPickerTabId(null);
  };

  return (
    <div className="space-y-6">
      {/* Rise-like tab header preview + selector */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex min-w-max divide-x divide-gray-200">
            {tabs.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-500">No tabs yet.</div>
            ) : (
              tabs.map((t, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`relative flex-1 min-w-[180px] sm:min-w-0 px-5 py-4 text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                      isActive ? "text-orange-600" : "text-gray-900"
                    }`}
                  >
                    <span className="block text-[11px] sm:text-xs font-semibold tracking-[0.18em] uppercase">
                      {t.title || `Tab ${idx + 1}`}
                    </span>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-0.5 border-b-2 border-orange-500"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Tabs</div>
            <div className="text-xs text-gray-500">
              Add, reorder, and edit the content for each tab.
            </div>
          </div>
          <button
            type="button"
            onClick={addTab}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add tab
          </button>
        </div>

        {tabs.length === 0 || !activeTab ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            No tabs yet. Click <span className="font-medium">Add tab</span> to
            create one.
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-gray-700">
                  Tab title
                  <input
                    type="text"
                    value={activeTab.title}
                    onChange={(e) =>
                      updateTab(activeTab.id, { title: e.target.value })
                    }
                    placeholder={`Tab ${activeIndex + 1}`}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => moveTab(activeIndex, activeIndex - 1)}
                  disabled={!canMoveUp}
                  className={`inline-flex items-center justify-center rounded-lg border px-2 py-2 text-sm ${
                    canMoveUp
                      ? "border-gray-200 text-gray-700 hover:bg-gray-50"
                      : "border-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
                  aria-label="Move tab up"
                  title="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => moveTab(activeIndex, activeIndex + 1)}
                  disabled={!canMoveDown}
                  className={`inline-flex items-center justify-center rounded-lg border px-2 py-2 text-sm ${
                    canMoveDown
                      ? "border-gray-200 text-gray-700 hover:bg-gray-50"
                      : "border-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
                  aria-label="Move tab down"
                  title="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => removeTab(activeTab.id)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-2 py-2 text-sm text-red-600 hover:bg-red-50"
                  aria-label="Remove tab"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tab image */}
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-gray-700">
                Tab image
              </div>

              {!activeTab.image?.url ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3">
                  <div className="text-sm text-gray-500">
                    No image selected
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPickerTabId(activeTab.id);
                      setIsMediaLibraryOpen(true);
                    }}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-orange-400 hover:text-[#ff7a00] transition-colors"
                  >
                    Choose image
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={activeTab.image.url ?? ""}
                        alt={activeTab.image.alt ?? ""}
                        className="h-12 w-12 rounded-lg object-cover border border-gray-200"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">
                          Image selected
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {activeTab.image.mediaId ?? ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setMediaPickerTabId(activeTab.id);
                          setIsMediaLibraryOpen(true);
                        }}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-orange-400 hover:text-[#ff7a00] transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTab(activeTab.id, { image: null })}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Alt text (optional but useful) */}
                  <label className="block text-xs font-medium text-gray-700">
                    Alt text
                    <input
                      type="text"
                      value={activeTab.image.alt ?? ""}
                      onChange={(e) =>
                        updateTab(activeTab.id, {
                          image: {
                            mediaId: activeTab.image?.mediaId ?? null,
                            url: activeTab.image?.url ?? null,
                            alt: e.target.value,
                          },
                        })
                      }
                      placeholder="Describe the image for accessibility..."
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-gray-700">
                Tab content
              </div>
              <TipTapEditor
                key={activeTab.id}
                value={activeTab.content}
                onChange={(html) => updateTab(activeTab.id, { content: html })}
                placeholder="Start writing your tab content..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-gray-900">Settings</div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-700">
            Style
            <select
              value={(settings.style ?? "light") as TabsStyle}
              onChange={(e) =>
                updateSettings({ style: e.target.value as TabsStyle })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
            <div>
              <div className="text-xs font-medium text-gray-700">
                Keyboard navigation
              </div>
              <div className="text-xs text-gray-500">
                Allow left/right arrow keys to switch tabs
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.allowKeyboardNav ?? true}
              onChange={(e) =>
                updateSettings({ allowKeyboardNav: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              aria-label="Allow keyboard navigation"
            />
          </label>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Media Library Modal */}
      {isMediaLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsMediaLibraryOpen(false);
              setMediaPickerTabId(null);
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
                  setMediaPickerTabId(null);
                }}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                aria-label="Close"
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


