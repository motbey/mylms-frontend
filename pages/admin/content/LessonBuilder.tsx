import React, {
  Fragment,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
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
  PanelsLeftRight,
  Palette,
  Stars,
  Database,
  ArrowRight,
  ArrowLeft,
  Hash,
  ListOrdered,
  IndentIncrease,
  Pencil,
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
import {
  BlockStyleMenu,
  type BlockStyle,
} from "../../../src/components/blocks/BlockStyleMenu";
import {
  AppearancePanel,
  BlockMetadataPopover,
  BlockWrapper,
  FormatPanel,
  getBlockStyleClasses,
  getContentWidthClasses,
} from "../../../src/components/blocks/shared/LessonBuilderInternals";
import { ParagraphBlock } from "../../../src/components/blocks/text/ParagraphBlock";
import { ParagraphWithHeaderBlock as ParagraphWithHeadingBlock } from "../../../src/components/blocks/text/ParagraphWithHeaderBlock";
import { ParagraphWithSubheadingBlock } from "../../../src/components/blocks/text/ParagraphWithSubheadingBlock";
import { HeadingBlock } from "../../../src/components/blocks/text/HeadingBlock";
import { SubheadingBlock } from "../../../src/components/blocks/text/SubheadingBlock";
import { ImageCenteredBlock } from "../../../src/components/blocks/image/ImageCenteredBlock";
import { ImageFullWidthBlock } from "../../../src/components/blocks/image/ImageFullWidthBlock";
import { ImageTextBlock } from "../../../src/components/blocks/image/ImageTextBlock";
import {
  FlashcardsBlock,
  FlashcardsPreview,
} from "../../../src/components/blocks/interactive/flashcards/FlashcardsBlock";
import { SortingActivityBlock } from "../../../src/components/blocks/interactive/sorting-activity/SortingActivityBlock";
import {
  DEFAULT_TABLE_CONTENT,
  TableBlock,
} from "../../../src/components/blocks/text/TableBlock";
import { ColumnBlock as ColumnsBlock } from "../../../src/components/blocks/layout/ColumnBlock";

// Import sorting activity types and components
import type { SortingActivityContent } from "../../../src/components/blocks/sorting/sorting-types";
import { SortingActivityLearner } from "../../../src/components/blocks/sorting/SortingActivityLearner";

// Import media assets
import {
  MediaAsset,
  listMediaAssets,
  MEDIA_IMAGES_BASE_URL,
} from "../../../src/lib/mediaAssets";
import { ImageUploadAndLibrary } from "../../../src/components/media";

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
  | "bullet-list"
  | "image-centered"
  | "image-fullwidth"
  | "image-text"
  | "flashcards"
  | "sorting_activity";

// Content shape for image-centered block
interface ImageCenteredContent {
  media_asset_id: string | null;
  alt_text: string;
  caption: string | null;
  public_url?: string | null; // Cached public URL for display
}

// Content shape for image-fullwidth block
interface ImageFullWidthContent {
  media_asset_id: string | null;
  alt_text: string;
  caption: string | null;
  public_url?: string | null; // Cached public URL for display
}

// Content shape for image-text block
interface ImageTextContent {
  media_asset_id: string | null;
  public_url?: string | null;
  alt_text?: string;
  layout: {
    imagePosition: "left" | "right";
    imageWidth: 25 | 50 | 75;
  };
  text: {
    heading: string;
    body: string;
  };
  ai_metadata?: unknown; // Reserved for future AI integration
}

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

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  orderIndex: number;
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  mblMetadata?: unknown; // Raw AI-generated metadata from mbl_metadata column
  savedToDb?: boolean; // true when block exists in content_module_blocks table
  media_asset_id?: string | null; // FK to media_assets for image blocks
  content: {
    heading?: string; // Used by paragraph-with-heading
    subheading?: string; // Used by paragraph-with-subheading
    columnOneContent?: string; // Used by columns block
    columnTwoContent?: string; // Used by columns block
    tableContent?: unknown; // Used by table block (TipTap JSON)
    borderMode?: "normal" | "dashed" | "alternate"; // Used by table block
    html?: string;
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
    // Image-text block fields
    text?: string | { heading: string; body: string }; // String for simple text, object for image-text
    layout?: { imagePosition: "left" | "right"; imageWidth: 25 | 50 | 75 }; // For image-text block
    ai_metadata?: unknown; // Reserved for AI integration
    // Animation settings (applies to all blocks)
    animation?: BlockAnimation;
    animationDuration?: AnimationDuration;
    [key: string]: unknown;
  };
}

