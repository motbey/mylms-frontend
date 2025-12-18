import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ImageUploadAndLibrary } from "../../../media";
import type { MediaAsset } from "../../../media";
import type {
  ImageCompareContent,
  ImageCompareSettings,
  ImageCompareStyle,
} from "./image-compare-types";

export type ImageCompareEditorProps = {
  blockId: string;
  content: ImageCompareContent;
  settings?: ImageCompareSettings;
  style?: ImageCompareStyle;
  onChange: (content: ImageCompareContent) => void;
};

type ImageTarget = "top" | "bottom";

function clampPercent(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export const ImageCompareEditor: React.FC<ImageCompareEditorProps> = ({
  blockId,
  content,
  settings,
  onChange,
}) => {
  const effectiveSettings: ImageCompareSettings = useMemo(() => {
    // `content.settings` exists in our current type, but allow an override prop for future flexibility
    return settings ?? content.settings;
  }, [content.settings, settings]);

  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<ImageTarget | null>(null);

  const openPicker = (target: ImageTarget) => {
    setMediaTarget(target);
    setIsMediaLibraryOpen(true);
  };

  const closePicker = () => {
    setIsMediaLibraryOpen(false);
    setMediaTarget(null);
  };

  const handleSelectAsset = (asset: MediaAsset) => {
    if (!mediaTarget) return;
    const url = asset.public_url ?? null;
    const alt = asset.alt_text ?? asset.title ?? "";

    if (mediaTarget === "top") {
      onChange({
        ...content,
        topImageUrl: url,
        topImageAlt: alt,
      });
    } else {
      onChange({
        ...content,
        bottomImageUrl: url,
        bottomImageAlt: alt,
      });
    }

    closePicker();
  };

  const removeImage = (target: ImageTarget) => {
    if (target === "top") {
      onChange({
        ...content,
        topImageUrl: null,
        topImageAlt: null,
      });
    } else {
      onChange({
        ...content,
        bottomImageUrl: null,
        bottomImageAlt: null,
      });
    }
  };

  const updateSettings = (patch: Partial<ImageCompareSettings>) => {
    onChange({
      ...content,
      settings: {
        ...effectiveSettings,
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Images */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <div className="text-sm font-semibold text-gray-900">Images</div>
          <div className="mt-0.5 text-xs text-gray-500">
            Choose a top (Before) image and bottom (After) image.
          </div>
        </div>

        <div className="space-y-4">
          {/* Top image */}
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="mb-2 text-xs font-medium text-gray-700">
              Top image (Before)
            </div>
            {!content.topImageUrl ? (
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-500">No image selected</div>
                <button
                  type="button"
                  onClick={() => openPicker("top")}
                  className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-orange-400 hover:text-[#ff7a00] transition-colors"
                >
                  Choose image
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={content.topImageUrl}
                      alt={content.topImageAlt ?? ""}
                      className="h-12 w-12 rounded-lg object-cover border border-gray-200"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        Image selected
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {content.topImageUrl}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openPicker("top")}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-orange-400 hover:text-[#ff7a00] transition-colors"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage("top")}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <label className="block text-xs font-medium text-gray-700">
                  Alt text
                  <input
                    type="text"
                    value={content.topImageAlt ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...content,
                        topImageAlt: e.target.value,
                      })
                    }
                    placeholder="Describe the image for accessibility..."
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Bottom image */}
          <div className="rounded-xl border border-gray-200 p-3">
            <div className="mb-2 text-xs font-medium text-gray-700">
              Bottom image (After)
            </div>
            {!content.bottomImageUrl ? (
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-500">No image selected</div>
                <button
                  type="button"
                  onClick={() => openPicker("bottom")}
                  className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-orange-400 hover:text-[#ff7a00] transition-colors"
                >
                  Choose image
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={content.bottomImageUrl}
                      alt={content.bottomImageAlt ?? ""}
                      className="h-12 w-12 rounded-lg object-cover border border-gray-200"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        Image selected
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {content.bottomImageUrl}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openPicker("bottom")}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-orange-400 hover:text-[#ff7a00] transition-colors"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage("bottom")}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <label className="block text-xs font-medium text-gray-700">
                  Alt text
                  <input
                    type="text"
                    value={content.bottomImageAlt ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...content,
                        bottomImageAlt: e.target.value,
                      })
                    }
                    placeholder="Describe the image for accessibility..."
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-gray-900">Labels</div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
          <div>
            <div className="text-xs font-medium text-gray-700">Show labels</div>
            <div className="text-xs text-gray-500">
              Display “Before/After” labels on the images
            </div>
          </div>
          <input
            type="checkbox"
            checked={effectiveSettings.showLabels}
            onChange={(e) => updateSettings({ showLabels: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            aria-label="Show labels"
          />
        </label>

        {effectiveSettings.showLabels && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-gray-700">
              Top label
              <input
                type="text"
                value={effectiveSettings.topLabel ?? ""}
                onChange={(e) => updateSettings({ topLabel: e.target.value })}
                placeholder="Before"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </label>

            <label className="block text-xs font-medium text-gray-700">
              Bottom label
              <input
                type="text"
                value={effectiveSettings.bottomLabel ?? ""}
                onChange={(e) =>
                  updateSettings({ bottomLabel: e.target.value })
                }
                placeholder="After"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </label>
          </div>
        )}
      </div>

      {/* Initial slider position */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-gray-900">
          Initial slider position
        </div>

        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={100}
            value={clampPercent(content.initialPercent)}
            onChange={(e) =>
              onChange({
                ...content,
                initialPercent: clampPercent(Number(e.target.value)),
              })
            }
            className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#ff7a00]"
            aria-label="Initial slider position"
          />
          <div className="w-14 text-right text-sm font-medium text-gray-700">
            {clampPercent(content.initialPercent)}%
          </div>
        </div>
      </div>

      {/* Media Library Modal */}
      {isMediaLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closePicker} />
          <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Select Image
              </h2>
              <button
                type="button"
                onClick={closePicker}
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

      {/* local CSS for scrollbar hiding without adding deps */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};


