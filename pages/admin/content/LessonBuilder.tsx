import React, {
  Fragment,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  X,
  LayoutGrid,
  Plus,
  Sparkles,
  PanelsLeftRight,
  Palette,
  Stars,
  Database,
  ArrowRight,
  ArrowLeft,
  Hash,
  ListOrdered,
  IndentIncrease,
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import {
  upsertContentModuleBlock,
  getContentModuleBlocksByPageId,
  deleteContentModuleBlock,
  type ContentModuleBlockRow,
} from "../../../src/lib/supabase/contentModuleBlocks";
import type {
  TextBlockContentJson,
  StructuredBlockContent,
} from "../../../src/types/contentBlocks";
import TipTapEditor from "../../../src/components/editor/TipTapEditor";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import {
  BlockStyleMenu,
  type BlockStyle,
} from "../../../src/components/blocks/BlockStyleMenu";

// Import shared block types
import {
  type BlockMetadata,
  type BlockLayout,
  type ContentWidth,
  type PaddingSize,
  DEFAULT_BLOCK_METADATA,
  DEFAULT_BLOCK_LAYOUT,
  PADDING_PRESETS,
  hasBlockMetadata,
  BEHAVIOUR_TAG_OPTIONS,
  COGNITIVE_SKILL_OPTIONS,
  LEARNING_PATTERN_OPTIONS,
} from "../../../src/types/blocks";

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

type LessonPage = {
  id: string;
  title: string;
};

// Block types (local to this component for now)
type LessonBlockType =
  | "heading"
  | "subheading"
  | "paragraph"
  | "paragraph-with-heading"
  | "paragraph-with-subheading"
  | "columns"
  | "table"
  | "numbered-list"
  | "bullet-list";

// Types for ordered list block
type OrderedListStyle =
  | "decimal" // 1, 2, 3
  | "lower-alpha" // a, b, c
  | "upper-alpha" // A, B, C
  | "lower-roman" // i, ii, iii
  | "upper-roman"; // I, II, III

interface NumberedListItem {
  body: string; // HTML string content
  children?: NumberedListItem[]; // Optional level-2 sublist (max 2 levels)
}

// Types for bullet list block
type BulletStyle = "disc" | "circle" | "square" | "dash" | "check";

interface BulletListItem {
  body: string; // HTML string content
  children?: BulletListItem[]; // Optional level-2 sublist (max 2 levels)
}

interface NumberedListContent {
  items: NumberedListItem[];
  start?: number; // default 1
  style?: OrderedListStyle; // Level-1 style, default "decimal"
  subStyle?: OrderedListStyle; // Level-2 style, default "lower-alpha"
}

// List style options for the editor dropdown
const LIST_STYLE_OPTIONS: {
  value: OrderedListStyle;
  label: string;
  name: string;
}[] = [
  { value: "decimal", label: "1, 2, 3", name: "Decimal" },
  { value: "lower-alpha", label: "a, b, c", name: "Lowercase" },
  { value: "upper-alpha", label: "A, B, C", name: "Uppercase" },
  { value: "lower-roman", label: "i, ii, iii", name: "Roman (lower)" },
  { value: "upper-roman", label: "I, II, III", name: "Roman (upper)" },
];

// Helper to get style label for display
function getStyleLabel(style: OrderedListStyle | undefined): string {
  const option = LIST_STYLE_OPTIONS.find((o) => o.value === style);
  return option?.label ?? "1, 2, 3";
}

// Helper to get CSS list-style-type value
function getListStyleType(style: OrderedListStyle | undefined): string {
  switch (style) {
    case "lower-alpha":
      return "lower-alpha";
    case "upper-alpha":
      return "upper-alpha";
    case "lower-roman":
      return "lower-roman";
    case "upper-roman":
      return "upper-roman";
    case "decimal":
    default:
      return "decimal";
  }
}

// Helper to convert a number to the appropriate list marker format
function getListMarker(
  num: number,
  style: OrderedListStyle | undefined
): string {
  switch (style) {
    case "lower-alpha":
      // Convert 1 -> a, 2 -> b, etc. (wraps after z)
      return String.fromCharCode(97 + ((num - 1) % 26));
    case "upper-alpha":
      // Convert 1 -> A, 2 -> B, etc. (wraps after Z)
      return String.fromCharCode(65 + ((num - 1) % 26));
    case "lower-roman":
      return toRoman(num).toLowerCase();
    case "upper-roman":
      return toRoman(num);
    case "decimal":
    default:
      return String(num);
  }
}

// Helper to convert number to Roman numerals
function toRoman(num: number): string {
  if (num < 1 || num > 3999) return String(num);
  const romanNumerals: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  for (const [value, symbol] of romanNumerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

interface LessonBlock {
  id: string;
  type: LessonBlockType;
  orderIndex: number;
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  mblMetadata?: unknown; // Raw AI-generated metadata from mbl_metadata column
  savedToDb?: boolean; // true when block exists in content_module_blocks table
  content: {
    heading?: string; // Used by paragraph-with-heading
    subheading?: string; // Used by paragraph-with-subheading
    columnOneContent?: string; // Used by columns block
    columnTwoContent?: string; // Used by columns block
    tableContent?: unknown; // Used by table block (TipTap JSON)
    borderMode?: "normal" | "dashed" | "alternate"; // Used by table block
    html?: string;
    text?: string;
    // Ordered list block fields
    listItems?: NumberedListItem[];
    startNumber?: number; // Start number for the list
    listStyle?: OrderedListStyle; // Level-1 style (decimal, lower-alpha, etc.)
    subStyle?: OrderedListStyle; // Level-2 style for nested items
    numberColor?: string; // Custom color for number badges (hex string) - used in editor
    // Bullet list block fields
    bulletItems?: BulletListItem[];
    bulletStyle?: BulletStyle; // Level-1 style (disc, circle, square, dash, check)
    bulletSubStyle?: BulletStyle; // Level-2 style for nested items
    bulletColor?: string; // Custom color for bullet markers (hex string)
    // Animation settings (applies to all blocks)
    animation?: BlockAnimation;
    animationDuration?: AnimationDuration;
    [key: string]: unknown;
  };
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

// Animation duration options
type AnimationDuration = "fast" | "normal" | "slow" | "very-slow";

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

// Helper to get duration in seconds
function getDurationSeconds(duration: AnimationDuration | undefined): number {
  const option = DURATION_OPTIONS.find((d) => d.value === duration);
  return option?.seconds ?? 0.6; // Default to normal (0.6s)
}

// CSS keyframe animations for block entrance effects
const ANIMATION_STYLES = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideLeft {
    from { opacity: 0; transform: translateX(30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideRight {
    from { opacity: 0; transform: translateX(-30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes zoomIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes bounce {
    0% { opacity: 0; transform: translateY(30px); }
    50% { transform: translateY(-10px); }
    70% { transform: translateY(5px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in { animation: fadeIn 0.6s ease-out both; }
  .animate-slide-up { animation: slideUp 0.6s ease-out both; }
  .animate-slide-down { animation: slideDown 0.6s ease-out both; }
  .animate-slide-left { animation: slideLeft 0.6s ease-out both; }
  .animate-slide-right { animation: slideRight 0.6s ease-out both; }
  .animate-zoom-in { animation: zoomIn 0.5s ease-out both; }
  .animate-bounce { animation: bounce 0.8s ease-out both; }
  
  /* Staggered list item animation - slides in from right */
  @keyframes listItemSlideIn {
    from { opacity: 0; transform: translateX(50px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .animate-list-item {
    opacity: 0;
    animation: listItemSlideIn 0.8s ease-out both;
  }
`;

// Helper to get animation class based on animation type
function getAnimationClass(animation: BlockAnimation | undefined): string {
  switch (animation) {
    case "fade-in":
      return "animate-fade-in";
    case "slide-up":
      return "animate-slide-up";
    case "slide-down":
      return "animate-slide-down";
    case "slide-left":
      return "animate-slide-left";
    case "slide-right":
      return "animate-slide-right";
    case "zoom-in":
      return "animate-zoom-in";
    case "bounce":
      return "animate-bounce";
    default:
      return "";
  }
}

// Component that animates when it comes into view
interface AnimateOnViewProps {
  children: React.ReactNode;
  animation: BlockAnimation | undefined;
  duration?: AnimationDuration;
  className?: string;
  style?: React.CSSProperties;
}

const AnimateOnView: React.FC<AnimateOnViewProps> = ({
  children,
  animation,
  duration,
  className = "",
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Only trigger once when element comes into view
          if (entry.isIntersecting && !isVisible) {
            setIsVisible(true);
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: "0px 0px -50px 0px", // Trigger slightly before fully in view
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  const animationClass = isVisible ? getAnimationClass(animation) : "";
  const durationSeconds = getDurationSeconds(duration);

  // Start with opacity 0 if there's an animation, then animate in
  const initialStyle: React.CSSProperties =
    animation && animation !== "none" && !isVisible ? { opacity: 0 } : {};

  // Apply custom animation duration and delay via CSS
  // Delay of 300ms so animation is more noticeable after block comes into view
  const animationStyle: React.CSSProperties =
    isVisible && animation && animation !== "none"
      ? { animationDuration: `${durationSeconds}s`, animationDelay: "0.3s" }
      : {};

  return (
    <div
      ref={ref}
      className={`${className} ${animationClass}`}
      style={{ ...style, ...initialStyle, ...animationStyle }}
    >
      {children}
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

const AppearancePanel: React.FC<AppearancePanelProps> = ({
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

// Helper to get Tailwind classes for block styles
function getBlockStyleClasses(style: BlockStyle): string {
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
function getContentWidthClasses(width: ContentWidth): string {
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
}

const BlockWrapper: React.FC<BlockWrapperProps> = ({ layout, children }) => {
  return (
    <div
      className={`${getContentWidthClasses(layout.contentWidth)} px-8`}
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
}

const FormatPanel: React.FC<FormatPanelProps> = ({
  layout,
  onChange,
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
        {/* Content Width Section */}
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

        {/* Block Padding Section */}
        <div className="border-t border-slate-200 pt-4">
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
                <span className="text-xs text-slate-400">px</span>
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
                <span className="text-xs text-slate-400">px</span>
              </div>
            </div>
          </div>
        </div>
      </div>
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
}

const BlockMetadataPopover: React.FC<BlockMetadataPopoverProps> = ({
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
        cleanPartial[key as keyof BlockMetadata] = null;
      } else {
        cleanPartial[key as keyof BlockMetadata] = value as never;
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
        "ai-sanity-check",
        { body: payload }
      );

      console.log("AI-2 sanity-check raw response:", {
        data,
        error,
        typeOfData: typeof data,
      });

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

      console.log("AI-2 suggestions from response:", suggestions);

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
                      return `⚠️ ${count} suggestion${count > 1 ? "s" : ""}`;
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

// HeadingBlock component - standalone heading without paragraph
interface HeadingBlockProps {
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
}

const HeadingBlock: React.FC<HeadingBlockProps> = ({
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get heading content
  const headingContent = block.content.heading ?? "";

  const handleHeadingChange = (newHeading: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        heading: newHeading,
      },
    });
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
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
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
              onToggleMetadataPanel();
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
            blockContent={block.content.heading ?? ""}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Block Style Menu */}
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
          className="top-14 left-4"
        />

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

        {/* INNER CONTENT COLUMN - Heading only */}
        <BlockWrapper layout={layout}>
          <TipTapEditor
            value={headingContent || "<p>Heading</p>"}
            onChange={handleHeadingChange}
            placeholder="Heading..."
            editorClassName="focus:outline-none text-[40px] font-semibold leading-tight text-gray-800 [&_p]:my-0"
            singleLine={true}
            disableLists={true}
          />
        </BlockWrapper>
      </div>
    </div>
  );
};

// SubheadingBlock component - standalone subheading (smaller than heading)
interface SubheadingBlockProps {
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
}

const SubheadingBlock: React.FC<SubheadingBlockProps> = ({
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get subheading content
  const subheadingContent = block.content.subheading ?? "";

  const handleSubheadingChange = (newSubheading: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        subheading: newSubheading,
      },
    });
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
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
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
              onToggleMetadataPanel();
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
            blockContent={block.content.subheading ?? ""}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Block Style Menu */}
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
          className="top-14 left-4"
        />

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

        {/* INNER CONTENT COLUMN - Subheading only (30px font) */}
        <BlockWrapper layout={layout}>
          <TipTapEditor
            value={subheadingContent || "<p>Subheading</p>"}
            onChange={handleSubheadingChange}
            placeholder="Subheading..."
            editorClassName="focus:outline-none text-[30px] font-semibold leading-tight text-gray-800 [&_p]:my-0"
            singleLine={true}
            disableLists={true}
          />
        </BlockWrapper>
      </div>
    </div>
  );
};

// ColumnsBlock component - two side-by-side rich text columns
interface ColumnsBlockProps {
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
}

const ColumnsBlock: React.FC<ColumnsBlockProps> = ({
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get column contents
  const columnOneContent = block.content.columnOneContent ?? "";
  const columnTwoContent = block.content.columnTwoContent ?? "";

  const handleColumnOneChange = (newContent: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        columnOneContent: newContent,
      },
    });
  };

  const handleColumnTwoChange = (newContent: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        columnTwoContent: newContent,
      },
    });
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
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
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
              onToggleMetadataPanel();
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
            blockContent={
              (block.content.columnOneContent ?? "") +
              (block.content.columnTwoContent ?? "")
            }
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Block Style Menu */}
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
          className="top-14 left-4"
        />

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

        {/* INNER CONTENT - Two columns layout */}
        <BlockWrapper layout={layout}>
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Column 1 */}
            <div className="flex-1 min-w-0">
              <TipTapEditor
                value={
                  columnOneContent ||
                  "<p>Start writing your first column...</p>"
                }
                onChange={handleColumnOneChange}
                placeholder="Start writing your first column..."
              />
            </div>

            {/* Column 2 */}
            <div className="flex-1 min-w-0">
              <TipTapEditor
                value={
                  columnTwoContent ||
                  "<p>Start writing your second column...</p>"
                }
                onChange={handleColumnTwoChange}
                placeholder="Start writing your second column..."
              />
            </div>
          </div>
        </BlockWrapper>
      </div>
    </div>
  );
};

// Default table content for new table blocks
const DEFAULT_TABLE_CONTENT = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Column 1" }],
                },
              ],
            },
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Column 2" }],
                },
              ],
            },
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Column 3" }],
                },
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 1" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 2" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 3" }],
                },
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 4" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 5" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell 6" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// Color palette for table cell backgrounds
const TABLE_CELL_COLORS = [
  "#ffffff", // White
  "#FFF4E6", // Light orange
  "#FFE0B2", // Peach
  "#E8F5E9", // Light green
  "#E3F2FD", // Light blue
  "#F3E5F5", // Light purple
  "#FFEBEE", // Light red
  "#FFF8E1", // Light yellow
];

// Custom TableCell extension with additional attributes
const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-bg-color"),
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            "data-bg-color": attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
      textAlign: {
        default: "left",
        parseHTML: (element) =>
          element.getAttribute("data-text-align") || "left",
        renderHTML: (attributes) => {
          if (!attributes.textAlign || attributes.textAlign === "left")
            return {};
          return {
            "data-text-align": attributes.textAlign,
            style: `text-align: ${attributes.textAlign}`,
          };
        },
      },
      cellStyle: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-cell-style"),
        renderHTML: (attributes) => {
          if (!attributes.cellStyle) return {};
          return {
            "data-cell-style": attributes.cellStyle,
            class: `cell-${attributes.cellStyle}`,
          };
        },
      },
    };
  },
});

// TableBlock component - editable table with TipTap
interface TableBlockProps {
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
}

const TableBlock: React.FC<TableBlockProps> = ({
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showBorderDropdown, setShowBorderDropdown] = useState(false);
  const [showMergeDropdown, setShowMergeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showHeaderColorDropdown, setShowHeaderColorDropdown] = useState(false);
  const [cellAlignment, setCellAlignment] = useState("left");
  const [cellHighlight, setCellHighlight] = useState("normal");
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get table content, border mode, and header color
  const tableContent = block.content.tableContent ?? DEFAULT_TABLE_CONTENT;
  const borderMode = block.content.borderMode ?? "normal";
  const headerColor = block.content.headerColor ?? "#ff6f21"; // Default orange

  // Create TipTap editor with table extensions
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Keep history enabled (default)
      }),
      Table.configure({
        resizable: true,
        lastColumnResizable: true,
        HTMLAttributes: {
          class: `mylms-table table-${borderMode}`,
        },
      }),
      TableRow,
      TableHeader,
      CustomTableCell,
    ],
    content: tableContent,
    onUpdate: ({ editor }) => {
      onChange({
        ...block,
        content: {
          ...block.content,
          tableContent: editor.getJSON(),
        },
      });
    },
  });

  // Handle focus on the table wrapper - show toolbar
  const handleWrapperFocus = () => {
    setShowToolbar(true);
  };

  // Handle blur on the table wrapper - hide toolbar only if focus leaves entirely
  const handleWrapperBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is still within our wrapper
    const wrapper = tableWrapperRef.current;
    const relatedTarget = e.relatedTarget as Node | null;

    if (wrapper && relatedTarget && wrapper.contains(relatedTarget)) {
      // Focus is still within the wrapper, don't hide toolbar
      return;
    }

    // Focus left the wrapper entirely, hide everything
    setShowToolbar(false);
    setShowBorderDropdown(false);
    setShowMergeDropdown(false);
    setShowColorDropdown(false);
    setShowHeaderColorDropdown(false);
  };

  // Handle table click to focus editor
  const handleTableClick = () => {
    if (editor && !editor.isFocused) {
      editor.chain().focus().run();
    }
  };

  // Table toolbar command handlers
  const handleToggleHeaderRow = () => {
    if (!editor) return;
    editor.chain().focus().toggleHeaderRow().run();
  };

  const handleDeleteTable = () => {
    if (!editor) return;
    editor.chain().focus().deleteTable().run();
    onDelete(); // Also delete the block
  };

  const handleAddColumnAfter = () => {
    if (!editor) return;
    editor.chain().focus().addColumnAfter().run();
  };

  const handleAddRowAfter = () => {
    if (!editor) return;
    editor.chain().focus().addRowAfter().run();
  };

  const handleMergeCells = () => {
    if (!editor) return;
    editor.chain().focus().mergeCells().run();
    setShowMergeDropdown(false);
  };

  const handleSplitCell = () => {
    if (!editor) return;
    // splitCell only works on merged cells
    if (editor.can().splitCell()) {
      editor.chain().focus().splitCell().run();
    }
    setShowMergeDropdown(false);
  };

  // Check if split is available (only for merged cells)
  const canSplitCell = editor?.can().splitCell() ?? false;

  const handleSetCellBackgroundColor = (color: string) => {
    if (!editor) return;
    editor.chain().focus().setCellAttribute("backgroundColor", color).run();
    setShowColorDropdown(false);
  };

  const handleSetCellAlignment = (align: string) => {
    if (!editor) return;
    setCellAlignment(align);
    editor.chain().focus().setCellAttribute("textAlign", align).run();
  };

  const handleSetCellHighlight = (style: string) => {
    if (!editor) return;
    setCellHighlight(style);
    editor
      .chain()
      .focus()
      .setCellAttribute("cellStyle", style === "normal" ? null : style)
      .run();
  };

  const handleBorderModeChange = (mode: "normal" | "dashed" | "alternate") => {
    onChange({
      ...block,
      content: {
        ...block.content,
        borderMode: mode,
      },
    });
    setShowBorderDropdown(false);
  };

  // Header color options
  const HEADER_COLOR_OPTIONS = [
    { color: "#ff6f21", label: "Orange" },
    { color: "#3b82f6", label: "Blue" },
    { color: "#10b981", label: "Green" },
    { color: "#8b5cf6", label: "Purple" },
    { color: "#ef4444", label: "Red" },
    { color: "#f59e0b", label: "Amber" },
    { color: "#06b6d4", label: "Cyan" },
    { color: "#ec4899", label: "Pink" },
    { color: "#6b7280", label: "Gray" },
    { color: "#1f2937", label: "Dark" },
  ];

  const handleHeaderColorChange = (color: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        headerColor: color,
      },
    });
    setShowHeaderColorDropdown(false);
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
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
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
              onToggleMetadataPanel();
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
            blockContent=""
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Block Style Menu */}
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
          className="top-14 left-4"
        />

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

        {/* INNER CONTENT - Table with TipTap */}
        <BlockWrapper layout={layout}>
          <div
            ref={tableWrapperRef}
            className="relative"
            tabIndex={-1}
            onFocus={handleWrapperFocus}
            onBlur={handleWrapperBlur}
          >
            {/* Table Toolbar - shows when table is focused */}
            {showToolbar && editor && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-3 py-2 rounded-full bg-white border border-gray-200 shadow-lg">
                {/* Toggle Header Row */}
                <button
                  type="button"
                  onClick={handleToggleHeaderRow}
                  title="Toggle header row"
                  className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors font-semibold text-sm ${
                    editor.isActive("tableHeader")
                      ? "text-[#ff7a00] bg-orange-50"
                      : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                  }`}
                >
                  H
                </button>

                {/* Header Color Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHeaderColorDropdown(!showHeaderColorDropdown);
                      setShowBorderDropdown(false);
                      setShowMergeDropdown(false);
                      setShowColorDropdown(false);
                    }}
                    title="Header row color"
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                      showHeaderColorDropdown
                        ? "text-[#ff7a00] bg-orange-50"
                        : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: headerColor }}
                    />
                  </button>
                  {showHeaderColorDropdown && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-white rounded-lg border border-gray-200 shadow-xl z-30 min-w-[220px]">
                      <div className="grid grid-cols-5 gap-3">
                        {HEADER_COLOR_OPTIONS.map((option) => (
                          <button
                            key={option.color}
                            type="button"
                            className={`w-7 h-7 rounded-full border-2 hover:scale-110 transition-transform ${
                              headerColor === option.color
                                ? "border-gray-800"
                                : "border-gray-300"
                            }`}
                            style={{ backgroundColor: option.color }}
                            onClick={() =>
                              handleHeaderColorChange(option.color)
                            }
                            title={option.label}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span className="w-px h-5 bg-gray-200 mx-1" />

                {/* Delete Table */}
                <button
                  type="button"
                  onClick={handleDeleteTable}
                  title="Delete table"
                  className="inline-flex items-center justify-center h-7 w-7 text-slate-600 hover:text-red-500 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <span className="w-px h-5 bg-gray-200 mx-1" />

                {/* Add Column */}
                <button
                  type="button"
                  onClick={handleAddColumnAfter}
                  title="Add column after"
                  className="inline-flex items-center justify-center h-7 w-7 text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors text-sm"
                >
                  ⋮⋮⋮
                </button>

                {/* Add Row */}
                <button
                  type="button"
                  onClick={handleAddRowAfter}
                  title="Add row after"
                  className="inline-flex items-center justify-center h-7 w-7 text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors text-sm"
                >
                  ≡
                </button>

                <span className="w-px h-5 bg-gray-200 mx-1" />

                {/* Border Style Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBorderDropdown(!showBorderDropdown);
                      setShowMergeDropdown(false);
                      setShowColorDropdown(false);
                      setShowHeaderColorDropdown(false);
                    }}
                    title="Table style"
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                      showBorderDropdown
                        ? "text-[#ff7a00] bg-orange-50"
                        : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                    }`}
                  >
                    🎨
                  </button>
                  {showBorderDropdown && (
                    <div className="absolute top-full left-0 mt-2 py-1 bg-white rounded-lg border border-gray-200 shadow-xl min-w-[160px] z-30">
                      <button
                        type="button"
                        onClick={() => handleBorderModeChange("normal")}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          borderMode === "normal"
                            ? "text-[#ff7a00] font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        Normal borders
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBorderModeChange("dashed")}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          borderMode === "dashed"
                            ? "text-[#ff7a00] font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        Dashed borders
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBorderModeChange("alternate")}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          borderMode === "alternate"
                            ? "text-[#ff7a00] font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        Alternate row shading
                      </button>
                    </div>
                  )}
                </div>

                {/* Merge/Split Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMergeDropdown(!showMergeDropdown);
                      setShowBorderDropdown(false);
                      setShowColorDropdown(false);
                      setShowHeaderColorDropdown(false);
                    }}
                    title="Merge/Split cells"
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                      showMergeDropdown
                        ? "text-[#ff7a00] bg-orange-50"
                        : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                    }`}
                  >
                    ▢
                  </button>
                  {showMergeDropdown && (
                    <div className="absolute top-full left-0 mt-2 py-1 bg-white rounded-lg border border-gray-200 shadow-xl min-w-[140px] z-30">
                      <button
                        type="button"
                        onClick={handleMergeCells}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-slate-50"
                      >
                        Merge cells
                      </button>
                      <button
                        type="button"
                        onClick={handleSplitCell}
                        disabled={!canSplitCell}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          canSplitCell
                            ? "text-gray-700"
                            : "text-gray-400 cursor-not-allowed"
                        }`}
                        title={
                          canSplitCell
                            ? "Split merged cell"
                            : "Only merged cells can be split"
                        }
                      >
                        Split cell{" "}
                        {!canSplitCell && (
                          <span className="text-xs text-gray-400">
                            (merge first)
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Color Picker Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowColorDropdown(!showColorDropdown);
                      setShowBorderDropdown(false);
                      setShowMergeDropdown(false);
                      setShowHeaderColorDropdown(false);
                    }}
                    title="Cell background color"
                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors ${
                      showColorDropdown
                        ? "text-[#ff7a00] bg-orange-50"
                        : "text-slate-600 hover:text-[#ff7a00] hover:bg-slate-50"
                    }`}
                  >
                    💧
                  </button>
                  {showColorDropdown && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-white rounded-lg border border-gray-200 shadow-xl z-30">
                      <div className="flex gap-1">
                        {TABLE_CELL_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => handleSetCellBackgroundColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span className="w-px h-5 bg-gray-200 mx-1" />

                {/* Alignment Select */}
                <select
                  className="h-7 px-2 text-xs border border-gray-200 rounded-full bg-gray-50 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#ff7a00]"
                  value={cellAlignment}
                  onChange={(e) => handleSetCellAlignment(e.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>

                {/* Highlight Select */}
                <select
                  className="h-7 px-2 text-xs border border-gray-200 rounded-full bg-gray-50 text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#ff7a00]"
                  value={cellHighlight}
                  onChange={(e) => handleSetCellHighlight(e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="highlight">Highlight</option>
                  <option value="thick">Thick border</option>
                </select>
              </div>
            )}

            {/* TipTap Table Editor */}
            <div
              className={`overflow-x-auto mylms-table-container table-${borderMode}`}
              style={{ "--header-color": headerColor } as React.CSSProperties}
              onClick={handleTableClick}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </BlockWrapper>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// OrderedListControlsBar - Modern icon controls for ordered list settings
// ---------------------------------------------------------------------------

interface OrderedListControlsBarProps {
  startNumber: number;
  listStyle: OrderedListStyle;
  subStyle: OrderedListStyle;
  onStartNumberChange: (value: number) => void;
  onListStyleChange: (style: OrderedListStyle) => void;
  onSubStyleChange: (style: OrderedListStyle) => void;
}

const OrderedListControlsBar: React.FC<OrderedListControlsBarProps> = ({
  startNumber,
  listStyle,
  subStyle,
  onStartNumberChange,
  onListStyleChange,
  onSubStyleChange,
}) => {
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [stylePopoverOpen, setStylePopoverOpen] = useState(false);
  const [subStylePopoverOpen, setSubStylePopoverOpen] = useState(false);

  const startRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const subStyleRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (startRef.current && !startRef.current.contains(e.target as Node)) {
        setStartPopoverOpen(false);
      }
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) {
        setStylePopoverOpen(false);
      }
      if (
        subStyleRef.current &&
        !subStyleRef.current.contains(e.target as Node)
      ) {
        setSubStylePopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStartPopoverOpen(false);
        setStylePopoverOpen(false);
        setSubStylePopoverOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const chipClass =
    "relative flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 cursor-pointer hover:bg-gray-200 transition text-gray-700 select-none";
  const iconClass = "h-4 w-4 text-gray-500";
  const labelClass = "text-sm font-medium text-gray-700";

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Start At Control */}
      <div ref={startRef} className="relative">
        <button
          type="button"
          onClick={() => setStartPopoverOpen(!startPopoverOpen)}
          className={chipClass}
          aria-label="Change start number"
          aria-expanded={startPopoverOpen}
        >
          <Hash className={iconClass} />
          <span className={labelClass}>{startNumber}</span>
        </button>

        {startPopoverOpen && (
          <div className="absolute z-50 mt-1 left-0 rounded-lg bg-white shadow-lg border border-gray-200 p-3 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Start numbering at
            </label>
            <input
              type="number"
              min={1}
              value={startNumber}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onStartNumberChange(val >= 1 ? val : 1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") setStartPopoverOpen(false);
              }}
              autoFocus
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        )}
      </div>

      {/* Style Control (Level 1) */}
      <div ref={styleRef} className="relative">
        <button
          type="button"
          onClick={() => setStylePopoverOpen(!stylePopoverOpen)}
          className={chipClass}
          aria-label="Change list style"
          aria-expanded={stylePopoverOpen}
        >
          <ListOrdered className={iconClass} />
          <span className={labelClass}>{getStyleLabel(listStyle)}</span>
        </button>

        {stylePopoverOpen && (
          <div className="absolute z-50 mt-1 left-0 rounded-lg bg-white shadow-lg border border-gray-200 p-2 min-w-[160px]">
            <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">
              List style
            </div>
            {LIST_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onListStyleChange(option.value);
                  setStylePopoverOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 transition ${
                  option.value === listStyle
                    ? "bg-orange-50 text-orange-700 font-semibold"
                    : "text-gray-700"
                }`}
              >
                <span>{option.label}</span>
                <span className="text-xs text-gray-400">{option.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sub-Style Control (Level 2) */}
      <div ref={subStyleRef} className="relative">
        <button
          type="button"
          onClick={() => setSubStylePopoverOpen(!subStylePopoverOpen)}
          className={chipClass}
          aria-label="Change sub-list style"
          aria-expanded={subStylePopoverOpen}
        >
          <IndentIncrease className={iconClass} />
          <span className={labelClass}>{getStyleLabel(subStyle)}</span>
        </button>

        {subStylePopoverOpen && (
          <div className="absolute z-50 mt-1 left-0 rounded-lg bg-white shadow-lg border border-gray-200 p-2 min-w-[160px]">
            <div className="text-xs font-medium text-gray-500 px-2 py-1 mb-1">
              Sub-list style
            </div>
            {LIST_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onSubStyleChange(option.value);
                  setSubStylePopoverOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 transition ${
                  option.value === subStyle
                    ? "bg-orange-50 text-orange-700 font-semibold"
                    : "text-gray-700"
                }`}
              >
                <span>{option.label}</span>
                <span className="text-xs text-gray-400">{option.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// OrderedListBlock component - Editor for ordered list blocks
// ---------------------------------------------------------------------------

interface NumberedListBlockProps {
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
}

const NumberedListBlock: React.FC<NumberedListBlockProps> = ({
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  // Toggle for style target: 'background' or 'numbers'
  const [styleTarget, setStyleTarget] = useState<"background" | "numbers">(
    "background"
  );

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get list items from content, or default to one empty item
  const listItems: NumberedListItem[] = block.content.listItems ?? [
    { body: "<p>List item content...</p>" },
  ];
  const startNumber = block.content.startNumber ?? 1;
  const listStyle = block.content.listStyle ?? "decimal";
  const subStyle = block.content.subStyle ?? "lower-alpha";
  const numberColor = block.content.numberColor ?? "#f97316"; // Default orange-500

  // Helper to update the entire listItems array
  const updateListItems = (newItems: NumberedListItem[]) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        listItems: newItems,
      },
    });
  };

  // Update a top-level item's body
  const handleItemChange = (index: number, value: string) => {
    const updatedItems = [...listItems];
    updatedItems[index] = { ...updatedItems[index], body: value };
    updateListItems(updatedItems);
  };

  // Update a child item's body
  const handleChildChange = (
    parentIndex: number,
    childIndex: number,
    value: string
  ) => {
    const updatedItems = [...listItems];
    const parent = updatedItems[parentIndex];
    const children = [...(parent.children ?? [])];
    children[childIndex] = { ...children[childIndex], body: value };
    updatedItems[parentIndex] = { ...parent, children };
    updateListItems(updatedItems);
  };

  // Add a new top-level list item
  const handleAddItem = () => {
    updateListItems([...listItems, { body: "<p>New item...</p>" }]);
  };

  // Remove a top-level list item (and its children)
  const handleRemoveItem = (index: number) => {
    if (listItems.length <= 1) return; // Keep at least one item
    updateListItems(listItems.filter((_, i) => i !== index));
  };

  // Remove a child item
  const handleRemoveChild = (parentIndex: number, childIndex: number) => {
    const updatedItems = [...listItems];
    const parent = updatedItems[parentIndex];
    const children = (parent.children ?? []).filter((_, i) => i !== childIndex);
    updatedItems[parentIndex] = {
      ...parent,
      children: children.length > 0 ? children : undefined,
    };
    updateListItems(updatedItems);
  };

  // Indent a top-level item (move it into previous item's children)
  const handleIndent = (index: number) => {
    // Can't indent the first item (no previous sibling)
    if (index === 0) return;

    const updatedItems = [...listItems];
    const itemToIndent = updatedItems[index];
    const previousItem = updatedItems[index - 1];

    // Remove from top level
    updatedItems.splice(index, 1);

    // Add to previous item's children
    const previousChildren = previousItem.children ?? [];
    updatedItems[index - 1] = {
      ...previousItem,
      children: [...previousChildren, { body: itemToIndent.body }],
    };

    updateListItems(updatedItems);
  };

  // Outdent a child item (move it to top level after its parent)
  const handleOutdent = (parentIndex: number, childIndex: number) => {
    const updatedItems = [...listItems];
    const parent = updatedItems[parentIndex];
    const children = parent.children ?? [];
    const childToOutdent = children[childIndex];

    // Remove from parent's children
    const newChildren = children.filter((_, i) => i !== childIndex);
    updatedItems[parentIndex] = {
      ...parent,
      children: newChildren.length > 0 ? newChildren : undefined,
    };

    // Insert after parent in top-level items
    updatedItems.splice(parentIndex + 1, 0, { body: childToOutdent.body });

    updateListItems(updatedItems);
  };

  // Update start number
  const handleStartNumberChange = (value: number) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        startNumber: Math.max(1, value),
      },
    });
  };

  // Update level-1 list style
  const handleListStyleChange = (style: OrderedListStyle) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        listStyle: style,
      },
    });
  };

  // Update level-2 (sub) list style
  const handleSubStyleChange = (style: OrderedListStyle) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        subStyle: style,
      },
    });
  };

  // Update number badge color (for editor visual only)
  const handleNumberColorChange = (color: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        numberColor: color,
      },
    });
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

          {/* Metadata */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMetadataPanel();
            }}
            aria-label="Block metadata"
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isMetadataPanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : blockHasMetadata
                ? "text-green-600 bg-green-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
          >
            <Database className="h-4 w-4" />
          </button>

          {/* Animation */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAppearancePanel();
            }}
            title="Block animation"
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
                ? "text-purple-600 bg-purple-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
          >
            <Stars className="h-4 w-4" />
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

          {(canMoveUp || canMoveDown) && (
            <span className="w-px h-4 bg-gray-200 mx-1" />
          )}

          {/* Duplicate */}
          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate block"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete block"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-slate-50 rounded-full transition-colors"
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
            blockContent={listItems.map((item) => item.body).join(" ")}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Custom Style Menu for Ordered List - includes toggle for background vs numbers */}
        {styleMenuOpen && (
          <div className="absolute top-14 left-4 z-40 rounded-xl border border-gray-200 bg-white shadow-xl w-[300px] text-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="font-medium text-gray-900">Style</div>
              <button
                type="button"
                onClick={() => setStyleMenuOpen(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Toggle: Background vs Numbers */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Apply color to
              </div>
              <div className="flex rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setStyleTarget("background")}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    styleTarget === "background"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Background
                </button>
                <button
                  type="button"
                  onClick={() => setStyleTarget("numbers")}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    styleTarget === "numbers"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Numbers
                </button>
              </div>
            </div>

            {/* Color options */}
            <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Color
            </div>
            <div className="px-3 pb-3 space-y-2">
              {/* Preset colors */}
              {[
                {
                  value: "light",
                  label: "Light",
                  bg: "bg-gray-50",
                  color: "#f9fafb",
                },
                {
                  value: "gray",
                  label: "Gray",
                  bg: "bg-gray-200",
                  color: "#e5e7eb",
                },
                {
                  value: "theme",
                  label: "Theme",
                  bg: "bg-[#ff7a1a]",
                  color: "#ff7a1a",
                },
                {
                  value: "themeTint",
                  label: "Theme tint",
                  bg: "bg-[#FFE2CC]",
                  color: "#FFE2CC",
                },
                {
                  value: "dark",
                  label: "Dark",
                  bg: "bg-neutral-800",
                  color: "#262626",
                },
                {
                  value: "black",
                  label: "Black",
                  bg: "bg-black",
                  color: "#000000",
                },
              ].map((option) => {
                const isActive =
                  styleTarget === "background"
                    ? option.value === block.style
                    : option.color === numberColor;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (styleTarget === "background") {
                        onStyleChange(
                          option.value as BlockStyle,
                          block.customBackgroundColor
                        );
                      } else {
                        handleNumberColorChange(option.color);
                      }
                      setStyleMenuOpen(false);
                    }}
                    className={`
                      flex w-full items-center justify-between rounded-lg px-3 py-2
                      text-left transition
                      ${
                        isActive
                          ? "ring-1 ring-[#ff7a1a] bg-orange-50"
                          : "hover:bg-gray-50"
                      }
                    `}
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {option.label}
                    </span>
                    <div
                      className={`ml-3 h-6 w-16 rounded-md border border-gray-200/70 ${option.bg}`}
                    />
                  </button>
                );
              })}

              {/* Custom color option */}
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      Custom
                    </span>
                    <span className="block text-xs text-gray-500">
                      Choose any colour
                    </span>
                  </div>
                  <input
                    type="color"
                    value={
                      styleTarget === "background"
                        ? block.customBackgroundColor || "#ffffff"
                        : numberColor
                    }
                    onChange={(e) => {
                      if (styleTarget === "background") {
                        onStyleChange("custom", e.target.value);
                      } else {
                        handleNumberColorChange(e.target.value);
                      }
                    }}
                    className="h-8 w-12 rounded border border-gray-300 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
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

        {/* INNER CONTENT */}
        <BlockWrapper layout={layout}>
          {/* Modern Inline Icon Controls Bar */}
          <OrderedListControlsBar
            startNumber={startNumber}
            listStyle={listStyle}
            subStyle={subStyle}
            onStartNumberChange={handleStartNumberChange}
            onListStyleChange={handleListStyleChange}
            onSubStyleChange={handleSubStyleChange}
          />

          {/* List items - with nested support */}
          <div className="space-y-3">
            {listItems.map((item, index) => {
              const number = startNumber + index;
              const marker = getListMarker(number, listStyle);
              const canIndent = index > 0; // Can indent if not first item

              return (
                <div key={index}>
                  {/* Top-level item */}
                  <div className="group flex items-start gap-3">
                    {/* Orange marker badge */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white font-semibold text-sm"
                      style={{ backgroundColor: numberColor }}
                      aria-hidden="true"
                    >
                      {marker}
                    </div>

                    {/* Content editor */}
                    <div className="flex-1 min-w-0">
                      <TipTapEditor
                        value={item.body || "<p>Item content...</p>"}
                        onChange={(newHtml) => handleItemChange(index, newHtml)}
                        placeholder="Item content..."
                      />
                    </div>

                    {/* Action buttons (appear on hover) */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      {/* Indent button */}
                      <button
                        type="button"
                        onClick={() => handleIndent(index)}
                        disabled={!canIndent}
                        aria-label="Indent item"
                        title="Indent (make sub-item)"
                        className={`inline-flex items-center justify-center h-6 w-6 rounded transition ${
                          canIndent
                            ? "text-gray-400 hover:text-[#ff7a00] hover:bg-gray-100"
                            : "text-gray-200 cursor-not-allowed"
                        }`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>

                      {/* Delete button */}
                      {listItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          aria-label="Delete item"
                          title="Delete item"
                          className="inline-flex items-center justify-center h-6 w-6 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nested children (level 2) */}
                  {item.children && item.children.length > 0 && (
                    <div className="ml-12 mt-2 space-y-2">
                      {item.children.map((child, childIndex) => {
                        const childMarker = getListMarker(
                          childIndex + 1,
                          subStyle
                        );
                        return (
                          <div
                            key={childIndex}
                            className="group/child flex items-start gap-3"
                          >
                            {/* Child marker badge (smaller, lighter) */}
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white font-medium text-xs"
                              style={{
                                backgroundColor: numberColor,
                                opacity: 0.7,
                              }}
                              aria-hidden="true"
                            >
                              {childMarker}
                            </div>

                            {/* Child content editor */}
                            <div className="flex-1 min-w-0">
                              <TipTapEditor
                                value={child.body || "<p>Sub-item...</p>"}
                                onChange={(newHtml) =>
                                  handleChildChange(index, childIndex, newHtml)
                                }
                                placeholder="Sub-item content..."
                              />
                            </div>

                            {/* Child action buttons */}
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/child:opacity-100 transition">
                              {/* Outdent button */}
                              <button
                                type="button"
                                onClick={() => handleOutdent(index, childIndex)}
                                aria-label="Outdent item"
                                title="Outdent (move to top level)"
                                className="inline-flex items-center justify-center h-6 w-6 rounded text-gray-400 hover:text-[#ff7a00] hover:bg-gray-100 transition"
                              >
                                <ArrowLeft className="h-4 w-4" />
                              </button>

                              {/* Delete child button */}
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveChild(index, childIndex)
                                }
                                aria-label="Delete sub-item"
                                title="Delete sub-item"
                                className="inline-flex items-center justify-center h-6 w-6 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add item button */}
          <button
            type="button"
            onClick={handleAddItem}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-dashed border-gray-300"
          >
            <Plus className="h-4 w-4" />
            Add item
          </button>
        </BlockWrapper>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// BulletListBlock component - Editor for bullet list blocks
// ---------------------------------------------------------------------------

interface BulletListBlockProps {
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
}

const BulletListBlock: React.FC<BulletListBlockProps> = ({
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get list items from content, or default to one empty item
  const bulletItems: BulletListItem[] = block.content.bulletItems ?? [
    { body: "<p>Bullet point content...</p>" },
  ];
  const bulletColor = block.content.bulletColor ?? "#f97316"; // Default orange-500

  // Helper to update the entire bulletItems array
  const updateBulletItems = (newItems: BulletListItem[]) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        bulletItems: newItems,
      },
    });
  };

  // Update a top-level item's body
  const handleItemChange = (index: number, value: string) => {
    const updatedItems = [...bulletItems];
    updatedItems[index] = { ...updatedItems[index], body: value };
    updateBulletItems(updatedItems);
  };

  // Update a child item's body
  const handleChildChange = (
    parentIndex: number,
    childIndex: number,
    value: string
  ) => {
    const updatedItems = [...bulletItems];
    const parent = updatedItems[parentIndex];
    const children = [...(parent.children ?? [])];
    children[childIndex] = { ...children[childIndex], body: value };
    updatedItems[parentIndex] = { ...parent, children };
    updateBulletItems(updatedItems);
  };

  // Add a new top-level item
  const handleAddItem = () => {
    updateBulletItems([...bulletItems, { body: "<p>New bullet point...</p>" }]);
  };

  // Remove a top-level item
  const handleRemoveItem = (index: number) => {
    if (bulletItems.length <= 1) return; // Keep at least one item
    const updatedItems = bulletItems.filter((_, i) => i !== index);
    updateBulletItems(updatedItems);
  };

  // Add a child item to a parent
  const handleAddChild = (parentIndex: number) => {
    const updatedItems = [...bulletItems];
    const parent = updatedItems[parentIndex];
    const children = parent.children ?? [];
    updatedItems[parentIndex] = {
      ...parent,
      children: [...children, { body: "<p>Sub-item...</p>" }],
    };
    updateBulletItems(updatedItems);
  };

  // Remove a child item
  const handleRemoveChild = (parentIndex: number, childIndex: number) => {
    const updatedItems = [...bulletItems];
    const parent = updatedItems[parentIndex];
    const children = (parent.children ?? []).filter((_, i) => i !== childIndex);
    updatedItems[parentIndex] = {
      ...parent,
      children: children.length > 0 ? children : undefined,
    };
    updateBulletItems(updatedItems);
  };

  // Indent a top-level item (make it a child of the previous item)
  const handleIndent = (index: number) => {
    if (index === 0) return; // Can't indent first item
    const updatedItems = [...bulletItems];
    const itemToIndent = updatedItems[index];
    const previousItem = updatedItems[index - 1];

    // Remove from top level
    updatedItems.splice(index, 1);

    // Add to previous item's children
    const previousChildren = previousItem.children ?? [];
    updatedItems[index - 1] = {
      ...previousItem,
      children: [...previousChildren, { body: itemToIndent.body }],
    };

    updateBulletItems(updatedItems);
  };

  // Outdent a child item (move it to top level after its parent)
  const handleOutdent = (parentIndex: number, childIndex: number) => {
    const updatedItems = [...bulletItems];
    const parent = updatedItems[parentIndex];
    const children = parent.children ?? [];
    const childToOutdent = children[childIndex];

    // Remove from parent's children
    const newChildren = children.filter((_, i) => i !== childIndex);
    updatedItems[parentIndex] = {
      ...parent,
      children: newChildren.length > 0 ? newChildren : undefined,
    };

    // Insert after parent in top-level items
    updatedItems.splice(parentIndex + 1, 0, { body: childToOutdent.body });

    updateBulletItems(updatedItems);
  };

  // Update bullet color
  const handleBulletColorChange = (color: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        bulletColor: color,
      },
    });
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
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
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
              onToggleMetadataPanel();
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
          style={block.style}
          customBackgroundColor={block.customBackgroundColor}
          onChange={(newStyle, customColor) => {
            onStyleChange(newStyle, customColor);
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
            onLayoutChange={onLayoutChange}
            onClose={onToggleFormatPanel}
          />
        )}

        {/* Appearance Panel */}
        {isAppearancePanelOpen && (
          <AppearancePanel
            animation={(block.content.animation as BlockAnimation) || "none"}
            duration={
              (block.content.animationDuration as AnimationDuration) || "normal"
            }
            onChange={onAnimationChange}
            onDurationChange={onDurationChange}
            onClose={onToggleAppearancePanel}
          />
        )}

        {/* Metadata Panel */}
        {isMetadataPanelOpen && (
          <BlockMetadataPopover
            metadata={block.metadata || DEFAULT_BLOCK_METADATA}
            onChange={onMetadataChange}
            onClose={onToggleMetadataPanel}
            blockId={block.id}
            blockType={block.type}
            blockContent={block.content}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* INNER CONTENT */}
        <BlockWrapper layout={layout}>
          {/* Bullet color picker */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
            <span className="text-xs font-medium text-gray-500">
              Bullet color:
            </span>
            <input
              type="color"
              value={bulletColor}
              onChange={(e) => handleBulletColorChange(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-gray-300"
            />
          </div>

          {/* List items */}
          <div className="space-y-3">
            {bulletItems.map((item, index) => {
              const canIndent = index > 0; // Can indent if not first item

              return (
                <div key={index}>
                  {/* Top-level item */}
                  <div className="group/item flex items-start gap-3">
                    {/* Bullet marker */}
                    <div
                      className="flex h-4 w-4 mt-3 shrink-0 rounded-full"
                      style={{ backgroundColor: bulletColor }}
                    />

                    {/* Editable content */}
                    <div className="flex-1 min-w-0">
                      <TipTapEditor
                        content={item.body}
                        onChange={(val) => handleItemChange(index, val)}
                        className="prose prose-sm max-w-none [&>p]:m-0"
                        placeholder="Bullet point content..."
                      />
                    </div>

                    {/* Item actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      {canIndent && (
                        <button
                          type="button"
                          onClick={() => handleIndent(index)}
                          title="Indent (make sub-item)"
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        >
                          <IndentIncrease className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAddChild(index)}
                        title="Add sub-item"
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      {bulletItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          title="Remove item"
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nested children (level 2) */}
                  {item.children && item.children.length > 0 && (
                    <div className="ml-7 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
                      {item.children.map((child, childIndex) => (
                        <div
                          key={childIndex}
                          className="group/child flex items-start gap-3"
                        >
                          {/* Child bullet marker (smaller) */}
                          <div
                            className="flex h-3 w-3 mt-3 shrink-0 rounded-full opacity-70"
                            style={{ backgroundColor: bulletColor }}
                          />

                          {/* Child content */}
                          <div className="flex-1 min-w-0">
                            <TipTapEditor
                              content={child.body}
                              onChange={(val) =>
                                handleChildChange(index, childIndex, val)
                              }
                              className="prose prose-sm max-w-none [&>p]:m-0 text-gray-700"
                              placeholder="Sub-item content..."
                            />
                          </div>

                          {/* Child actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover/child:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleOutdent(index, childIndex)}
                              title="Outdent (move to top level)"
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveChild(index, childIndex)
                              }
                              title="Remove sub-item"
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add item button */}
          <button
            type="button"
            onClick={handleAddItem}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-dashed border-gray-300"
          >
            <Plus className="h-4 w-4" />
            Add item
          </button>
        </BlockWrapper>
      </div>
    </div>
  );
};

// ParagraphBlock component
interface ParagraphBlockProps {
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
}

const ParagraphBlock: React.FC<ParagraphBlockProps> = ({
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get initial HTML content
  const initialHtml =
    block.content.html && block.content.html.trim().length > 0
      ? block.content.html
      : "<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>";

  const handleContentChange = (newHtml: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        html: newHtml,
      },
    });
  };

  // Compute inline background color for custom style
  const inlineBackgroundColor =
    block.style === "custom" && block.customBackgroundColor
      ? block.customBackgroundColor
      : undefined;

  // Use block layout or fallback to defaults
  const layout = block.layout || DEFAULT_BLOCK_LAYOUT;

  return (
    /**
     * OUTER WRAPPER with group for hover effects
     */
    <div className="w-full group">
      {/**
       * BLOCK CONTAINER – full width, styled background
       * Smooth transition when style changes
       */}
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
        {/* LEFT GUTTER TOOLBAR – floats outside the content area */}
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

          {/* Style (palette) - opens BlockStyleMenu */}
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
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
                ? "text-purple-500 bg-purple-50"
                : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
            }`}
            title="Block animation"
          >
            <Stars className="h-4 w-4" />
          </button>

          {/* Block metadata (learning fingerprint) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMetadataPanel();
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
            {/* Indicator dot when metadata is set */}
            {blockHasMetadata && !isMetadataPanelOpen && (
              <span
                className="pointer-events-none absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#ff7a00] ring-2 ring-white shadow-sm"
                aria-hidden="true"
              />
            )}
          </button>
        </div>

        {/* RIGHT GUTTER TOOLBAR – for move/duplicate/delete actions */}
        <div className="absolute right-4 top-6 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Move Up - only shown if not first block */}
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

          {/* Move Down - only shown if not last block */}
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

          {/* Duplicate */}
          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate block"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
          >
            <Copy className="h-4 w-4" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete block"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-red-500 hover:bg-slate-50 rounded-full transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Format Panel – positioned relative to the block */}
        {isFormatPanelOpen && (
          <FormatPanel
            layout={layout}
            onChange={onLayoutChange}
            onClose={onToggleFormatPanel}
          />
        )}

        {/* Metadata Panel – positioned relative to the block */}
        {isMetadataPanelOpen && (
          <BlockMetadataPopover
            metadata={block.metadata}
            onChange={onMetadataChange}
            onClose={onToggleMetadataPanel}
            blockId={block.id}
            blockType={block.type}
            blockContent={block.content.html ?? ""}
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Block Style Menu – positioned relative to the block */}
        <BlockStyleMenu
          open={styleMenuOpen}
          onClose={() => setStyleMenuOpen(false)}
          style={block.style}
          customBackgroundColor={block.customBackgroundColor}
          onChange={(newStyle, customColor) => {
            onStyleChange(newStyle, customColor);
            // Don't close menu when selecting custom - let the color picker handle it
            if (newStyle !== "custom") {
              setStyleMenuOpen(false);
            }
          }}
          className="top-14 left-4"
        />

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

        {/**
         * INNER CONTENT COLUMN
         * Uses BlockWrapper for layout-based width and padding
         */}
        <BlockWrapper layout={layout}>
          <TipTapEditor
            value={initialHtml}
            onChange={handleContentChange}
            placeholder="Start writing your paragraph..."
          />
        </BlockWrapper>
      </div>
    </div>
  );
};

// ParagraphWithHeadingBlock component
interface ParagraphWithHeadingBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onMetadataChange: (metadata: BlockMetadata) => void;
  onMblMetadataCleared: () => void;
  onMblMetadataUpdated: (mblMetadata: unknown) => void;
  onAnimationChange: (animation: BlockAnimation) => void;
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
  onDurationChange: (duration: AnimationDuration) => void;
}

const ParagraphWithHeadingBlock: React.FC<ParagraphWithHeadingBlockProps> = ({
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get heading content
  const headingContent = block.content.heading ?? "";

  // Get initial HTML content for paragraph
  const initialHtml =
    block.content.html && block.content.html.trim().length > 0
      ? block.content.html
      : "<p>Start writing your paragraph...</p>";

  const handleHeadingChange = (newHeading: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        heading: newHeading,
      },
    });
  };

  const handleContentChange = (newHtml: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        html: newHtml,
      },
    });
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
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
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
              onToggleMetadataPanel();
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

        {/* Format Panel */}
        {isFormatPanelOpen && (
          <FormatPanel
            layout={layout}
            onChange={onLayoutChange}
            onClose={onToggleFormatPanel}
          />
        )}

        {/* Appearance Panel */}
        {isAppearancePanelOpen && (
          <AppearancePanel
            animation={block.content.animation ?? "none"}
            duration={block.content.animationDuration ?? "normal"}
            onChange={onAnimationChange}
            onDurationChange={onDurationChange}
            onClose={onToggleAppearancePanel}
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
            blockContent={
              (block.content.heading ?? "") + (block.content.html ?? "")
            }
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Block Style Menu */}
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
          className="top-14 left-4"
        />

        {/* INNER CONTENT COLUMN */}
        <BlockWrapper layout={layout}>
          {/* Heading Editor - TipTap with large font styling */}
          <div className="mb-4">
            <TipTapEditor
              value={headingContent || "<p>Heading</p>"}
              onChange={handleHeadingChange}
              placeholder="Heading..."
              editorClassName="focus:outline-none text-[40px] font-semibold leading-tight text-gray-800 [&_p]:my-0"
              singleLine={true}
              disableLists={true}
            />
          </div>

          {/* Paragraph Editor */}
          <TipTapEditor
            value={initialHtml}
            onChange={handleContentChange}
            placeholder="Start writing your paragraph..."
          />
        </BlockWrapper>
      </div>
    </div>
  );
};

// ParagraphWithSubheadingBlock component - similar to ParagraphWithHeadingBlock but with smaller subheading
interface ParagraphWithSubheadingBlockProps {
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
}

const ParagraphWithSubheadingBlock: React.FC<
  ParagraphWithSubheadingBlockProps
> = ({
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
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Check if this block has metadata set
  const blockHasMetadata = hasBlockMetadata(block.metadata);

  // Get subheading content
  const subheadingContent = block.content.subheading ?? "";

  // Get initial HTML content for paragraph
  const initialHtml =
    block.content.html && block.content.html.trim().length > 0
      ? block.content.html
      : "<p>Start writing your paragraph...</p>";

  const handleSubheadingChange = (newSubheading: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        subheading: newSubheading,
      },
    });
  };

  const handleContentChange = (newHtml: string) => {
    onChange({
      ...block,
      content: {
        ...block.content,
        html: newHtml,
      },
    });
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
              onToggleAppearancePanel();
            }}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              isAppearancePanelOpen
                ? "text-[#ff7a00] bg-orange-50"
                : block.content.animation && block.content.animation !== "none"
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
              onToggleMetadataPanel();
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
            blockContent={
              (block.content.subheading ?? "") + (block.content.html ?? "")
            }
            savedToDb={block.savedToDb}
            mblMetadata={block.mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        {/* Block Style Menu */}
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
          className="top-14 left-4"
        />

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

        {/* INNER CONTENT COLUMN */}
        <BlockWrapper layout={layout}>
          {/* Subheading Editor - TipTap with 30px font styling (smaller than heading) */}
          <div className="mb-4">
            <TipTapEditor
              value={subheadingContent || "<p>Subheading</p>"}
              onChange={handleSubheadingChange}
              placeholder="Subheading..."
              editorClassName="focus:outline-none text-[30px] font-semibold leading-tight text-gray-800 [&_p]:my-0"
              singleLine={true}
              disableLists={true}
            />
          </div>

          {/* Paragraph Editor */}
          <TipTapEditor
            value={initialHtml}
            onChange={handleContentChange}
            placeholder="Start writing your paragraph..."
          />
        </BlockWrapper>
      </div>
    </div>
  );
};

// BlockHoverWrapper - wraps blocks for hover tracking
interface BlockHoverWrapperProps {
  children: React.ReactNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const BlockHoverWrapper: React.FC<BlockHoverWrapperProps> = ({
  children,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </div>
  );
};

// InsertionHandle - the "+" button that appears between blocks
interface InsertionHandleProps {
  index: number;
  aboveBlockId: string;
  belowBlockId: string;
  hoveredBlockId: string | null;
  hoveredInsertIndex: number | null;
  setHoveredInsertIndex: (index: number | null) => void;
  onInsertClick: (index: number) => void;
}

const InsertionHandle: React.FC<InsertionHandleProps> = ({
  index,
  aboveBlockId,
  belowBlockId,
  hoveredBlockId,
  hoveredInsertIndex,
  setHoveredInsertIndex,
  onInsertClick,
}) => {
  // Show when hovering the block above, below, OR the handle itself
  const isVisible =
    hoveredBlockId === aboveBlockId ||
    hoveredBlockId === belowBlockId ||
    hoveredInsertIndex === index;

  return (
    <div className="relative h-0 w-full">
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <button
          type="button"
          onClick={() => onInsertClick(index)}
          onMouseEnter={() => setHoveredInsertIndex(index)}
          onMouseLeave={() => setHoveredInsertIndex(null)}
          className={`
            h-9 w-9 rounded-full bg-slate-900 text-white 
            flex items-center justify-center shadow-lg
            hover:bg-slate-800 hover:scale-110
            transition-all duration-150
            ${
              isVisible
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }
          `}
          aria-label="Insert block here"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

// Block Library types and data
type BlockCategoryId =
  | "text"
  | "statement"
  | "quote"
  | "list"
  | "image"
  | "gallery"
  | "multimedia"
  | "interactive"
  | "knowledge_check"
  | "chart"
  | "divider"
  | "block_templates"
  | "code";

type BlockTemplate = {
  id: string;
  title: string;
  description: string;
};

const BLOCK_LIBRARY_CATEGORIES: { id: BlockCategoryId; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "statement", label: "Statement" },
  { id: "quote", label: "Quote" },
  { id: "list", label: "List" },
  { id: "image", label: "Image" },
  { id: "gallery", label: "Gallery" },
  { id: "multimedia", label: "Multimedia" },
  { id: "interactive", label: "Interactive" },
  { id: "knowledge_check", label: "Knowledge Check" },
  { id: "chart", label: "Chart" },
  { id: "divider", label: "Divider" },
  { id: "block_templates", label: "Block Templates" },
  { id: "code", label: "Code" },
];

const TEXT_TEMPLATES: BlockTemplate[] = [
  {
    id: "heading",
    title: "Heading",
    description: "Add a standalone heading to introduce a section or topic.",
  },
  {
    id: "subheading",
    title: "Subheading",
    description: "Insert a standalone subheading to organise your content.",
  },
  {
    id: "paragraph",
    title: "Paragraph",
    description: "Write free-form text with a simple paragraph block.",
  },
  {
    id: "paragraph_heading",
    title: "Paragraph with heading",
    description: "Add a heading above your paragraph to introduce the topic.",
  },
  {
    id: "paragraph_subheading",
    title: "Paragraph with subheading",
    description: "Use a smaller subheading to add structure to your content.",
  },
  {
    id: "columns",
    title: "Columns",
    description:
      "Display text in multiple columns for comparison or summaries.",
  },
  {
    id: "table",
    title: "Table",
    description: "Organise text into a simple table layout.",
  },
];

// Templates for the List category
const LIST_TEMPLATES: BlockTemplate[] = [
  {
    id: "numbered_list",
    title: "Ordered List",
    description:
      "Create an ordered list with optional titles and rich text content for each item.",
  },
  {
    id: "bullet_list",
    title: "Bullet List",
    description:
      "Create a bullet point list with rich text content for each item.",
  },
];

const LessonBuilder: React.FC = () => {
  const { moduleId, pageId } = useParams<{
    moduleId: string;
    pageId: string;
  }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<LessonPage | null>(null);
  const [loading, setLoading] = useState(true);

  // Author state (from authenticated user)
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorInitials, setAuthorInitials] = useState<string>("?");

  // Block Library panel state
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<BlockCategoryId | null>(null);

  // Blocks state
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);

  // Format panel state - tracks which block's format panel is open
  const [openFormatBlockId, setOpenFormatBlockId] = useState<string | null>(
    null
  );

  // Metadata panel state - tracks which block's metadata panel is open
  const [openMetadataBlockId, setOpenMetadataBlockId] = useState<string | null>(
    null
  );

  // Appearance panel state - tracks which block's appearance panel is open
  const [openAppearanceBlockId, setOpenAppearanceBlockId] = useState<
    string | null
  >(null);

  // Hover state - tracks which block is currently hovered (for insertion handles)
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  // Hover state - tracks which insertion handle is being hovered
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(
    null
  );

  // Pending insertion index - where to insert the next block when selected from Block Library
  const [pendingInsertIndex, setPendingInsertIndex] = useState<number | null>(
    null
  );

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const initialLoadComplete = useRef(false);

  useEffect(() => {
    const loadPageAndUser = async () => {
      if (!pageId) {
        setLoading(false);
        return;
      }

      // Load lesson page
      const { data, error } = await supabase
        .from("content_module_pages")
        .select("id, title")
        .eq("id", pageId)
        .single();

      if (error) {
        console.error("Error loading lesson page", error);
      } else {
        setPage(data as LessonPage);
      }

      // Load user profile for author display
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", user.id)
          .single();

        let displayName = user.email ?? "";

        if (profile && !profileError) {
          const parts: string[] = [];
          if (profile.first_name) parts.push(profile.first_name);
          if (profile.last_name) parts.push(profile.last_name);
          if (parts.length > 0) {
            displayName = parts.join(" ");
          } else if (profile.email) {
            displayName = profile.email;
          }
        }

        setAuthorName(displayName);

        // Compute initials
        const trimmed = displayName.trim();
        if (trimmed) {
          const words = trimmed.split(/\s+/);
          if (words.length >= 2) {
            setAuthorInitials(
              words[0].charAt(0).toUpperCase() +
                words[words.length - 1].charAt(0).toUpperCase()
            );
          } else {
            setAuthorInitials(trimmed.charAt(0).toUpperCase());
          }
        }
      }

      // -----------------------------------------------------------------------
      // Load existing blocks from the database
      // -----------------------------------------------------------------------
      try {
        const rows = await getContentModuleBlocksByPageId(pageId);

        // Only hydrate text blocks for now (row.type === "text")
        const hydratedBlocks: LessonBlock[] = rows
          .filter((row) => row.type === "text")
          .map((row) => {
            const json = row.content_json as TextBlockContentJson | null;

            // Determine internal block type from content_json.blockType
            const internalType = (json?.blockType ??
              "paragraph") as LessonBlockType;

            // Build the content object based on block type
            // Handle both old format (string) and new format (structured object)
            const content: LessonBlock["content"] = {};
            const rawContent = json?.content;
            const isStructured =
              typeof rawContent === "object" && rawContent !== null;

            if (internalType === "paragraph") {
              content.html = typeof rawContent === "string" ? rawContent : "";
            } else if (internalType === "heading") {
              content.heading =
                typeof rawContent === "string" ? rawContent : "";
            } else if (internalType === "subheading") {
              content.subheading =
                typeof rawContent === "string" ? rawContent : "";
            } else if (internalType === "paragraph-with-heading") {
              if (isStructured) {
                // New format: structured content with heading and body
                content.heading = (rawContent as any).heading ?? "";
                content.html = (rawContent as any).body ?? "";
              } else {
                // Old format: combined string (legacy)
                content.heading = "";
                content.html = typeof rawContent === "string" ? rawContent : "";
              }
            } else if (internalType === "paragraph-with-subheading") {
              if (isStructured) {
                // New format: structured content with subheading and body
                content.subheading = (rawContent as any).subheading ?? "";
                content.html = (rawContent as any).body ?? "";
              } else {
                // Old format: combined string (legacy)
                content.subheading = "";
                content.html = typeof rawContent === "string" ? rawContent : "";
              }
            } else if (internalType === "columns") {
              if (isStructured) {
                // New format: structured content with columnOne and columnTwo
                content.columnOneContent = (rawContent as any).columnOne ?? "";
                content.columnTwoContent = (rawContent as any).columnTwo ?? "";
              } else {
                // Old format: combined string (legacy)
                content.columnOneContent =
                  typeof rawContent === "string" ? rawContent : "";
                content.columnTwoContent = "";
              }
            } else if (internalType === "table") {
              // Load table content from database
              if (isStructured) {
                content.tableContent = (rawContent as any).tableContent ?? null;
                content.borderMode = (rawContent as any).borderMode ?? "normal";
              } else {
                // Legacy/fallback
                content.tableContent = null;
                content.borderMode = "normal";
              }
            } else if (internalType === "numbered-list") {
              // Load numbered list content from database
              if (isStructured) {
                content.listItems = (rawContent as any).items ?? [];
                content.startNumber = (rawContent as any).startNumber ?? 1;
                content.listStyle = (rawContent as any).listStyle ?? "decimal";
                content.subStyle =
                  (rawContent as any).subStyle ?? "lower-alpha";
                content.numberColor =
                  (rawContent as any).numberColor ?? "#f97316";
              } else {
                // Legacy/fallback - create one empty item
                content.listItems = [{ body: "<p>List item...</p>" }];
                content.startNumber = 1;
                content.listStyle = "decimal";
                content.subStyle = "lower-alpha";
                content.numberColor = "#f97316";
              }
            } else {
              // Fallback
              content.html = typeof rawContent === "string" ? rawContent : "";
            }

            // Read style from content_json.style, falling back to "light" for legacy blocks
            const savedStyle = json?.style?.style ?? "light";
            const savedCustomColor =
              json?.style?.customBackgroundColor ?? undefined;
            // Read animation settings from content_json
            const savedAnimation = (json as any)?.animation ?? "none";
            const savedAnimationDuration =
              (json as any)?.animationDuration ?? "normal";

            return {
              id: row.id,
              type: internalType,
              orderIndex: row.order_index,
              style: savedStyle as BlockStyle,
              customBackgroundColor: savedCustomColor,
              layout: { ...DEFAULT_BLOCK_LAYOUT },
              metadata: {
                behaviourTag: json?.metadata?.behaviourTag ?? null,
                cognitiveSkill: json?.metadata?.cognitiveSkill ?? null,
                learningPattern: json?.metadata?.learningPattern ?? null,
                difficulty: json?.metadata?.difficulty ?? null,
                notes: json?.metadata?.notes ?? null,
                source: json?.metadata?.source ?? null,
                fieldSources: json?.metadata?.fieldSources ?? undefined,
                aiExplanations: json?.metadata?.aiExplanations ?? undefined,
                aiConfidenceScores:
                  json?.metadata?.aiConfidenceScores ?? undefined,
              },
              mblMetadata: row.mbl_metadata, // Raw AI-generated metadata from database
              savedToDb: true,
              content: {
                ...content,
                animation: savedAnimation as BlockAnimation,
                animationDuration: savedAnimationDuration as AnimationDuration,
              },
            };
          });

        if (hydratedBlocks.length > 0) {
          setBlocks(hydratedBlocks);
        }
      } catch (err) {
        console.error("Error loading blocks from database:", err);
      }

      setLoading(false);

      // Mark initial load as complete after a short delay
      setTimeout(() => {
        initialLoadComplete.current = true;
      }, 100);
    };

    loadPageAndUser();
  }, [pageId]);

  // Track unsaved changes when blocks are modified (after initial load)
  useEffect(() => {
    if (initialLoadComplete.current && blocks.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [blocks]);

  // Block handlers
  const handleAddParagraphBlock = () => {
    // Use pendingInsertIndex if set, otherwise append to end
    createParagraphBlockAtIndex(pendingInsertIndex);
  };

  const handleUpdateBlock = (updatedBlock: LessonBlock) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === updatedBlock.id ? updatedBlock : b))
    );
  };

  const handleBlockStyleChange = (
    blockId: string,
    newStyle: BlockStyle,
    customBackgroundColor?: string
  ) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, style: newStyle, customBackgroundColor } : b
      )
    );
  };

  const handleLayoutChange = (blockId: string, newLayout: BlockLayout) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, layout: newLayout } : b))
    );
  };

  const handleToggleFormatPanel = useCallback((blockId: string) => {
    setOpenFormatBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  const handleToggleMetadataPanel = useCallback((blockId: string) => {
    setOpenMetadataBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  const handleToggleAppearancePanel = useCallback((blockId: string) => {
    setOpenAppearanceBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  const handleAnimationChange = (
    blockId: string,
    animation: BlockAnimation
  ) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, content: { ...b.content, animation } } : b
      )
    );
  };

  const handleDurationChange = (
    blockId: string,
    animationDuration: AnimationDuration
  ) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, content: { ...b.content, animationDuration } }
          : b
      )
    );
  };

  const handleMetadataChange = (
    blockId: string,
    newMetadata: BlockMetadata
  ) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, metadata: newMetadata } : b))
    );
  };

  // Handle clearing mblMetadata when user clicks "Clear metadata"
  const handleClearMblMetadata = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, mblMetadata: undefined } : b))
    );
  };

  // Handle updating mblMetadata when AI generates new metadata
  const handleUpdateMblMetadata = (blockId: string, mblMetadata: unknown) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, mblMetadata } : b))
    );
  };

  // Handle click on insertion handle between blocks
  const handleInsertClick = (index: number) => {
    setPendingInsertIndex(index);
    setIsBlockLibraryOpen(true);
  };

  // Create a new heading block at a specific index or at the end
  const createHeadingBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "heading",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          heading: "<p>Heading</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddHeadingBlock = () => {
    createHeadingBlockAtIndex(pendingInsertIndex);
  };

  // Create a new subheading block at a specific index or at the end
  const createSubheadingBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "subheading",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          subheading: "<p>Subheading</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddSubheadingBlock = () => {
    createSubheadingBlockAtIndex(pendingInsertIndex);
  };

  // Create a new columns block at a specific index or at the end
  const createColumnsBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "columns",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          columnOneContent: "<p>Start writing your first column...</p>",
          columnTwoContent: "<p>Start writing your second column...</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddColumnsBlock = () => {
    createColumnsBlockAtIndex(pendingInsertIndex);
  };

  // Create a new table block at a specific index or at the end
  const createTableBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "table",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          tableContent: DEFAULT_TABLE_CONTENT,
          borderMode: "normal",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddTableBlock = () => {
    createTableBlockAtIndex(pendingInsertIndex);
  };

  // Create a new numbered list block at a specific index or at the end
  const createNumberedListBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "numbered-list",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          listItems: [
            { body: "<p>First item content...</p>" },
            { body: "<p>Second item content...</p>" },
            { body: "<p>Third item content...</p>" },
          ],
          startNumber: 1,
          listStyle: "decimal",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddNumberedListBlock = () => {
    createNumberedListBlockAtIndex(pendingInsertIndex);
  };

  // Create a new bullet list block at a specific index or at the end
  const createBulletListBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "bullet-list",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          bulletItems: [
            { body: "<p>First bullet point...</p>" },
            { body: "<p>Second bullet point...</p>" },
            { body: "<p>Third bullet point...</p>" },
          ],
          bulletStyle: "disc",
          bulletColor: "#f97316", // orange-500
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddBulletListBlock = () => {
    createBulletListBlockAtIndex(pendingInsertIndex);
  };

  // Create a new paragraph block at a specific index or at the end
  const createParagraphBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "paragraph",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          html: "<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        // Insert at specific index
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        // Append to end
        newBlocks = [...prev, newBlock];
      }

      // Re-normalise orderIndex
      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    // Close block library and reset pending insert index
    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  // Create a new paragraph-with-heading block at a specific index or at the end
  const createParagraphWithHeadingBlockAtIndex = (
    insertIndex: number | null
  ) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "paragraph-with-heading",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          heading: "<p>Heading</p>",
          html: "<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddParagraphWithHeadingBlock = () => {
    createParagraphWithHeadingBlockAtIndex(pendingInsertIndex);
  };

  // Create a new paragraph-with-subheading block at a specific index or at the end
  const createParagraphWithSubheadingBlockAtIndex = (
    insertIndex: number | null
  ) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "paragraph-with-subheading",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          subheading: "<p>Subheading</p>",
          html: "<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>",
        },
      };

      let newBlocks: LessonBlock[];

      if (
        insertIndex !== null &&
        insertIndex >= 0 &&
        insertIndex <= prev.length
      ) {
        newBlocks = [
          ...prev.slice(0, insertIndex),
          newBlock,
          ...prev.slice(insertIndex),
        ];
      } else {
        newBlocks = [...prev, newBlock];
      }

      return newBlocks.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });

    setIsBlockLibraryOpen(false);
    setSelectedCategory(null);
    setPendingInsertIndex(null);
  };

  const handleAddParagraphWithSubheadingBlock = () => {
    createParagraphWithSubheadingBlockAtIndex(pendingInsertIndex);
  };

  const handleDeleteBlock = async (blockId: string) => {
    // Find the block to check if it's saved to the database
    const blockToDelete = blocks.find((b) => b.id === blockId);

    // Show confirmation dialog
    const confirmed = window.confirm(
      "Are you sure you want to delete this block? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    // If the block was saved to the database, delete it there first
    if (blockToDelete?.savedToDb) {
      try {
        await deleteContentModuleBlock(blockId);
        console.log("Block deleted from database:", blockId);
      } catch (error) {
        console.error("Error deleting block from database:", error);
        alert("Failed to delete block. Please try again.");
        return;
      }
    }

    // Remove from local state
    setBlocks((prev) =>
      prev
        .filter((block) => block.id !== blockId)
        .map((block, index) => ({
          ...block,
          orderIndex: index, // keep orderIndex sequential after deletion
        }))
    );
  };

  const handleDuplicateBlock = (blockId: string) => {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;

      const original = prev[index];

      const duplicated: LessonBlock = {
        ...original,
        id: crypto.randomUUID(), // new ID for the duplicate
        orderIndex: original.orderIndex + 0.5, // temp index to insert after
        layout: { ...original.layout }, // copy layout with fresh reference
        metadata: original.metadata ? { ...original.metadata } : undefined, // copy metadata
        content: { ...original.content }, // copy content with fresh reference
      };

      // insert duplicate *after* the original
      const withDuplicate = [
        ...prev.slice(0, index + 1),
        duplicated,
        ...prev.slice(index + 1),
      ];

      // re-normalise orderIndex so it's 0,1,2,... again
      return withDuplicate.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });
  };

  const moveBlock = (blockId: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      // If we can't move (already at top or bottom), return as-is
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;

      // Normalise orderIndex after reordering
      return next.map((block, i) => ({
        ...block,
        orderIndex: i,
      }));
    });
  };

  const handleMoveBlockUp = (blockId: string) => moveBlock(blockId, "up");
  const handleMoveBlockDown = (blockId: string) => moveBlock(blockId, "down");

  // ---------------------------------------------------------------------------
  // SAVE LESSON HANDLER
  // ---------------------------------------------------------------------------
  const handleSaveLesson = async () => {
    if (!pageId) {
      console.error("No pageId available");
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    // Define which block types are text-based and should be saved
    const textBlockTypes: LessonBlockType[] = [
      "paragraph",
      "heading",
      "subheading",
      "paragraph-with-heading",
      "paragraph-with-subheading",
      "columns",
      "table",
      "numbered-list",
    ];

    // Track updated block IDs (for newly inserted blocks)
    const updatedBlockIds: Record<string, string> = {};

    try {
      for (const block of blocks) {
        // Only process text-based blocks for now
        if (!textBlockTypes.includes(block.type)) {
          continue;
        }

        // Build the content based on block type
        // For simple blocks, content is a string
        // For compound blocks, content is a StructuredBlockContent object
        let blockContent: string | StructuredBlockContent = "";

        if (block.type === "paragraph") {
          blockContent = block.content.html ?? "";
        } else if (block.type === "heading") {
          blockContent = block.content.heading ?? "";
        } else if (block.type === "subheading") {
          blockContent = block.content.subheading ?? "";
        } else if (block.type === "paragraph-with-heading") {
          // Store heading and body separately
          blockContent = {
            heading: block.content.heading ?? "",
            body: block.content.html ?? "",
          };
        } else if (block.type === "paragraph-with-subheading") {
          // Store subheading and body separately
          blockContent = {
            subheading: block.content.subheading ?? "",
            body: block.content.html ?? "",
          };
        } else if (block.type === "columns") {
          // Store columns separately
          blockContent = {
            columnOne: block.content.columnOneContent ?? "",
            columnTwo: block.content.columnTwoContent ?? "",
          };
        } else if (block.type === "table") {
          // Store table content and settings
          blockContent = {
            tableContent: block.content.tableContent ?? null,
            borderMode: block.content.borderMode ?? "normal",
          };
        } else if (block.type === "numbered-list") {
          // Store numbered list items, start number, list styles, and number color
          blockContent = {
            items: block.content.listItems ?? [],
            startNumber: block.content.startNumber ?? 1,
            listStyle: block.content.listStyle ?? "decimal",
            subStyle: block.content.subStyle ?? "lower-alpha",
            numberColor: block.content.numberColor ?? "#f97316",
          };
        } else if (block.type === "bullet-list") {
          // Store bullet list items and bullet color
          blockContent = {
            bulletItems: block.content.bulletItems ?? [],
            bulletStyle: block.content.bulletStyle ?? "disc",
            bulletSubStyle: block.content.bulletSubStyle ?? "disc",
            bulletColor: block.content.bulletColor ?? "#f97316",
          };
        }

        // Build the TextBlockContentJson object
        const contentJson: TextBlockContentJson = {
          blockType: block.type,
          content: blockContent,
          metadata: {
            behaviourTag: block.metadata?.behaviourTag ?? null,
            cognitiveSkill: block.metadata?.cognitiveSkill ?? null,
            learningPattern: block.metadata?.learningPattern ?? null,
            difficulty: block.metadata?.difficulty ?? null,
            notes: block.metadata?.notes ?? null,
            source: block.metadata?.source ?? null,
            fieldSources: block.metadata?.fieldSources ?? null,
            aiExplanations: block.metadata?.aiExplanations ?? null,
            aiConfidenceScores: block.metadata?.aiConfidenceScores ?? null,
          },
          // Include style data so block appearance persists
          style: {
            style: block.style ?? null,
            customBackgroundColor: block.customBackgroundColor ?? null,
          },
          // Include animation settings
          animation: block.content.animation ?? "none",
          animationDuration: block.content.animationDuration ?? "normal",
        };

        // Check if block.id looks like a UUID from the database or a client-generated one
        // For now, assume all IDs are valid and let upsert handle insert vs update
        const result = await upsertContentModuleBlock({
          id: block.id,
          pageId: pageId,
          type: block.type,
          orderIndex: block.orderIndex,
          contentJson,
          learningGoal: null,
          mediaType: null,
          isCore: null,
          difficultyLevel: null,
        });

        // If the returned id is different from the block id, track it for update
        if (result && result.id && result.id !== block.id) {
          updatedBlockIds[block.id] = result.id;
        }
      }

      // Update local state: set savedToDb=true for all saved blocks, and update IDs if needed
      setBlocks((prev) =>
        prev.map((block) => {
          // Only update text blocks that were saved
          if (!textBlockTypes.includes(block.type)) {
            return block;
          }
          // Update ID if it changed, and mark as saved
          if (updatedBlockIds[block.id]) {
            return { ...block, id: updatedBlockIds[block.id], savedToDb: true };
          }
          // Mark as saved even if ID didn't change
          return { ...block, savedToDb: true };
        })
      );

      setSaveMessage("Lesson saved successfully!");
      setHasUnsavedChanges(false); // Reset unsaved changes flag
      // Clear the message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Error saving lesson:", error);
      setSaveMessage("Error saving lesson. Please try again.");
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const title = page?.title || "Lesson";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading lesson...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header section - centered */}
      <div className="max-w-4xl mx-auto px-8 pt-12">
        {/* Back link */}
        <button
          type="button"
          onClick={() => {
            if (hasUnsavedChanges) {
              setShowUnsavedModal(true);
            } else {
              if (moduleId) {
                navigate(`/admin/content/module-builder/${moduleId}`);
              } else {
                navigate("/admin/content/module-builder");
              }
            }
          }}
          className="text-blue-600 hover:underline mb-6 inline-block text-sm"
        >
          &larr; Back to Module Builder
        </button>

        {/* Lesson title row with save button */}
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-4xl font-light text-gray-700">{title}</h1>
          <div className="flex items-center gap-3">
            {/* Save message */}
            {saveMessage && (
              <span
                className={`text-sm ${
                  saveMessage.includes("Error")
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {saveMessage}
              </span>
            )}
            {/* Save button */}
            <button
              type="button"
              onClick={handleSaveLesson}
              disabled={isSaving}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isSaving
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              }`}
            >
              {isSaving ? "Saving…" : "Save lesson"}
            </button>

            {/* Preview Button */}
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-colors border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            >
              👁️ Preview
            </button>
          </div>
        </div>

        {/* Author row */}
        {authorName && (
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-full bg-[#4a90a4] text-white flex items-center justify-center text-sm font-semibold">
              {authorInitials}
            </div>
            <span className="font-medium text-gray-700">{authorName}</span>
          </div>
        )}

        {/* Orange underline */}
        <div className="h-1 w-36 bg-orange-500 mb-12" />
      </div>

      {/* Blocks workspace - FULL WIDTH (edge-to-edge) */}
      <div className="pb-24">
        {/* Blocks workspace */}
        {blocks.length === 0 ? (
          /* Add your first block area - shown when no blocks exist (centered) */
          <div className="max-w-4xl mx-auto px-8">
            <div className="border border-dashed border-gray-300 rounded-xl py-8 px-6">
              <div className="flex items-start gap-6">
                {/* Block Library button */}
                <button
                  type="button"
                  onClick={() => setIsBlockLibraryOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 w-16 h-20 bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors"
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="4" y="4" width="6" height="6" rx="1" />
                    <rect x="14" y="4" width="6" height="6" rx="1" />
                    <rect x="4" y="14" width="6" height="6" rx="1" />
                    <rect x="14" y="14" width="6" height="6" rx="1" />
                  </svg>
                  <span className="text-[10px] text-white font-medium leading-tight">
                    Block
                  </span>
                  <span className="text-[10px] text-white font-medium leading-tight -mt-0.5">
                    Library
                  </span>
                </button>

                {/* Block type icons */}
                <div className="flex items-center gap-4">
                  {/* Text */}
                  <button
                    type="button"
                    onClick={handleAddParagraphBlock}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 6h16M4 12h16M4 18h7"
                      />
                    </svg>
                    <span className="text-xs text-red-500 font-medium">
                      Text
                    </span>
                  </button>

                  {/* List - Creates a numbered list block */}
                  <button
                    type="button"
                    onClick={handleAddNumberedListBlock}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 6h16M4 10h16M4 14h16M4 18h16"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      List
                    </span>
                  </button>

                  {/* Image */}
                  <button
                    type="button"
                    onClick={() => console.log("Image block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Image
                    </span>
                  </button>

                  {/* Video */}
                  <button
                    type="button"
                    onClick={() => console.log("Video block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Video
                    </span>
                  </button>

                  {/* Process */}
                  <button
                    type="button"
                    onClick={() => console.log("Process block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Process
                    </span>
                  </button>

                  {/* Flashcards */}
                  <button
                    type="button"
                    onClick={() => console.log("Flashcards block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-20 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Flashcards
                    </span>
                  </button>

                  {/* Sorting */}
                  <button
                    type="button"
                    onClick={() => console.log("Sorting block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Sorting
                    </span>
                  </button>

                  {/* Continue */}
                  <button
                    type="button"
                    onClick={() => console.log("Continue block clicked")}
                    className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      Continue
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Blocks list - FULL WIDTH (edge-to-edge) */
          <div>
            {(() => {
              const sortedBlocks = blocks
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex);
              return sortedBlocks.map((block, index) => {
                // Common block props
                const commonBlockProps = {
                  block,
                  onChange: handleUpdateBlock,
                  onStyleChange: (newStyle: BlockStyle, customColor?: string) =>
                    handleBlockStyleChange(block.id, newStyle, customColor),
                  onLayoutChange: (newLayout: BlockLayout) =>
                    handleLayoutChange(block.id, newLayout),
                  onMetadataChange: (newMetadata: BlockMetadata) =>
                    handleMetadataChange(block.id, newMetadata),
                  onMblMetadataCleared: () => handleClearMblMetadata(block.id),
                  onMblMetadataUpdated: (mblMetadata: unknown) =>
                    handleUpdateMblMetadata(block.id, mblMetadata),
                  onAnimationChange: (animation: BlockAnimation) =>
                    handleAnimationChange(block.id, animation),
                  onDurationChange: (duration: AnimationDuration) =>
                    handleDurationChange(block.id, duration),
                  onDuplicate: () => handleDuplicateBlock(block.id),
                  onDelete: () => handleDeleteBlock(block.id),
                  onMoveUp: () => handleMoveBlockUp(block.id),
                  onMoveDown: () => handleMoveBlockDown(block.id),
                  canMoveUp: index > 0,
                  canMoveDown: index < sortedBlocks.length - 1,
                  isFormatPanelOpen: openFormatBlockId === block.id,
                  onToggleFormatPanel: () => handleToggleFormatPanel(block.id),
                  isMetadataPanelOpen: openMetadataBlockId === block.id,
                  onToggleMetadataPanel: () =>
                    handleToggleMetadataPanel(block.id),
                  isAppearancePanelOpen: openAppearanceBlockId === block.id,
                  onToggleAppearancePanel: () =>
                    handleToggleAppearancePanel(block.id),
                };

                // Render the appropriate block component
                let blockComponent: React.ReactNode = null;

                if (block.type === "heading") {
                  blockComponent = <HeadingBlock {...commonBlockProps} />;
                } else if (block.type === "subheading") {
                  blockComponent = <SubheadingBlock {...commonBlockProps} />;
                } else if (block.type === "paragraph") {
                  blockComponent = <ParagraphBlock {...commonBlockProps} />;
                } else if (block.type === "paragraph-with-heading") {
                  blockComponent = (
                    <ParagraphWithHeadingBlock {...commonBlockProps} />
                  );
                } else if (block.type === "paragraph-with-subheading") {
                  blockComponent = (
                    <ParagraphWithSubheadingBlock {...commonBlockProps} />
                  );
                } else if (block.type === "columns") {
                  blockComponent = <ColumnsBlock {...commonBlockProps} />;
                } else if (block.type === "table") {
                  blockComponent = <TableBlock {...commonBlockProps} />;
                } else if (block.type === "numbered-list") {
                  blockComponent = <NumberedListBlock {...commonBlockProps} />;
                } else if (block.type === "bullet-list") {
                  blockComponent = <BulletListBlock {...commonBlockProps} />;
                }

                if (!blockComponent) return null;

                return (
                  <Fragment key={block.id}>
                    <BlockHoverWrapper
                      onMouseEnter={() => setHoveredBlockId(block.id)}
                      onMouseLeave={() => setHoveredBlockId(null)}
                    >
                      {blockComponent}
                    </BlockHoverWrapper>

                    {/* Insertion handle between this block and the next */}
                    {index < sortedBlocks.length - 1 && (
                      <InsertionHandle
                        index={index + 1}
                        aboveBlockId={block.id}
                        belowBlockId={sortedBlocks[index + 1].id}
                        hoveredBlockId={hoveredBlockId}
                        hoveredInsertIndex={hoveredInsertIndex}
                        setHoveredInsertIndex={setHoveredInsertIndex}
                        onInsertClick={handleInsertClick}
                      />
                    )}
                  </Fragment>
                );
              });
            })()}

            {/* Add block button below existing blocks (centered) */}
            <div className="max-w-4xl mx-auto px-8 mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setIsBlockLibraryOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add block
              </button>
            </div>
          </div>
        )}

        {/* Debug info (can be removed later) */}
        <div className="max-w-4xl mx-auto px-8 mt-8 text-xs text-gray-400">
          Module ID: {moduleId} | Page ID: {pageId} | Blocks: {blocks.length}
        </div>
      </div>

      {/* Block Library slide-out panel */}
      <div
        className={`fixed inset-0 z-50 ${
          isBlockLibraryOpen ? "visible" : "invisible"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
            isBlockLibraryOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => {
            setIsBlockLibraryOpen(false);
            setPendingInsertIndex(null);
          }}
        />

        {/* Slide-out panel with categories + templates */}
        <div
          className={`absolute inset-y-0 left-0 bg-white shadow-xl border-r border-gray-200 transform transition-all duration-200 flex flex-col ${
            isBlockLibraryOpen ? "translate-x-0" : "-translate-x-full"
          } ${selectedCategory ? "w-[500px]" : "w-48"}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">
              Block Library
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsBlockLibraryOpen(false);
                setPendingInsertIndex(null);
              }}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Body: categories (left) + templates (right) */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Categories list */}
            <nav className="w-44 border-r border-gray-200 overflow-y-auto px-2 py-3 space-y-1 text-sm bg-white">
              {BLOCK_LIBRARY_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              ))}
            </nav>

            {/* Templates panel - hidden until a category is selected */}
            <section
              className={`absolute top-0 bottom-0 left-44 right-0 bg-gray-50 border-l border-gray-200 px-4 py-4 overflow-y-auto transform transition-transform duration-200 ${
                selectedCategory ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {selectedCategory === "text" ? (
                <div className="space-y-3">
                  {TEXT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        if (tpl.id === "heading") {
                          handleAddHeadingBlock();
                        } else if (tpl.id === "subheading") {
                          handleAddSubheadingBlock();
                        } else if (tpl.id === "paragraph") {
                          handleAddParagraphBlock();
                        } else if (tpl.id === "paragraph_heading") {
                          handleAddParagraphWithHeadingBlock();
                        } else if (tpl.id === "paragraph_subheading") {
                          handleAddParagraphWithSubheadingBlock();
                        } else if (tpl.id === "columns") {
                          handleAddColumnsBlock();
                        } else if (tpl.id === "table") {
                          handleAddTableBlock();
                        } else {
                          console.log("Selected text template", tpl.id);
                          // TODO: implement other block types
                        }
                      }}
                      className="w-full bg-white rounded-lg border border-gray-200 hover:border-orange-500 hover:shadow-sm text-left overflow-hidden transition-all"
                    >
                      {/* Simple visual preview rectangle */}
                      <div className="h-16 bg-gray-100 border-b border-gray-200 flex items-center justify-center">
                        <div className="w-3/4 space-y-1.5">
                          <div className="h-2 bg-gray-300 rounded" />
                          <div className="h-2 bg-gray-300 rounded w-5/6" />
                          <div className="h-2 bg-gray-300 rounded w-4/6" />
                        </div>
                      </div>
                      <div className="px-3 py-2.5">
                        <div className="text-sm font-medium text-gray-900">
                          {tpl.title}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 leading-relaxed">
                          {tpl.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : selectedCategory === "list" ? (
                <div className="space-y-3">
                  {LIST_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        if (tpl.id === "numbered_list") {
                          handleAddNumberedListBlock();
                        } else if (tpl.id === "bullet_list") {
                          handleAddBulletListBlock();
                        }
                      }}
                      className="w-full bg-white rounded-lg border border-gray-200 hover:border-orange-500 hover:shadow-sm text-left overflow-hidden transition-all"
                    >
                      {/* Visual preview */}
                      <div className="h-16 bg-gray-100 border-b border-gray-200 flex items-center justify-center">
                        <div className="w-3/4 space-y-1">
                          {tpl.id === "numbered_list" ? (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="h-4 w-4 bg-orange-400 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                                  1
                                </div>
                                <div className="h-2 bg-gray-300 rounded flex-1" />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-4 w-4 bg-orange-400 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                                  2
                                </div>
                                <div className="h-2 bg-gray-300 rounded flex-1 w-4/5" />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-4 w-4 bg-orange-400 rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                                  3
                                </div>
                                <div className="h-2 bg-gray-300 rounded flex-1 w-3/5" />
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 bg-orange-400 rounded-full" />
                                <div className="h-2 bg-gray-300 rounded flex-1" />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 bg-orange-400 rounded-full" />
                                <div className="h-2 bg-gray-300 rounded flex-1 w-4/5" />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 bg-orange-400 rounded-full" />
                                <div className="h-2 bg-gray-300 rounded flex-1 w-3/5" />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="px-3 py-2.5">
                        <div className="text-sm font-medium text-gray-900">
                          {tpl.title}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 leading-relaxed">
                          {tpl.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : selectedCategory ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">
                  <div className="text-center">
                    <div className="text-2xl mb-2">📦</div>
                    <div>
                      Templates for{" "}
                      <span className="font-medium text-gray-700">
                        {
                          BLOCK_LIBRARY_CATEGORIES.find(
                            (c) => c.id === selectedCategory
                          )?.label
                        }
                      </span>
                    </div>
                    <div className="text-xs mt-1">Coming soon</div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Inject animation styles */}
          <style dangerouslySetInnerHTML={{ __html: ANIMATION_STYLES }} />

          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsPreviewOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Lesson Preview
                </h2>
                <p className="text-sm text-gray-500">
                  This is how learners will see your lesson
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Lesson Title */}
              <div className="bg-white border-b border-gray-100 px-8 py-6">
                <h1 className="text-3xl font-bold text-gray-900">
                  {page?.title || "Untitled Lesson"}
                </h1>
              </div>

              {/* Blocks */}
              <div className="bg-gray-50">
                {blocks
                  .slice()
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((block) => {
                    // Get style classes and inline color
                    const styleClasses = getBlockStyleClasses(block.style);
                    const inlineBgColor =
                      block.style === "custom" && block.customBackgroundColor
                        ? block.customBackgroundColor
                        : undefined;
                    const layout = block.layout || DEFAULT_BLOCK_LAYOUT;

                    return (
                      <AnimateOnView
                        key={block.id}
                        animation={block.content.animation as BlockAnimation}
                        duration={
                          block.content.animationDuration as AnimationDuration
                        }
                        className={`w-full ${styleClasses}`}
                        style={
                          inlineBgColor
                            ? { backgroundColor: inlineBgColor }
                            : undefined
                        }
                      >
                        <div
                          className={`${getContentWidthClasses(
                            layout.contentWidth
                          )} px-8`}
                          style={{
                            paddingTop: `${layout.paddingTop}px`,
                            paddingBottom: `${layout.paddingBottom}px`,
                          }}
                        >
                          {/* Heading */}
                          {block.type === "heading" && (
                            <div
                              className="text-[40px] font-semibold leading-tight"
                              dangerouslySetInnerHTML={{
                                __html: block.content.heading || "",
                              }}
                            />
                          )}

                          {/* Subheading */}
                          {block.type === "subheading" && (
                            <div
                              className="text-[30px] font-semibold leading-tight"
                              dangerouslySetInnerHTML={{
                                __html: block.content.subheading || "",
                              }}
                            />
                          )}

                          {/* Paragraph */}
                          {block.type === "paragraph" && (
                            <div
                              className="prose prose-lg max-w-none"
                              dangerouslySetInnerHTML={{
                                __html: block.content.html || "",
                              }}
                            />
                          )}

                          {/* Paragraph with Heading */}
                          {block.type === "paragraph-with-heading" && (
                            <div>
                              <div
                                className="text-[40px] font-semibold leading-tight mb-4"
                                dangerouslySetInnerHTML={{
                                  __html: block.content.heading || "",
                                }}
                              />
                              <div
                                className="prose prose-lg max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: block.content.html || "",
                                }}
                              />
                            </div>
                          )}

                          {/* Paragraph with Subheading */}
                          {block.type === "paragraph-with-subheading" && (
                            <div>
                              <div
                                className="text-[30px] font-semibold leading-tight mb-4"
                                dangerouslySetInnerHTML={{
                                  __html: block.content.subheading || "",
                                }}
                              />
                              <div
                                className="prose prose-lg max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: block.content.html || "",
                                }}
                              />
                            </div>
                          )}

                          {/* Columns */}
                          {block.type === "columns" && (
                            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                              <div
                                className="flex-1 prose prose-lg max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: block.content.columnOneContent || "",
                                }}
                              />
                              <div
                                className="flex-1 prose prose-lg max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: block.content.columnTwoContent || "",
                                }}
                              />
                            </div>
                          )}

                          {/* Table */}
                          {block.type === "table" && (
                            <div className="overflow-x-auto">
                              {block.content.tableContent ? (
                                <TablePreview
                                  content={block.content.tableContent}
                                />
                              ) : (
                                <div className="text-gray-400 italic">
                                  Empty table
                                </div>
                              )}
                            </div>
                          )}

                          {/* Ordered List (with nested support) */}
                          {block.type === "numbered-list" && (
                            <div className="space-y-4">
                              {(block.content.listItems ?? []).map(
                                (item, idx) => {
                                  const startNum =
                                    block.content.startNumber ?? 1;
                                  const marker = getListMarker(
                                    startNum + idx,
                                    block.content.listStyle
                                  );
                                  // Staggered delay: each item waits longer (0.35s per item)
                                  const itemDelay = 0.4 + idx * 0.35;
                                  return (
                                    <div
                                      key={idx}
                                      className="animate-list-item"
                                      style={{
                                        animationDelay: `${itemDelay}s`,
                                      }}
                                    >
                                      {/* Top-level item with badge */}
                                      <div className="flex items-start gap-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white font-semibold text-sm">
                                          {marker}
                                        </div>
                                        <div className="flex-1 pt-2">
                                          <div
                                            className="prose prose-sm max-w-none [&>p]:m-0 [&>p:not(:last-child)]:mb-2 text-gray-800"
                                            dangerouslySetInnerHTML={{
                                              __html: item.body,
                                            }}
                                          />
                                        </div>
                                      </div>

                                      {/* Nested children (level 2) */}
                                      {item.children &&
                                        item.children.length > 0 && (
                                          <div className="ml-14 mt-3 space-y-3">
                                            {item.children.map(
                                              (child, childIdx) => {
                                                const childMarker =
                                                  getListMarker(
                                                    childIdx + 1,
                                                    block.content.subStyle ??
                                                      "lower-alpha"
                                                  );
                                                // Child items also stagger after parent
                                                const childDelay =
                                                  itemDelay +
                                                  0.2 +
                                                  childIdx * 0.25;
                                                return (
                                                  <div
                                                    key={childIdx}
                                                    className="flex items-start gap-3 animate-list-item"
                                                    style={{
                                                      animationDelay: `${childDelay}s`,
                                                    }}
                                                  >
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-400 text-white font-medium text-xs">
                                                      {childMarker}
                                                    </div>
                                                    <div className="flex-1 pt-1">
                                                      <div
                                                        className="prose prose-sm max-w-none [&>p]:m-0 [&>p:not(:last-child)]:mb-2 text-gray-700"
                                                        dangerouslySetInnerHTML={{
                                                          __html: child.body,
                                                        }}
                                                      />
                                                    </div>
                                                  </div>
                                                );
                                              }
                                            )}
                                          </div>
                                        )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          )}

                          {/* Bullet List */}
                          {block.type === "bullet-list" && (
                            <div className="space-y-4">
                              {(block.content.bulletItems ?? []).map(
                                (item, idx) => {
                                  // Staggered delay: each item waits longer
                                  const itemDelay = 0.4 + idx * 0.35;
                                  return (
                                    <div
                                      key={idx}
                                      className="animate-list-item"
                                      style={{
                                        animationDelay: `${itemDelay}s`,
                                      }}
                                    >
                                      {/* Top-level item with bullet */}
                                      <div className="flex items-start gap-4">
                                        <div
                                          className="flex h-4 w-4 mt-1.5 shrink-0 items-center justify-center rounded-full"
                                          style={{
                                            backgroundColor:
                                              block.content.bulletColor ||
                                              "#f97316",
                                          }}
                                        />
                                        <div className="flex-1">
                                          <div
                                            className="prose prose-sm max-w-none [&>p]:m-0 [&>p:not(:last-child)]:mb-2 text-gray-800"
                                            dangerouslySetInnerHTML={{
                                              __html: item.body,
                                            }}
                                          />
                                        </div>
                                      </div>

                                      {/* Nested children (level 2) */}
                                      {item.children &&
                                        item.children.length > 0 && (
                                          <div className="ml-8 mt-3 space-y-3">
                                            {item.children.map(
                                              (child, childIdx) => {
                                                // Child items also stagger after parent
                                                const childDelay =
                                                  itemDelay +
                                                  0.2 +
                                                  childIdx * 0.25;
                                                return (
                                                  <div
                                                    key={childIdx}
                                                    className="flex items-start gap-3 animate-list-item"
                                                    style={{
                                                      animationDelay: `${childDelay}s`,
                                                    }}
                                                  >
                                                    <div
                                                      className="flex h-3 w-3 mt-1.5 shrink-0 items-center justify-center rounded-full opacity-70"
                                                      style={{
                                                        backgroundColor:
                                                          block.content
                                                            .bulletColor ||
                                                          "#f97316",
                                                      }}
                                                    />
                                                    <div className="flex-1">
                                                      <div
                                                        className="prose prose-sm max-w-none [&>p]:m-0 [&>p:not(:last-child)]:mb-2 text-gray-700"
                                                        dangerouslySetInnerHTML={{
                                                          __html: child.body,
                                                        }}
                                                      />
                                                    </div>
                                                  </div>
                                                );
                                              }
                                            )}
                                          </div>
                                        )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          )}
                        </div>
                      </AnimateOnView>
                    );
                  })}

                {/* Empty state */}
                {blocks.length === 0 && (
                  <div className="flex items-center justify-center py-20 text-gray-400">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📄</div>
                      <p>No content yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowUnsavedModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-[90vw] max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Unsaved Changes
              </h2>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-gray-600">
                You have unsaved changes. Are you sure you want to leave? Your
                changes will be lost.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  if (moduleId) {
                    navigate(`/admin/content/module-builder/${moduleId}`);
                  } else {
                    navigate("/admin/content/module-builder");
                  }
                }}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for table preview
const TablePreview: React.FC<{ content: unknown }> = ({ content }) => {
  // Render TipTap table JSON as HTML
  if (!content || typeof content !== "object") return null;

  const renderNode = (node: any): React.ReactNode => {
    if (!node) return null;

    // Handle doc wrapper (TipTap wraps content in a doc node)
    if (node.type === "doc") {
      return (
        <>
          {node.content?.map((child: any, i: number) =>
            renderNode({ ...child, key: i })
          )}
        </>
      );
    }

    if (node.type === "table") {
      return (
        <table
          key={node.key}
          className="border-collapse border border-gray-300 w-full"
        >
          <tbody>
            {node.content?.map((row: any, i: number) =>
              renderNode({ ...row, key: i })
            )}
          </tbody>
        </table>
      );
    }

    if (node.type === "tableRow") {
      return (
        <tr key={node.key}>
          {node.content?.map((cell: any, i: number) =>
            renderNode({ ...cell, key: i })
          )}
        </tr>
      );
    }

    if (node.type === "tableHeader") {
      return (
        <th
          key={node.key}
          className="border border-gray-300 px-4 py-2 bg-orange-500 text-white font-semibold"
          style={
            node.attrs?.backgroundColor
              ? { backgroundColor: node.attrs.backgroundColor }
              : undefined
          }
        >
          {node.content?.map((p: any, i: number) =>
            renderNode({ ...p, key: i })
          )}
        </th>
      );
    }

    if (node.type === "tableCell") {
      return (
        <td
          key={node.key}
          className="border border-gray-300 px-4 py-2"
          style={
            node.attrs?.backgroundColor
              ? { backgroundColor: node.attrs.backgroundColor }
              : undefined
          }
        >
          {node.content?.map((p: any, i: number) =>
            renderNode({ ...p, key: i })
          )}
        </td>
      );
    }

    if (node.type === "paragraph") {
      return (
        <p key={node.key} className="m-0">
          {node.content?.map((t: any, i: number) =>
            renderNode({ ...t, key: i })
          ) || <br />}
        </p>
      );
    }

    if (node.type === "text") {
      let text: React.ReactNode = node.text;
      // Apply marks (bold, italic, etc.)
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === "bold") {
            text = <strong>{text}</strong>;
          } else if (mark.type === "italic") {
            text = <em>{text}</em>;
          } else if (mark.type === "underline") {
            text = <u>{text}</u>;
          } else if (mark.type === "strike") {
            text = <s>{text}</s>;
          } else if (mark.type === "textStyle" && mark.attrs?.color) {
            text = <span style={{ color: mark.attrs.color }}>{text}</span>;
          }
        }
      }
      return <span key={node.key}>{text}</span>;
    }

    // Handle hardBreak
    if (node.type === "hardBreak") {
      return <br key={node.key} />;
    }

    return null;
  };

  return <>{renderNode(content)}</>;
};

export default LessonBuilder;
