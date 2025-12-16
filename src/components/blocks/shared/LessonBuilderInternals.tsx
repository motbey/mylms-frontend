import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { supabase } from "../../../../lib/supabaseClient";
import {
  BEHAVIOUR_TAG_OPTIONS,
  COGNITIVE_SKILL_OPTIONS,
  DEFAULT_BLOCK_METADATA,
  LEARNING_PATTERN_OPTIONS,
  PADDING_PRESETS,
  type BlockLayout,
  type BlockMetadata,
  type ContentWidth,
  type PaddingSize,
} from "../../../types/blocks";
import { type BlockStyle } from "../BlockStyleMenu";

// Helper to map AI-provided labels to dropdown option values
const normalise = (s: string) => s.trim().toLowerCase();

function findOptionValueByLabel(
  options: readonly { value: string; label: string }[],
  label: string | null | undefined
): string | null {
  if (!label) return null;
  const normLabel = normalise(label);
  const match = options.find(
    (opt) =>
      normalise(opt.label) === normLabel || normalise(opt.value) === normLabel
  );
  return match?.value ?? null;
}

// Animation types for block entrance effects
type BlockAnimation =
  | "none"
  | "fade-in"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "bounce";

// Animation duration options
type AnimationDuration = "fast" | "normal" | "slow" | "very-slow";

const ANIMATION_OPTIONS: {
  value: BlockAnimation;
  label: string;
  description: string;
}[] = [
  { value: "none", label: "None", description: "No animation" },
  { value: "fade-in", label: "Fade In", description: "Gradually appear" },
  { value: "slide-up", label: "Slide Up", description: "Slide in from below" },
  {
    value: "slide-down",
    label: "Slide Down",
    description: "Slide in from above",
  },
  {
    value: "slide-left",
    label: "Slide Left",
    description: "Slide in from the right",
  },
  {
    value: "slide-right",
    label: "Slide Right",
    description: "Slide in from the left",
  },
  { value: "zoom-in", label: "Zoom In", description: "Scale up from small" },
  { value: "bounce", label: "Bounce", description: "Bouncy entrance" },
];

const DURATION_OPTIONS: {
  value: AnimationDuration;
  label: string;
  seconds: number;
}[] = [
  { value: "fast", label: "Fast", seconds: 0.3 },
  { value: "normal", label: "Normal", seconds: 0.6 },
  { value: "slow", label: "Slow", seconds: 1.0 },
  { value: "very-slow", label: "Very Slow", seconds: 1.5 },
];

// Helper to get Tailwind classes for block styles
export function getBlockStyleClasses(style: BlockStyle): string {
  switch (style) {
    case "light":
      return "bg-gray-50 text-gray-900";
    case "gray":
      return "bg-gray-200 text-gray-900";
    case "theme":
      return "bg-[#ff7a1a] text-white";
    case "themeTint":
      return "bg-[#FFE2CC] text-gray-900";
    case "dark":
      return "bg-neutral-800 text-white";
    case "black":
      return "bg-black text-white";
    case "custom":
      // Custom is handled via inline style, keep text neutral by default
      return "text-gray-900";
    case "image":
      return "bg-cover bg-center bg-gradient-to-br from-gray-600 to-gray-800 text-white"; // placeholder gradient
    default:
      return "bg-white text-gray-900";
  }
}

// Helper to get content width classes
export function getContentWidthClasses(width: ContentWidth): string {
  switch (width) {
    case "S":
      return "max-w-2xl mx-auto";
    case "M":
      return "max-w-3xl mx-auto";
    case "L":
      return "max-w-5xl mx-auto";
    default:
      return "max-w-3xl mx-auto";
  }
}

// BlockWrapper component - applies layout settings to block content
interface BlockWrapperProps {
  layout: BlockLayout;
  children: React.ReactNode;
  fullWidth?: boolean; // When true, removes content width constraints and side padding
}

export const BlockWrapper: React.FC<BlockWrapperProps> = ({
  layout,
  children,
  fullWidth = false,
}) => {
  return (
    <div
      className={
        fullWidth
          ? "w-full"
          : `${getContentWidthClasses(layout.contentWidth)} px-8`
      }
      style={{
        paddingTop: `${layout.paddingTop}px`,
        paddingBottom: `${layout.paddingBottom}px`,
      }}
    >
      {children}
    </div>
  );
};