// Animation types for block entrance effects
export type BlockAnimation =
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
export type AnimationDuration = "fast" | "normal" | "slow" | "very-slow";

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
  moduleId,
  pageId,
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
  moduleId,
  pageId,
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

// Templates for the Image category
const IMAGE_TEMPLATES: BlockTemplate[] = [
  {
    id: "image_centered",
    title: "Image – Centered",
    description: "Add a centered image with optional alt text and caption.",
  },
  {
    id: "image_fullwidth",
    title: "Image – Full width",
    description: "Add a full width image with optional alt text and caption.",
  },
  {
    id: "image_text",
    title: "Image + Text",
    description: "Add an image with text beside it.",
  },
];

// Templates for the Interactive category
const INTERACTIVE_TEMPLATES: BlockTemplate[] = [
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Learners flip cards to reveal answers and explanations.",
  },
  {
    id: "sorting_activity",
    title: "Sorting Activity",
    description: "Drag items into the correct category.",
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
  const [previewWidth, setPreviewWidth] = useState<
    "desktop" | "tablet" | "mobile"
  >("desktop");

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

        // Hydrate text blocks and image blocks
        const supportedDbTypes = [
          "text",
          "image-centered",
          "image-fullwidth",
          "image-text",
          "flashcards",
          "sorting_activity",
        ];
        const hydratedBlocks: LessonBlock[] = rows
          .filter((row) => supportedDbTypes.includes(row.type))
          .map((row) => {
            const json = row.content_json as TextBlockContentJson | null;

            // ---------------------------------------------------------------
            // Handle image block types directly (they use DB type as-is)
            // ---------------------------------------------------------------
            if (
              row.type === "image-centered" ||
              row.type === "image-fullwidth"
            ) {
              const rawContent =
                typeof json?.content === "object" && json?.content !== null
                  ? json.content
                  : {};

              // Read style from content_json.style, falling back to "light"
              const savedStyle = json?.style?.style ?? "light";
              const savedCustomColor =
                json?.style?.customBackgroundColor ?? undefined;
              // Read animation settings from content_json
              const savedAnimation = (json as any)?.animation ?? "none";
              const savedAnimationDuration =
                (json as any)?.animationDuration ?? "normal";

              return {
                id: row.id,
                type: row.type as LessonBlockType, // "image-centered" or "image-fullwidth"
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
                mblMetadata: row.mbl_metadata,
                savedToDb: true,
                media_asset_id: row.media_asset_id ?? null,
                content: {
                  // Spread content from DB (media_asset_id, alt_text, caption, public_url, image, etc.)
                  media_asset_id:
                    (rawContent as any).media_asset_id ??
                    row.media_asset_id ??
                    null,
                  alt_text: (rawContent as any).alt_text ?? "",
                  caption: (rawContent as any).caption ?? null,
                  public_url: (rawContent as any).public_url ?? null,
                  image: (rawContent as any).image ?? null,
                  animation: savedAnimation as BlockAnimation,
                  animationDuration:
                    savedAnimationDuration as AnimationDuration,
                },
              };
            }

            // ---------------------------------------------------------------
            // Handle image-text blocks
            // ---------------------------------------------------------------
            if (row.type === "image-text") {
              const rawContent =
                typeof json?.content === "object" && json?.content !== null
                  ? json.content
                  : {};

              // Read style from content_json.style, falling back to "light"
              const savedStyle = json?.style?.style ?? "light";
              const savedCustomColor =
                json?.style?.customBackgroundColor ?? undefined;
              // Read animation settings from content_json
              const savedAnimation = (json as any)?.animation ?? "none";
              const savedAnimationDuration =
                (json as any)?.animationDuration ?? "normal";

              // Extract body HTML from content.text.body (primary) or content.body (fallback)
              const savedText = (rawContent as any).text;
              const bodyHtml: string =
                (typeof savedText === "object" && savedText?.body) ||
                (rawContent as any).body ||
                "";

              // Extract layout content
              const savedLayout = (rawContent as any).layout ?? {};
              const rawImagePosition = savedLayout.imagePosition ?? "left";
              const rawImageWidth = savedLayout.imageWidth ?? 50;

              // Convert imageWidth from decimal (0.25, 0.5, 0.75) to integer (25, 50, 75) if needed
              const imageWidthInt: 25 | 50 | 75 =
                rawImageWidth <= 1
                  ? rawImageWidth === 0.25
                    ? 25
                    : rawImageWidth === 0.75
                    ? 75
                    : 50
                  : rawImageWidth === 25
                  ? 25
                  : rawImageWidth === 75
                  ? 75
                  : 50;

              // Extract image URL from content.image.url (primary) or content.public_url (fallback)
              const imageUrl: string | null =
                (rawContent as any).image?.url ||
                (rawContent as any).public_url ||
                null;

              // Debug log to verify data is being read correctly
              console.log("ImageText deserialize:", {
                rowId: row.id,
                bodyHtml:
                  bodyHtml.substring(0, 100) +
                  (bodyHtml.length > 100 ? "..." : ""),
                imageUrl,
                imagePosition: rawImagePosition,
                imageWidth: imageWidthInt,
              });

              return {
                id: row.id,
                type: "image-text" as LessonBlockType,
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
                mblMetadata: row.mbl_metadata,
                savedToDb: true,
                media_asset_id: row.media_asset_id ?? null,
                content: {
                  media_asset_id:
                    (rawContent as any).media_asset_id ??
                    row.media_asset_id ??
                    null,
                  // Use imageUrl which reads from both content.image.url and content.public_url
                  public_url: imageUrl,
                  alt_text: (rawContent as any).alt_text ?? "",
                  layout: {
                    imagePosition: rawImagePosition as "left" | "right",
                    imageWidth: imageWidthInt,
                  },
                  text: {
                    heading: "",
                    body: bodyHtml,
                  },
                  ai_metadata: (rawContent as any).ai_metadata ?? null,
                  animation: savedAnimation as BlockAnimation,
                  animationDuration:
                    savedAnimationDuration as AnimationDuration,
                },
              };
            }

            // ---------------------------------------------------------------
            // Handle flashcards blocks
            // ---------------------------------------------------------------
            if (row.type === "flashcards") {
              const rawContent =
                typeof json?.content === "object" && json?.content !== null
                  ? json.content
                  : {};

              // Read style from content_json.style, falling back to "light"
              const savedStyle = json?.style?.style ?? "light";
              const savedCustomColor =
                json?.style?.customBackgroundColor ?? undefined;
              // Read animation settings from content_json
              const savedAnimation = (json as any)?.animation ?? "none";
              const savedAnimationDuration =
                (json as any)?.animationDuration ?? "normal";

              // Extract cards array from content
              const savedCards = (rawContent as any).cards ?? [];
              const savedTitle = (rawContent as any).title ?? "Flashcards";

              console.log("Flashcards deserialize:", {
                rowId: row.id,
                cardCount: savedCards.length,
                title: savedTitle,
              });

              return {
                id: row.id,
                type: "flashcards" as LessonBlockType,
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
                mblMetadata: row.mbl_metadata,
                savedToDb: true,
                content: {
                  title: savedTitle,
                  cards: savedCards.map((card: any) => ({
                    id: card.id,
                    frontHtml: card.frontHtml ?? "",
                    backHtml: card.backHtml ?? "",
                    frontDisplayMode: card.frontDisplayMode ?? "text",
                    backDisplayMode: card.backDisplayMode ?? "text",
                    frontImage: card.frontImage ?? null,
                    backImage: card.backImage ?? null,
                  })),
                  animation: savedAnimation as BlockAnimation,
                  animationDuration:
                    savedAnimationDuration as AnimationDuration,
                },
              };
            }

            // ---------------------------------------------------------------
            // Handle sorting activity blocks
            // ---------------------------------------------------------------
            if (row.type === "sorting_activity") {
              const rawContent =
                typeof json?.content === "object" && json?.content !== null
                  ? json.content
                  : {};

              const savedStyle = json?.style?.style ?? "light";
              const savedCustomColor =
                json?.style?.customBackgroundColor ?? undefined;
              const savedAnimation = (json as any)?.animation ?? "none";
              const savedAnimationDuration =
                (json as any)?.animationDuration ?? "normal";

              const categories = (rawContent as any).categories ?? [];
              const items = (rawContent as any).items ?? [];
              const settings = (rawContent as any).settings ?? {};

              return {
                id: row.id,
                type: "sorting_activity" as LessonBlockType,
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
                mblMetadata: row.mbl_metadata,
                savedToDb: true,
                content: {
                  title: (rawContent as any).title ?? "",
                  instructions: (rawContent as any).instructions ?? "",
                  categories,
                  items,
                  settings,
                  animation: savedAnimation as BlockAnimation,
                  animationDuration:
                    savedAnimationDuration as AnimationDuration,
                },
              };
            }

            // ---------------------------------------------------------------
            // Handle text-based blocks (row.type === "text")
            // ---------------------------------------------------------------
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

  const handleToggleMetadataPanel = useCallback(
    (blockId: string) => {
      setOpenMetadataBlockId((prev) => (prev === blockId ? null : blockId));
    },
    [blocks]
  );

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

  // Create a new flashcards block at a specific index or at the end
  const createFlashcardsBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "flashcards",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          blockType: "flashcards",
          cards: [
            {
              id: "card-1",
              frontHtml: "<p>What does PPE stand for?</p>",
              backHtml:
                "<p>PPE stands for <strong>Personal Protective Equipment</strong>.</p>",
            },
            {
              id: "card-2",
              frontHtml: "<p>When should you report a safety hazard?</p>",
              backHtml:
                "<p>As soon as you notice it, <em>even if no one has been hurt</em>.</p>",
            },
            {
              id: "card-3",
              frontHtml:
                "<p>Why does MyLMS use Memory-Based Learning (MBL)?</p>",
              backHtml:
                "<p>To adapt training to each learner's behaviour, not to measure how 'smart' they are.</p>",
            },
          ],
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

  const handleAddFlashcardsBlock = () => {
    createFlashcardsBlockAtIndex(pendingInsertIndex);
  };

  // Create a new sorting activity block at a specific index or at the end
  const createSortingActivityBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "sorting_activity",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          title: "Sorting activity",
          instructions: "Drag each item into the correct category.",
          categories: [
            { id: "cat-1", label: "Category 1" },
            { id: "cat-2", label: "Category 2" },
          ],
          items: [
            { id: "item-1", text: "Item 1", correctCategoryId: "cat-1" },
            { id: "item-2", text: "Item 2", correctCategoryId: "cat-2" },
            { id: "item-3", text: "Item 3", correctCategoryId: "cat-1" },
          ],
          settings: {
            randomizeOrder: true,
            showPerItemFeedback: true,
          },
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

  const handleAddSortingActivityBlock = () => {
    createSortingActivityBlockAtIndex(pendingInsertIndex);
  };

  // Create a new image-centered block at a specific index or at the end
  const createImageCenteredBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "image-centered",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          // ImageCenteredContent default values
          media_asset_id: null,
          alt_text: "",
          caption: null,
          public_url: null,
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

  const handleAddImageCenteredBlock = () => {
    createImageCenteredBlockAtIndex(pendingInsertIndex);
  };

  // Create a new image-fullwidth block at a specific index or at the end
  const createImageFullWidthBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "image-fullwidth",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          // ImageFullWidthContent default values
          media_asset_id: null,
          alt_text: "",
          caption: null,
          public_url: null,
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

  const handleAddImageFullWidthBlock = () => {
    createImageFullWidthBlockAtIndex(pendingInsertIndex);
  };

  // Create a new image-text block at a specific index or at the end
  const createImageTextBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: "image-text",
        orderIndex: 0, // will be recalculated
        style: "light",
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        metadata: { ...DEFAULT_BLOCK_METADATA },
        content: {
          // ImageTextContent default values
          media_asset_id: null,
          public_url: null,
          alt_text: "",
          layout: {
            imagePosition: "left",
            imageWidth: 50,
          },
          text: {
            heading: "",
            body: "",
          },
          ai_metadata: null,
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

  const handleAddImageTextBlock = () => {
    createImageTextBlockAtIndex(pendingInsertIndex);
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

    // Define which block types are saved to content_module_blocks
    const textBlockTypes: LessonBlockType[] = [
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
        // For compound blocks, content is a StructuredBlockContent object (or custom content for interactive blocks)
        let blockContent: any = "";

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
        } else if (block.type === "image-centered") {
          // Store image content - includes both flat fields and structured image object
          blockContent = {
            media_asset_id:
              block.media_asset_id ?? block.content.media_asset_id ?? null,
            alt_text: block.content.alt_text ?? "",
            caption: block.content.caption ?? null,
            public_url: block.content.public_url ?? null,
            // Structured image object with full asset info
            image: block.content.image ?? {
              media_asset_id:
                block.media_asset_id ?? block.content.media_asset_id ?? null,
              url: block.content.public_url ?? null,
              alt_text: block.content.alt_text ?? "",
              title: "",
              description: "",
            },
          };
        } else if (block.type === "image-fullwidth") {
          // Store image content - includes both flat fields and structured image object
          blockContent = {
            media_asset_id:
              block.media_asset_id ?? block.content.media_asset_id ?? null,
            alt_text: block.content.alt_text ?? "",
            caption: block.content.caption ?? null,
            public_url: block.content.public_url ?? null,
            // Structured image object with full asset info
            image: block.content.image ?? {
              media_asset_id:
                block.media_asset_id ?? block.content.media_asset_id ?? null,
              url: block.content.public_url ?? null,
              alt_text: block.content.alt_text ?? "",
              title: "",
              description: "",
            },
          };
        } else if (block.type === "image-text") {
          // Store image-text content
          // Extract text content - handle both object and string formats
          const textContent = block.content.text;
          const textObject =
            typeof textContent === "object" && textContent !== null
              ? textContent
              : {
                  heading: "",
                  body: typeof textContent === "string" ? textContent : "",
                };

          // Extract layout content
          const layoutContent = block.content.layout;
          const layoutObject =
            typeof layoutContent === "object" && layoutContent !== null
              ? layoutContent
              : { imagePosition: "left" as const, imageWidth: 50 as const };

          blockContent = {
            media_asset_id:
              block.media_asset_id ?? block.content.media_asset_id ?? null,
            public_url: block.content.public_url ?? null,
            alt_text: block.content.alt_text ?? "",
            layout: {
              imagePosition: layoutObject.imagePosition ?? "left",
              imageWidth: layoutObject.imageWidth ?? 50,
            },
            text: {
              heading: textObject.heading ?? "",
              body: textObject.body ?? "",
            },
            ai_metadata: block.content.ai_metadata ?? null,
          };
        } else if (block.type === "flashcards") {
          // Store flashcards content - includes title and cards array
          const flashcardsContent = block.content as {
            cards?: FlashcardItem[];
            title?: string;
          };
          blockContent = {
            title: flashcardsContent?.title ?? null,
            cards: (flashcardsContent?.cards ?? []).map((card) => ({
              id: card.id,
              frontHtml: card.frontHtml ?? "",
              backHtml: card.backHtml ?? "",
              frontDisplayMode: card.frontDisplayMode ?? "text",
              backDisplayMode: card.backDisplayMode ?? "text",
              frontImage: card.frontImage ?? null,
              backImage: card.backImage ?? null,
            })),
          };
        } else if (block.type === "sorting_activity") {
          // Store sorting activity content (categories/items/settings)
          blockContent = block.content as SortingActivityContent;
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
          mediaType:
            block.type === "image-centered" ||
            block.type === "image-fullwidth" ||
            block.type === "image-text"
              ? "image"
              : null,
          isCore: null,
          difficultyLevel: null,
          // Pass media_asset_id for image blocks (FK to media_assets)
          mediaAssetId:
            block.type === "image-centered" ||
            block.type === "image-fullwidth" ||
            block.type === "image-text"
              ? block.media_asset_id ?? null
              : null,
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
                } else if (block.type === "image-centered") {
                  blockComponent = <ImageCenteredBlock {...commonBlockProps} />;
                } else if (block.type === "image-fullwidth") {
                  blockComponent = (
                    <ImageFullWidthBlock {...commonBlockProps} />
                  );
                } else if (block.type === "image-text") {
                  blockComponent = <ImageTextBlock {...commonBlockProps} />;
                } else if (block.type === "flashcards") {
                  blockComponent = (
                    <FlashcardsBlock
                      {...commonBlockProps}
                      moduleId={moduleId ?? null}
                      pageId={pageId ?? null}
                    />
                  );
                } else if (block.type === "sorting_activity") {
                  blockComponent = (
                    <SortingActivityBlock
                      {...commonBlockProps}
                      moduleId={moduleId ?? null}
                      pageId={pageId ?? null}
                    />
                  );
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
              ) : selectedCategory === "image" ? (
                <div className="space-y-3">
                  {IMAGE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        if (tpl.id === "image_centered") {
                          handleAddImageCenteredBlock();
                        } else if (tpl.id === "image_fullwidth") {
                          handleAddImageFullWidthBlock();
                        } else if (tpl.id === "image_text") {
                          handleAddImageTextBlock();
                        }
                      }}
                      className="w-full bg-white rounded-lg border border-gray-200 hover:border-orange-500 hover:shadow-sm text-left overflow-hidden transition-all"
                    >
                      {/* Visual preview - different icons for each image type */}
                      <div className="h-16 bg-gray-100 border-b border-gray-200 flex items-center justify-center">
                        {tpl.id === "image_centered" ? (
                          /* Centered image icon - small box in center */
                          <div className="w-12 h-10 bg-gray-200 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-gray-400"
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
                          </div>
                        ) : tpl.id === "image_fullwidth" ? (
                          /* Full width image icon - wide box spanning width */
                          <div className="w-full mx-3 h-10 bg-gray-200 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-gray-400"
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
                          </div>
                        ) : (
                          /* Image + Text icon - image box beside text lines */
                          <div className="flex items-center gap-2 mx-3 w-full">
                            {/* Image placeholder - same style as other image blocks */}
                            <div className="w-12 h-10 bg-gray-200 rounded border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                              <svg
                                className="w-5 h-5 text-gray-400"
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
                            </div>
                            {/* Text lines */}
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="h-2 bg-gray-300 rounded w-full" />
                              <div className="h-2 bg-gray-300 rounded w-4/5" />
                              <div className="h-2 bg-gray-300 rounded w-3/5" />
                            </div>
                          </div>
                        )}
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
              ) : selectedCategory === "interactive" ? (
                <div className="space-y-3">
                  {INTERACTIVE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        if (tpl.id === "flashcards") {
                          handleAddFlashcardsBlock();
                        } else if (tpl.id === "sorting_activity") {
                          handleAddSortingActivityBlock();
                        }
                      }}
                      className="w-full bg-white rounded-lg border border-gray-200 hover:border-orange-500 hover:shadow-sm text-left overflow-hidden transition-all"
                    >
                      {/* Visual preview - different for each template */}
                      <div className="h-16 bg-gray-100 border-b border-gray-200 flex items-center justify-center">
                        {tpl.id === "flashcards" ? (
                          <div className="flex gap-2">
                            {/* Card 1 */}
                            <div className="w-10 h-12 bg-white rounded border border-gray-300 shadow-sm flex items-center justify-center transform -rotate-6">
                              <span className="text-lg">?</span>
                            </div>
                            {/* Card 2 */}
                            <div className="w-10 h-12 bg-white rounded border border-gray-300 shadow-sm flex items-center justify-center transform rotate-3">
                              <span className="text-lg">💡</span>
                            </div>
                            {/* Card 3 */}
                            <div className="w-10 h-12 bg-orange-50 rounded border border-orange-300 shadow-sm flex items-center justify-center transform rotate-6">
                              <span className="text-lg">✓</span>
                            </div>
                          </div>
                        ) : tpl.id === "sorting_activity" ? (
                          <div className="flex gap-3 items-end">
                            {/* Left category box */}
                            <div className="w-12 h-10 bg-blue-50 rounded border-2 border-dashed border-blue-300 flex items-center justify-center">
                              <span className="text-xs text-blue-600 font-medium">
                                A
                              </span>
                            </div>
                            {/* Draggable item */}
                            <div className="w-14 h-8 bg-white rounded border border-gray-300 shadow-sm flex items-center justify-center transform -translate-y-2">
                              <span className="text-xs text-gray-600">
                                Item
                              </span>
                            </div>
                            {/* Right category box */}
                            <div className="w-12 h-10 bg-green-50 rounded border-2 border-dashed border-green-300 flex items-center justify-center">
                              <span className="text-xs text-green-600 font-medium">
                                B
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-2xl">📦</div>
                        )}
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
          <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
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

              {/* Preview Size Buttons */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                {/* Desktop */}
                <button
                  type="button"
                  onClick={() => setPreviewWidth("desktop")}
                  className={`p-2 rounded-md transition-colors ${
                    previewWidth === "desktop"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  }`}
                  title="Desktop (896px)"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect
                      x="2"
                      y="3"
                      width="20"
                      height="14"
                      rx="2"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M8 21h8M12 17v4"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                {/* Tablet */}
                <button
                  type="button"
                  onClick={() => setPreviewWidth("tablet")}
                  className={`p-2 rounded-md transition-colors ${
                    previewWidth === "tablet"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  }`}
                  title="Tablet (768px)"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect
                      x="4"
                      y="2"
                      width="16"
                      height="20"
                      rx="2"
                      strokeWidth="1.5"
                    />
                    <circle cx="12" cy="18" r="1" fill="currentColor" />
                  </svg>
                </button>
                {/* Mobile */}
                <button
                  type="button"
                  onClick={() => setPreviewWidth("mobile")}
                  className={`p-2 rounded-md transition-colors ${
                    previewWidth === "mobile"
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  }`}
                  title="Mobile (375px)"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect
                      x="6"
                      y="2"
                      width="12"
                      height="20"
                      rx="2"
                      strokeWidth="1.5"
                    />
                    <circle cx="12" cy="18" r="1" fill="currentColor" />
                  </svg>
                </button>
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
            <div className="flex-1 overflow-y-auto bg-gray-200 flex justify-center">
              {/* Preview Frame - resizable based on selected width */}
              <div
                className={`bg-white transition-all duration-300 shadow-lg ${
                  previewWidth === "desktop"
                    ? "w-full max-w-4xl"
                    : previewWidth === "tablet"
                    ? "w-[768px]"
                    : "w-[375px]"
                }`}
                style={{
                  minHeight: "100%",
                }}
              >
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
                            className={
                              block.type === "image-fullwidth"
                                ? "w-full"
                                : `${getContentWidthClasses(
                                    layout.contentWidth
                                  )} px-8`
                            }
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
                                    __html:
                                      block.content.columnOneContent || "",
                                  }}
                                />
                                <div
                                  className="flex-1 prose prose-lg max-w-none"
                                  dangerouslySetInnerHTML={{
                                    __html:
                                      block.content.columnTwoContent || "",
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

                            {/* Image Centered */}
                            {block.type === "image-centered" && (
                              <div className="flex flex-col items-center">
                                {block.content.public_url ? (
                                  <>
                                    <img
                                      src={block.content.public_url as string}
                                      alt={
                                        (block.content.alt_text as string) ||
                                        "Image"
                                      }
                                      className="max-w-[600px] w-full h-auto rounded-lg"
                                    />
                                    {block.content.caption && (
                                      <p className="mt-2 text-sm text-gray-600 italic text-center">
                                        {block.content.caption as string}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <div className="py-4 text-center text-gray-400 italic text-sm">
                                    Image not selected
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Image Full Width */}
                            {block.type === "image-fullwidth" && (
                              <div className="w-full">
                                {block.content.public_url ? (
                                  <>
                                    <img
                                      src={block.content.public_url as string}
                                      alt={
                                        (block.content.alt_text as string) ||
                                        "Image"
                                      }
                                      className="w-full h-auto object-cover rounded-md"
                                    />
                                    {block.content.caption && (
                                      <p className="mt-2 text-sm text-gray-600 italic text-center">
                                        {block.content.caption as string}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <div className="py-4 text-center text-gray-400 italic text-sm">
                                    Image not selected
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Image + Text */}
                            {block.type === "image-text" &&
                              (() => {
                                const imagePosition =
                                  (block.content.layout as any)
                                    ?.imagePosition || "left";
                                const imageWidth =
                                  (block.content.layout as any)?.imageWidth ||
                                  50;
                                const textContent = block.content.text as
                                  | { heading: string; body: string }
                                  | undefined;
                                const heading = textContent?.heading || "";
                                const body = textContent?.body || "";

                                const getImageWidthClass = () => {
                                  switch (imageWidth) {
                                    case 25:
                                      return "w-1/4";
                                    case 75:
                                      return "w-3/4";
                                    default:
                                      return "w-1/2";
                                  }
                                };
                                const getTextWidthClass = () => {
                                  switch (imageWidth) {
                                    case 25:
                                      return "w-3/4";
                                    case 75:
                                      return "w-1/4";
                                    default:
                                      return "w-1/2";
                                  }
                                };

                                const imageElement = block.content
                                  .public_url ? (
                                  <img
                                    src={block.content.public_url as string}
                                    alt={
                                      (block.content.alt_text as string) ||
                                      "Image"
                                    }
                                    className="w-full h-auto object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                                    <span className="text-gray-400 text-sm">
                                      No image
                                    </span>
                                  </div>
                                );

                                const textElement = (
                                  <div className="flex flex-col">
                                    {body && (
                                      <div
                                        className="prose prose-sm max-w-none text-gray-700"
                                        dangerouslySetInnerHTML={{
                                          __html: body,
                                        }}
                                      />
                                    )}
                                  </div>
                                );

                                return (
                                  <div
                                    className={`flex gap-6 ${
                                      imagePosition === "right"
                                        ? "flex-row-reverse"
                                        : "flex-row"
                                    }`}
                                  >
                                    <div className={getImageWidthClass()}>
                                      {imageElement}
                                    </div>
                                    <div
                                      className={`${getTextWidthClass()} flex items-center`}
                                    >
                                      {textElement}
                                    </div>
                                  </div>
                                );
                              })()}

                            {/* Flashcards */}
                            {block.type === "flashcards" && (
                              <FlashcardsPreview
                                cards={
                                  block.content.cards as
                                    | FlashcardItem[]
                                    | undefined
                                }
                                previewWidth={previewWidth}
                                blockId={block.id}
                                pageId={pageId}
                              />
                            )}

                            {/* Sorting Activity */}
                            {block.type === "sorting_activity" && (
                              <SortingActivityLearner
                                moduleId={moduleId ?? null}
                                pageId={pageId}
                                blockId={block.id}
                                content={
                                  block.content as SortingActivityContent
                                }
                              />
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
                {/* End Blocks */}
              </div>
              {/* End Preview Frame */}
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
