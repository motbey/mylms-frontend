import React from "react";

// ---------------------------------------------------------------------------
// Types for the Ordered List block
// ---------------------------------------------------------------------------

/**
 * List style options for ordered lists.
 */
export type OrderedListStyle =
  | "decimal" // 1, 2, 3
  | "lower-alpha" // a, b, c
  | "upper-alpha" // A, B, C
  | "lower-roman" // i, ii, iii
  | "upper-roman"; // I, II, III

/**
 * A single item in the ordered list.
 * - body: HTML string (already sanitised on the backend)
 * - children: optional nested items (max 2 levels)
 */
export interface NumberedListItem {
  body: string;
  children?: NumberedListItem[];
}

/**
 * Content structure for an ordered list block.
 * - items: array of list items
 * - start: starting number for the list (defaults to 1)
 * - style: level-1 list style type (defaults to "decimal")
 * - subStyle: level-2 list style type (defaults to "lower-alpha")
 */
export interface NumberedListContent {
  items: NumberedListItem[];
  start?: number;
  style?: OrderedListStyle;
  subStyle?: OrderedListStyle;
  // Legacy field for backwards compatibility
  startNumber?: number;
}

/**
 * The full block structure as stored in content_json.
 */
export interface NumberedListBlock {
  blockType: "numbered-list";
  content: NumberedListContent;
  metadata?: unknown;
}

// ---------------------------------------------------------------------------
// Props for the viewer component
// ---------------------------------------------------------------------------

export interface NumberedListBlockViewProps {
  block: NumberedListBlock;
  /** Optional additional class names for the wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helper function to convert number to list marker format
// ---------------------------------------------------------------------------

function getListMarker(num: number, style: OrderedListStyle | undefined): string {
  switch (style) {
    case "lower-alpha":
      return String.fromCharCode(97 + ((num - 1) % 26));
    case "upper-alpha":
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
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  for (const [value, numeral] of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// OrderedListBlockView Component
// ---------------------------------------------------------------------------

/**
 * Renders an ordered list block for learner/viewer mode.
 *
 * Supports 2 levels of nesting:
 * - Level 1: Main list items
 * - Level 2: Nested children items
 *
 * Uses semantic HTML (<ol>/<li>) with native list markers.
 */
export function NumberedListBlockView({
  block,
  className = "",
}: NumberedListBlockViewProps) {
  const { items = [], start, startNumber, style, subStyle } = block.content;

  // Handle backwards compatibility
  const listStart = start ?? startNumber ?? 1;

  // If no items, render nothing
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-2xl p-6 md:p-8 ${className}`}>
      <div className="space-y-4" role="list">
        {items.map((item, index) => {
          const marker = getListMarker(listStart + index, style);
          return (
            <div key={index}>
              {/* Top-level item with badge */}
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white font-semibold text-sm">
                  {marker}
                </div>
                <div className="flex-1 pt-2">
                  <div
                    className="prose prose-sm max-w-none [&>p]:m-0 [&>p:not(:last-child)]:mb-2 text-gray-800"
                    dangerouslySetInnerHTML={{ __html: item.body }}
                  />
                </div>
              </div>

              {/* Nested children (level 2) */}
              {item.children && item.children.length > 0 && (
                <div className="ml-14 mt-3 space-y-3">
                  {item.children.map((child, childIndex) => {
                    const childMarker = getListMarker(
                      childIndex + 1,
                      subStyle ?? "lower-alpha"
                    );
                    return (
                      <div key={childIndex} className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-400 text-white font-medium text-xs">
                          {childMarker}
                        </div>
                        <div className="flex-1 pt-1">
                          <div
                            className="prose prose-sm max-w-none [&>p]:m-0 [&>p:not(:last-child)]:mb-2 text-gray-700"
                            dangerouslySetInnerHTML={{ __html: child.body }}
                          />
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
    </div>
  );
}

export default NumberedListBlockView;