// FormatPanel component - panel for editing block layout
interface FormatPanelProps {
  layout: BlockLayout;
  onChange: (layout: BlockLayout) => void;
  onClose: () => void;
  hideContentWidth?: boolean;
  // Optional image-text block controls
  imageTextConfig?: {
    imagePosition: "left" | "right";
    imageWidth: 25 | 50 | 75;
    onImagePositionChange: (position: "left" | "right") => void;
    onImageWidthChange: (width: 25 | 50 | 75) => void;
  };
}

export const FormatPanel: React.FC<FormatPanelProps> = ({
  layout,
  onChange,
  onClose,
  hideContentWidth = false,
  imageTextConfig,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay adding the listener to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleContentWidthChange = (width: ContentWidth) => {
    onChange({ ...layout, contentWidth: width });
  };

  const handlePaddingSizeChange = (size: PaddingSize) => {
    const paddingValue = PADDING_PRESETS[size];
    onChange({
      ...layout,
      paddingSize: size,
      paddingTop: paddingValue,
      paddingBottom: paddingValue,
    });
  };

  const handlePaddingTopChange = (value: number) => {
    onChange({ ...layout, paddingTop: Math.max(0, Math.min(160, value)) });
  };

  const handlePaddingBottomChange = (value: number) => {
    onChange({ ...layout, paddingBottom: Math.max(0, Math.min(160, value)) });
  };

  return (
    <div
      ref={panelRef}
      className="absolute top-14 left-4 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Format</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Content Width Section - hidden for some block types */}
        {!hideContentWidth && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Content width
            </label>
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              {(["S", "M", "L"] as ContentWidth[]).map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => handleContentWidthChange(width)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                    layout.contentWidth === width
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {width}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Block Padding Section */}
        <div
          className={hideContentWidth ? "" : "border-t border-slate-200 pt-4"}
        >
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Block padding
          </label>
          <div className="inline-flex rounded-full bg-slate-100 p-1">
            {(["S", "M", "L"] as PaddingSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handlePaddingSizeChange(size)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                  layout.paddingSize === size
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {size}
              </button>
            ))}
            <span className="px-4 py-1.5 text-sm text-slate-400">…</span>
          </div>
        </div>

        {/* Padding Sliders Section */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          {/* Top Padding */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Top
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="160"
                value={layout.paddingTop}
                onChange={(e) => handlePaddingTopChange(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#ff7a00]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="160"
                  value={layout.paddingTop}
                  onChange={(e) =>
                    handlePaddingTopChange(Number(e.target.value))
                  }
                  className="w-12 px-2 py-1 text-xs text-right border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00]"
                />
                <span className="text-xs text-slate-500 flex-shrink-0">px</span>
              </div>
            </div>
          </div>

          {/* Bottom Padding */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Bottom
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="160"
                value={layout.paddingBottom}
                onChange={(e) =>
                  handlePaddingBottomChange(Number(e.target.value))
                }
                className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#ff7a00]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="160"
                  value={layout.paddingBottom}
                  onChange={(e) =>
                    handlePaddingBottomChange(Number(e.target.value))
                  }
                  className="w-12 px-2 py-1 text-xs text-right border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00]"
                />
                <span className="text-xs text-slate-500 flex-shrink-0">px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Image-Text Block Controls */}
        {imageTextConfig && (
          <>
            {/* Image Position */}
            <div className="border-t border-slate-200 pt-4">
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Image position
              </label>
              <div className="inline-flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => imageTextConfig.onImagePositionChange("left")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                    imageTextConfig.imagePosition === "left"
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => imageTextConfig.onImagePositionChange("right")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                    imageTextConfig.imagePosition === "right"
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Right
                </button>
              </div>
            </div>

            {/* Image Width */}
            <div className="border-t border-slate-200 pt-4">
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Image width
              </label>
              <div className="inline-flex rounded-full bg-slate-100 p-1">
                {([25, 50, 75] as const).map((width) => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => imageTextConfig.onImageWidthChange(width)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                      imageTextConfig.imageWidth === width
                        ? "bg-white shadow-sm text-slate-900"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {width}%
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// AppearancePanel component - for block animation settings
interface AppearancePanelProps {
  animation: BlockAnimation;
  duration: AnimationDuration;
  onChange: (animation: BlockAnimation) => void;
  onDurationChange: (duration: AnimationDuration) => void;
  onClose: () => void;
}

export const AppearancePanel: React.FC<AppearancePanelProps> = ({
  animation,
  duration,
  onChange,
  onDurationChange,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute top-14 left-4 z-40 rounded-xl border border-gray-200 bg-white shadow-xl w-[280px] text-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="font-medium text-gray-900">Block Animation</div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Animation Options */}
      <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Entrance Animation
      </div>
      <div className="px-3 pb-3 space-y-1 max-h-[200px] overflow-y-auto">
        {ANIMATION_OPTIONS.map((option) => {
          const isActive = option.value === animation;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`
                flex w-full items-center gap-3 rounded-lg px-3 py-2
                text-left transition
                ${
                  isActive
                    ? "ring-1 ring-[#ff7a1a] bg-orange-50"
                    : "hover:bg-gray-50"
                }
              `}
            >
              {/* Animation icon/preview */}
              <div
                className={`
                h-8 w-8 rounded-md bg-gray-100 flex items-center justify-center text-lg
                ${isActive ? "bg-orange-100" : ""}
              `}
              >
                {option.value === "none" && "—"}
                {option.value === "fade-in" && "👁️"}
                {option.value === "slide-up" && "⬆️"}
                {option.value === "slide-down" && "⬇️"}
                {option.value === "slide-left" && "⬅️"}
                {option.value === "slide-right" && "➡️"}
                {option.value === "zoom-in" && "🔍"}
                {option.value === "bounce" && "⚡"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {option.label}
                </div>
                <div className="text-xs text-gray-500">
                  {option.description}
                </div>
              </div>
              {isActive && <div className="text-[#ff7a1a]">✓</div>}
            </button>
          );
        })}
      </div>

      {/* Duration Options - only show if animation is not "none" */}
      {animation && animation !== "none" && (
        <>
          <div className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 border-t border-gray-100">
            Animation Speed
          </div>
          <div className="px-3 pb-3 flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((option) => {
              const isActive = option.value === duration;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onDurationChange(option.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition
                    ${
                      isActive
                        ? "bg-[#ff7a1a] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }
                  `}
                >
                  {option.label}
                  <span className="ml-1 text-xs opacity-70">
                    ({option.seconds}s)
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// BlockMetadataPopover component - panel for editing block metadata (learning fingerprint)
interface BlockMetadataPopoverProps {
  metadata: BlockMetadata | undefined;
  onChange: (metadata: BlockMetadata) => void;
  onClose: () => void;
  blockId: string;
  blockType: string;
  blockContent: string;
  savedToDb?: boolean;
  mblMetadata?: unknown; // Raw AI-generated metadata JSON from mbl_metadata column
  onMblMetadataCleared?: () => void; // Callback when mbl_metadata is cleared from database
  onMblMetadataUpdated?: (mblMetadata: unknown) => void; // Callback when AI generates new mbl_metadata
  moduleId?: string | null;
  pageId?: string | null;
}

export const BlockMetadataPopover: React.FC<BlockMetadataPopoverProps> = ({
  metadata,
  onChange,
  onClose,
  blockId,
  blockType,
  blockContent,
  savedToDb,
  mblMetadata,
  onMblMetadataCleared,
  onMblMetadataUpdated,
  moduleId,
  pageId,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Toggle state for showing raw AI output
  const [showAiOutput, setShowAiOutput] = useState(false);

  // Sanity check state
  const [isSanityChecking, setIsSanityChecking] = useState(false);
  const [isApplyingCorrections, setIsApplyingCorrections] = useState(false);
  const [sanityReview, setSanityReview] = useState<{
    fields: {
      [field_name: string]: {
        original_value: string;
        suggested_value: string;
        reason: string;
        confidence?: number;
        _decision: "accept" | "ignore";
      };
    };
    issues_found: number;
    checked_at?: string | null;
  } | null>(null);
  const [sanityError, setSanityError] = useState<string | null>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleFieldChange = (partial: Partial<BlockMetadata>) => {
    // Convert empty strings to null for cleaner storage
    const cleanPartial: Partial<BlockMetadata> = {};
    for (const [key, value] of Object.entries(partial)) {
      if (value === "" || value === 0) {
        (cleanPartial as Record<string, unknown>)[key] = null;
      } else {
        (cleanPartial as Record<string, unknown>)[key] = value;
      }
    }

    // Update fieldSources to 'human' for any field being manually changed
    const updatedFieldSources = { ...(metadata?.fieldSources ?? {}) };
    for (const key of Object.keys(partial)) {
      if (
        key === "behaviourTag" ||
        key === "cognitiveSkill" ||
        key === "learningPattern" ||
        key === "difficulty"
      ) {
        updatedFieldSources[key] = "human";
      }
    }

    onChange({
      behaviourTag: metadata?.behaviourTag ?? null,
      cognitiveSkill: metadata?.cognitiveSkill ?? null,
      learningPattern: metadata?.learningPattern ?? null,
      difficulty: metadata?.difficulty ?? null,
      notes: metadata?.notes ?? null,
      fieldSources: updatedFieldSources,
      ...cleanPartial,
    });
  };

  const aiSupportedBlockTypes = useMemo(
    () => [
      "paragraph",
      "heading",
      "subheading",
      "paragraph-with-heading",
      "paragraph-with-subheading",
      "columns",
      "table",
      "numbered-list",
      "bullet-list",
      "image-centered",
      "image-fullwidth",
      "image-text",
      "flashcards",
      "sorting_activity",
      "accordion",
    ],
    []
  );

  // Handle AI metadata generation
  // Only works when block has been saved to the database (savedToDb === true)
  const dbBlockId = savedToDb ? blockId : null;

  const handleClearMetadata = async () => {
    // Clear local metadata state
    onChange({ ...DEFAULT_BLOCK_METADATA });

    // If block is saved to database, also clear mbl_metadata column
    if (dbBlockId) {
      setIsClearing(true);
      try {
        const { error } = await supabase
          .from("content_module_blocks")
          .update({ mbl_metadata: null })
          .eq("id", dbBlockId);

        if (error) {
          console.error("Error clearing mbl_metadata from database:", error);
        } else {
          // Hide the AI output panel since data is cleared
          setShowAiOutput(false);
          // Notify parent to clear local mblMetadata state
          onMblMetadataCleared?.();
        }
      } catch (err) {
        console.error("Unexpected error clearing metadata:", err);
      } finally {
        setIsClearing(false);
      }
    }
  };

  const handleGenerateWithAI = async () => {
    if (!aiSupportedBlockTypes.includes(blockType)) {
      return;
    }
    if (!dbBlockId) {
      setAiError("Please save the lesson before generating AI metadata.");
      return;
    }

    if (!blockContent) {
      setAiError("This block has no content yet.");
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      // Build payload we send to the Edge Function
      const payload = {
        blockId: dbBlockId,
        blockType: blockType,
        content: blockContent,
        notes: metadata?.notes ?? null,
        metadata: {
          behaviourTag: metadata?.behaviourTag ?? null,
          cognitiveSkill: metadata?.cognitiveSkill ?? null,
          learningPattern: metadata?.learningPattern ?? null,
          difficulty: metadata?.difficulty ?? null,
        },
      };

      console.log("AI metadata payload", payload);

      const { data, error } = await supabase.functions.invoke(
        "ai-generate-block-metadata",
        {
          body: payload,
        }
      );

      if (error) {
        console.error("AI metadata error", error);
        setAiError(
          "There was a problem generating AI metadata. Please try again."
        );
        return;
      }

      // The Edge Function returns { metadata: { ... } }
      const aiMeta = data?.metadata;
      console.log("AI metadata response", aiMeta);

      if (!aiMeta) {
        setAiError("AI did not return metadata.");
        return;
      }

      // Read fields from the AI JSON.
      // NOTE: The AI returns snake_case keys and LABEL strings (e.g. "Attention / focus").
      // We need to convert labels to option VALUES (e.g. "attention") for the dropdowns.
      const aiBehaviourLabel: string | null =
        (aiMeta.behaviour_tag as string | undefined) ?? null;
      const aiCognitiveLabel: string | null =
        (aiMeta.cognitive_skill as string | undefined) ?? null;
      const aiPatternLabel: string | null =
        (aiMeta.learning_pattern as string | undefined) ?? null;

      // Map AI labels to dropdown option values
      const aiBehaviourTag = findOptionValueByLabel(
        BEHAVIOUR_TAG_OPTIONS,
        aiBehaviourLabel
      );
      const aiCognitiveSkill = findOptionValueByLabel(
        COGNITIVE_SKILL_OPTIONS,
        aiCognitiveLabel
      );
      const aiLearningPattern = findOptionValueByLabel(
        LEARNING_PATTERN_OPTIONS,
        aiPatternLabel
      );

      let aiDifficulty: number | null = null;
      if (typeof aiMeta.difficulty === "number") {
        aiDifficulty = aiMeta.difficulty;
      }

      // Optional extras from the AI
      const aiSource: string | null =
        (aiMeta.source as string | undefined) ?? "ai";
      const aiExplanations = aiMeta.explanations ?? null;
      const aiConfidenceScores = aiMeta.confidence_scores ?? null;

      // Merge AI suggestions with any existing human metadata.
      // If AI returns null for a field, we keep the human-entered value.
      // Track which fields were set by AI
      const fieldSources = {
        ...(metadata?.fieldSources ?? {}),
        behaviourTag: aiBehaviourTag
          ? ("ai" as const)
          : metadata?.fieldSources?.behaviourTag ?? null,
        cognitiveSkill: aiCognitiveSkill
          ? ("ai" as const)
          : metadata?.fieldSources?.cognitiveSkill ?? null,
        learningPattern: aiLearningPattern
          ? ("ai" as const)
          : metadata?.fieldSources?.learningPattern ?? null,
        difficulty:
          aiDifficulty !== null
            ? ("ai" as const)
            : metadata?.fieldSources?.difficulty ?? null,
      };

      const updatedMetadata: BlockMetadata = {
        // keep anything else that already exists on the metadata object
        ...(metadata ?? {}),
        behaviourTag: aiBehaviourTag ?? metadata?.behaviourTag ?? null,
        cognitiveSkill: aiCognitiveSkill ?? metadata?.cognitiveSkill ?? null,
        learningPattern: aiLearningPattern ?? metadata?.learningPattern ?? null,
        difficulty: aiDifficulty ?? metadata?.difficulty ?? null,
        // always preserve notes typed by a human
        notes: metadata?.notes ?? null,
        // AI provenance + diagnostics
        source: aiSource,
        fieldSources,
        aiExplanations,
        aiConfidenceScores,
      };

      console.log("Updated block metadata from AI", updatedMetadata);

      // Push back to the parent so the dropdowns & slider update instantly
      onChange(updatedMetadata);

      // Update the raw mbl_metadata in local state so "Show AI output" button appears immediately
      // The edge function saves the full AI response to mbl_metadata column
      onMblMetadataUpdated?.(aiMeta);
    } catch (err) {
      console.error("Unexpected AI error", err);
      setAiError("Unexpected error talking to AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle AI sanity check - calls Edge Function /functions/v1/ai-sanity-check
  const handleSanityCheck = async () => {
    setIsSanityChecking(true);
    setSanityError(null);
    setSanityReview(null);

    try {
      // Build payload with exact structure expected by the Edge Function
      const payload = {
        block_id: blockId,
        block_content: blockContent,
        ai1_metadata: mblMetadata,
      };

      const { data, error } = await supabase.functions.invoke(
        "ai-sanity-check?debug=1",
        { body: payload }
      );

      if (error) {
        console.error("Sanity check error (Supabase):", error);
        setSanityError("Failed to run sanity check. Please try again.");
        return;
      }

      if (!data) {
        console.error(
          "Sanity check error: no data returned from Edge Function"
        );
        setSanityError("No response from sanity checker.");
        return;
      }

      // Parse data if it's a JSON string (Edge Function may return string)
      let parsedData = data;
      if (typeof data === "string") {
        try {
          parsedData = JSON.parse(data);
          console.log("Parsed JSON string to object:", parsedData);
        } catch (e) {
          console.error("Failed to parse data as JSON:", e);
        }
      }

      if ((parsedData as any).error) {
        console.error("Sanity check error payload:", parsedData);
        setSanityError((parsedData as any).error || "Sanity check failed.");
        return;
      }

      // Try to get suggestions from response first
      let suggestions = Array.isArray((parsedData as any).suggestions)
        ? (parsedData as any).suggestions
        : [];

      // FALLBACK: If no suggestions in response, query the database
      if (suggestions.length === 0) {
        console.log(
          "No suggestions in response, querying metadata_review_log..."
        );

        const { data: dbRows, error: dbError } = await supabase
          .from("metadata_review_log")
          .select(
            "field_name, original_value, suggested_value, reason, confidence"
          )
          .eq("block_id", blockId)
          .is("accepted", null)
          .is("processed", null);

        if (dbError) {
          console.error("Error querying metadata_review_log:", dbError);
        } else if (dbRows && dbRows.length > 0) {
          console.log("Found suggestions in database:", dbRows);
          suggestions = dbRows;
        }
      }

      type FieldEntry = {
        original_value: string;
        suggested_value: string;
        reason: string;
        confidence?: number;
        _decision: "accept" | "ignore";
      };

      const fields: {
        [key: string]: FieldEntry;
      } = {};

      for (const s of suggestions) {
        if (!s || !s.field_name) continue;

        fields[s.field_name] = {
          original_value: String(s.original_value ?? ""),
          suggested_value: String(s.suggested_value ?? ""),
          reason: String(s.reason ?? ""),
          confidence:
            typeof s.confidence === "number" ? s.confidence : undefined,
          _decision: "accept", // default to accept in the UI
        };
      }

      const issuesFound = Object.keys(fields).length;

      console.log("Final sanityReview fields:", fields, "issues:", issuesFound);

      setSanityReview({
        fields,
        issues_found: issuesFound,
      });
    } catch (err) {
      console.error("Unexpected sanity check error:", err);
      setSanityError("Unexpected error during sanity check.");
    } finally {
      setIsSanityChecking(false);
    }
  };

  // Handle decision change for a sanity review field
  const handleSanityDecisionChange = (
    fieldName: string,
    decision: "accept" | "ignore"
  ) => {
    setSanityReview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: {
          ...prev.fields,
          [fieldName]: {
            ...prev.fields[fieldName],
            _decision: decision,
          },
        },
      };
    });
  };

  // Handle applying accepted corrections
  const handleApplyCorrections = async () => {
    if (!sanityReview || !blockId) return;

    type FieldEntry = {
      original_value: string;
      suggested_value: string;
      reason: string;
      confidence?: number;
      _decision: "accept" | "ignore";
    };

    // Separate accepted and ignored fields
    const acceptedFields = Object.entries(sanityReview.fields)
      .filter(([, field]: [string, FieldEntry]) => field._decision === "accept")
      .map(([fieldName, field]: [string, FieldEntry]) => ({
        field_name: fieldName,
        suggested_value: field.suggested_value,
      }));

    const ignoredFieldNames = Object.entries(sanityReview.fields)
      .filter(([, field]: [string, FieldEntry]) => field._decision === "ignore")
      .map(([fieldName]: [string, FieldEntry]) => fieldName);

    if (acceptedFields.length === 0 && ignoredFieldNames.length === 0) {
      alert("No corrections to process.");
      return;
    }

    const payload = {
      block_id: blockId,
      accepted_fields: acceptedFields,
    };

    console.log("APPLY CORRECTIONS PAYLOAD:", payload);

    setIsApplyingCorrections(true);
    try {
      // Step 1: Call the Edge Function to apply accepted corrections
      if (acceptedFields.length > 0) {
        const { data, error } = await supabase.functions.invoke(
          "ai-apply-metadata-corrections",
          {
            body: payload,
          }
        );

        if (error) {
          console.error("Apply corrections error:", error);
          alert("Failed to apply corrections. Please try again.");
          return;
        }

        if (data?.error) {
          alert(data.error);
          return;
        }

        // Update local metadata
        if (data?.updated) {
          onMblMetadataUpdated?.(data.updated);
        }
      }

      // Step 2: Update metadata_review_log for ACCEPTED fields
      if (acceptedFields.length > 0) {
        const acceptedFieldNames = acceptedFields.map((f) => f.field_name);
        const { error: acceptUpdateError } = await supabase
          .from("metadata_review_log")
          .update({
            accepted: true,
            processed: true,
            action: "applied",
          })
          .eq("block_id", blockId)
          .in("field_name", acceptedFieldNames)
          .is("processed", null);

        if (acceptUpdateError) {
          console.error("Error updating accepted rows:", acceptUpdateError);
        }
      }

      // Step 3: Update metadata_review_log for IGNORED fields
      if (ignoredFieldNames.length > 0) {
        const { error: ignoreUpdateError } = await supabase
          .from("metadata_review_log")
          .update({
            accepted: false,
            processed: true,
            action: "ignored",
          })
          .eq("block_id", blockId)
          .in("field_name", ignoredFieldNames)
          .is("processed", null);

        if (ignoreUpdateError) {
          console.error("Error updating ignored rows:", ignoreUpdateError);
        }
      }

      setSanityReview(null);
      alert("✅ Metadata corrections applied successfully!");
    } catch (err) {
      console.error("Unexpected error applying corrections:", err);
      alert("Unexpected error applying corrections.");
    } finally {
      setIsApplyingCorrections(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute top-14 left-4 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#ff7a00]" />
          <h3 className="text-sm font-semibold text-slate-900">
            Block metadata
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Helper text */}
        <p className="text-xs text-slate-500 leading-relaxed">
          These tags help MyLMS understand how this block contributes to
          learning.
        </p>

        {/* Behaviour Tag */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-600">
              Behaviour tag
            </label>
            {metadata?.fieldSources?.behaviourTag && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  metadata.fieldSources.behaviourTag === "ai"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {metadata.fieldSources.behaviourTag === "ai"
                  ? "🤖 AI"
                  : "👤 Human"}
              </span>
            )}
          </div>
          <select
            value={metadata?.behaviourTag ?? ""}
            onChange={(e) =>
              handleFieldChange({ behaviourTag: e.target.value })
            }
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00] bg-white"
          >
            {BEHAVIOUR_TAG_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Cognitive Skill */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-600">
              Cognitive skill
            </label>
            {metadata?.fieldSources?.cognitiveSkill && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  metadata.fieldSources.cognitiveSkill === "ai"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {metadata.fieldSources.cognitiveSkill === "ai"
                  ? "🤖 AI"
                  : "👤 Human"}
              </span>
            )}
          </div>
          <select
            value={metadata?.cognitiveSkill ?? ""}
            onChange={(e) =>
              handleFieldChange({ cognitiveSkill: e.target.value })
            }
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00] bg-white"
          >
            {COGNITIVE_SKILL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Learning Pattern */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-600">
              Learning pattern
            </label>
            {metadata?.fieldSources?.learningPattern && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  metadata.fieldSources.learningPattern === "ai"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {metadata.fieldSources.learningPattern === "ai"
                  ? "🤖 AI"
                  : "👤 Human"}
              </span>
            )}
          </div>
          <select
            value={metadata?.learningPattern ?? ""}
            onChange={(e) =>
              handleFieldChange({ learningPattern: e.target.value })
            }
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00] bg-white"
          >
            {LEARNING_PATTERN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-600">
              Difficulty
            </label>
            {metadata?.fieldSources?.difficulty && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  metadata.fieldSources.difficulty === "ai"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {metadata.fieldSources.difficulty === "ai"
                  ? "🤖 AI"
                  : "👤 Human"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={metadata?.difficulty ?? 0}
              onChange={(e) =>
                handleFieldChange({ difficulty: Number(e.target.value) })
              }
              className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#ff7a00]"
            />
            <span className="w-8 text-right text-xs font-medium text-slate-700">
              {metadata?.difficulty ?? 0}
            </span>
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-400">
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Notes for AI / analytics{" "}
            <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={metadata?.notes ?? ""}
            onChange={(e) => handleFieldChange({ notes: e.target.value })}
            rows={3}
            placeholder="Add notes about this block's learning purpose..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff7a00] focus:border-[#ff7a00] resize-none"
          />
        </div>

        {aiSupportedBlockTypes.includes(blockType) && (
          <>
            {/* Generate with AI button */}
            <button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={isGenerating || !dbBlockId}
              className="mt-4 w-full rounded-md bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? "Generating…" : "Generate with AI"}
            </button>
            {aiError && <p className="mt-2 text-xs text-red-600">{aiError}</p>}

            {/* Show AI output button */}
            {mblMetadata && (
              <button
                type="button"
                onClick={() => setShowAiOutput(!showAiOutput)}
                className="mt-2 w-full rounded-md border border-purple-300 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors"
              >
                {showAiOutput ? "Hide AI output" : "Show AI output"}
              </button>
            )}

            {/* AI output JSON display */}
            {showAiOutput && mblMetadata && (
              <div className="mt-2 p-3 bg-slate-900 rounded-lg overflow-auto max-h-48">
                <pre className="text-xs text-green-400 whitespace-pre-wrap break-words font-mono">
                  {JSON.stringify(mblMetadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Sanity Check button - show when AI metadata exists */}
            {mblMetadata && (
              <button
                type="button"
                onClick={handleSanityCheck}
                disabled={isSanityChecking}
                className="mt-2 w-full rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSanityChecking ? "Checking..." : <>🔍 Run Sanity Check</>}
              </button>
            )}
            {sanityError && (
              <p className="mt-2 text-xs text-red-600">{sanityError}</p>
            )}

            {/* Sanity Check Results - Diff View Panel */}
            {sanityReview && (
              <div className="mt-3 rounded-lg border-2 border-blue-200 bg-slate-50 overflow-hidden">
                {/* Header */}
                <div className="px-3 py-2 bg-blue-100 border-b border-blue-200">
                  <span className="text-sm font-semibold text-blue-900">
                    {Object.keys(sanityReview.fields).length === 0
                      ? "✅ No issues found!"
                      : (() => {
                          const count = Object.keys(sanityReview.fields).length;
                          return `⚠️ ${count} suggestion${
                            count > 1 ? "s" : ""
                          }`;
                        })()}
                  </span>
                </div>

                {/* Field suggestions */}
                {Object.keys(sanityReview.fields).length > 0 && (
                  <div className="p-3 space-y-3">
                    {Object.entries(sanityReview.fields).map(
                      ([fieldName, field]: [
                        string,
                        {
                          original_value: string;
                          suggested_value: string;
                          reason: string;
                          confidence?: number;
                          _decision: "accept" | "ignore";
                        }
                      ]) => (
                        <div
                          key={fieldName}
                          className={`p-3 rounded-lg border-2 ${
                            field._decision === "accept"
                              ? "border-green-200 bg-green-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          {/* Field name header */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm text-slate-800 capitalize">
                              {fieldName.replace(/_/g, " ")}
                            </span>
                            {/* Decision dropdown */}
                            <select
                              value={field._decision}
                              onChange={(e) =>
                                handleSanityDecisionChange(
                                  fieldName,
                                  e.target.value as "accept" | "ignore"
                                )
                              }
                              className={`text-xs font-medium px-2 py-1 rounded border ${
                                field._decision === "accept"
                                  ? "bg-green-100 border-green-300 text-green-700"
                                  : "bg-slate-100 border-slate-300 text-slate-600"
                              }`}
                            >
                              <option value="accept">✓ Accept</option>
                              <option value="ignore">✗ Ignore</option>
                            </select>
                          </div>

                          {/* Diff view: original → suggested */}
                          <div className="flex items-center gap-2 text-xs mb-2 p-2 bg-white rounded border border-slate-200">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded line-through">
                              {field.original_value || "(empty)"}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                              {field.suggested_value}
                            </span>
                          </div>

                          {/* Reason from AI */}
                          <div className="text-xs text-slate-600 italic bg-slate-100 p-2 rounded">
                            <span className="font-medium not-italic text-slate-500">
                              Reason:{" "}
                            </span>
                            {field.reason}
                          </div>

                          {/* Confidence indicator */}
                          {field.confidence && (
                            <div className="mt-2 text-[10px] text-slate-400">
                              Confidence: {Math.round(field.confidence * 100)}%
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Apply Corrections button */}
                {Object.keys(sanityReview.fields).length > 0 && (
                  <div className="p-3 pt-0">
                    <button
                      type="button"
                      onClick={handleApplyCorrections}
                      disabled={isApplyingCorrections}
                      className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isApplyingCorrections ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Applying...
                        </>
                      ) : (
                        <>✓ Apply Corrections</>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center mt-1.5">
                      {
                        Object.values(sanityReview.fields).filter(
                          (f: {
                            original_value: string;
                            suggested_value: string;
                            reason: string;
                            confidence?: number;
                            _decision: "accept" | "ignore";
                          }) => f._decision === "accept"
                        ).length
                      }{" "}
                      of {Object.keys(sanityReview.fields).length} corrections
                      selected
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Clear button */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClearMetadata}
            disabled={isClearing}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearing ? "Clearing..." : "Clear metadata"}
          </button>
        </div>
      </div>
    </div>
  );
};
