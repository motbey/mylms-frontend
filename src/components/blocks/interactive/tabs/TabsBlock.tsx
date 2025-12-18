import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Palette,
  PanelsLeftRight,
  Stars,
  Trash2,
} from "lucide-react";
import type { TabsContent } from "./tabs-types";
import { TabsEditor } from "./TabsEditor";
import { TabsLearner } from "./TabsLearner";
import { BlockStyleMenu, type BlockStyle } from "../../BlockStyleMenu";
import {
  AppearancePanel,
  BlockMetadataPopover,
  BlockWrapper,
  FormatPanel,
  getBlockStyleClasses,
} from "../../shared/LessonBuilderInternals";
import {
  DEFAULT_BLOCK_LAYOUT,
  hasBlockMetadata,
  type BlockLayout,
  type BlockMetadata,
} from "../../../../types/blocks";
import type {
  AnimationDuration,
  BlockAnimation,
  LessonBlock,
} from "../../../../../pages/admin/content/LessonBuilder";

type TabsBlockProps = {
  block: LessonBlock;
  onChange: (updatedBlock: LessonBlock) => void;
  isPreviewMode?: boolean;
  moduleId?: string | null;
  pageId?: string | null;

  // Standard block toolbar props
  onStyleChange?: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange?: (layout: BlockLayout) => void;
  onMetadataChange?: (metadata: BlockMetadata) => void;
  onMblMetadataCleared?: () => void;
  onMblMetadataUpdated?: (mblMetadata: unknown) => void;
  onAnimationChange?: (animation: BlockAnimation) => void;
  onDurationChange?: (duration: AnimationDuration) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isFormatPanelOpen?: boolean;
  onToggleFormatPanel?: () => void;
  isMetadataPanelOpen?: boolean;
  onToggleMetadataPanel?: () => void;
  isAppearancePanelOpen?: boolean;
  onToggleAppearancePanel?: () => void;
  savedToDb?: boolean;
  mblMetadata?: unknown;

  [key: string]: unknown;
};

function stripHtmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|br|h1|h2|h3|h4|h5|h6)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
}

function summariseTabsForMetadata(content: TabsContent): string {
  const parts: string[] = [];
  if (content.title?.trim()) parts.push(`Title: ${content.title.trim()}`);

  const tabs = content.tabs ?? [];
  parts.push(`Tabs: ${tabs.length}`);
  parts.push("");

  tabs.forEach((t, idx) => {
    const tabNumber = idx + 1;
    const title = t.title?.trim() || `Tab ${tabNumber}`;
    const body = stripHtmlToPlainText(t.content ?? "");
    const imageAlt = t.image?.alt?.trim() || "";

    parts.push(`Tab ${tabNumber}: ${title}`);
    if (body) parts.push(body);
    if (imageAlt) parts.push(`Image alt: ${imageAlt}`);
    parts.push("");
  });

  return parts.join("\n").trim();
}

export const TabsBlock: React.FC<TabsBlockProps> = (props) => {
  const {
    block,
    onChange,
    isPreviewMode = false,
    moduleId,
    pageId,
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
    canMoveUp = false,
    canMoveDown = false,
    isFormatPanelOpen = false,
    onToggleFormatPanel,
    isMetadataPanelOpen = false,
    onToggleMetadataPanel,
    isAppearancePanelOpen = false,
    onToggleAppearancePanel,
    savedToDb,
    mblMetadata,
  } = props;

  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const blockHasMetadata = hasBlockMetadata((block as any).metadata);

  const inlineBackgroundColor =
    (block as any).style === "custom" && (block as any).customBackgroundColor
      ? ((block as any).customBackgroundColor as string)
      : undefined;

  const layout = (block as any).layout || DEFAULT_BLOCK_LAYOUT;

  const tabsContent = (block.content ?? {}) as TabsContent;
  const metadataSummary = useMemo(
    () => summariseTabsForMetadata(tabsContent),
    [tabsContent]
  );

  const handleTabsContentChange = (next: TabsContent) => {
    const prevContent = block.content as unknown as Record<string, unknown>;
    const nextContent = next as unknown as Record<string, unknown>;
    onChange({
      ...block,
      content: {
        ...prevContent,
        ...nextContent,
      },
    });
  };

  return (
    <div className="w-full group">
      <div
        className={`
          relative w-full transition-all duration-300 ease-in-out
          ${getBlockStyleClasses((block as any).style)}
        `}
        style={inlineBackgroundColor ? { backgroundColor: inlineBackgroundColor } : undefined}
      >
        {/* LEFT GUTTER TOOLBAR */}
        {!isPreviewMode && (
          <div className="absolute left-4 top-6 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFormatPanel?.();
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

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleAppearancePanel?.();
              }}
              className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
                isAppearancePanelOpen
                  ? "text-[#ff7a00] bg-orange-50"
                  : (block as any).content?.animation &&
                    (block as any).content?.animation !== "none"
                  ? "text-purple-500 bg-purple-50"
                  : "text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50"
              }`}
              title="Block animation"
            >
              <Stars className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMetadataPanel?.();
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
        )}

        {/* RIGHT GUTTER TOOLBAR */}
        {!isPreviewMode && (
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
        )}

        {isFormatPanelOpen && !isPreviewMode && (
          <FormatPanel
            layout={layout}
            onChange={(next) => onLayoutChange?.(next)}
            onClose={() => onToggleFormatPanel?.()}
          />
        )}

        {isMetadataPanelOpen && !isPreviewMode && (
          <BlockMetadataPopover
            metadata={(block as any).metadata}
            onChange={(next) => onMetadataChange?.(next)}
            onClose={() => onToggleMetadataPanel?.()}
            blockId={block.id}
            blockType={block.type}
            blockContent={metadataSummary}
            savedToDb={(block as any).savedToDb ?? savedToDb}
            mblMetadata={(block as any).mblMetadata ?? mblMetadata}
            onMblMetadataCleared={onMblMetadataCleared}
            onMblMetadataUpdated={onMblMetadataUpdated}
          />
        )}

        <BlockStyleMenu
          open={styleMenuOpen}
          onClose={() => setStyleMenuOpen(false)}
          style={(block as any).style}
          customBackgroundColor={(block as any).customBackgroundColor}
          onChange={(newStyle, customColor) => {
            onStyleChange?.(newStyle, customColor);
            if (newStyle !== "custom") setStyleMenuOpen(false);
          }}
          className="top-14 left-4"
        />

        {isAppearancePanelOpen && !isPreviewMode && (
          <AppearancePanel
            animation={((block as any).content?.animation ?? "none") as any}
            duration={((block as any).content?.animationDuration ?? "normal") as any}
            onChange={(anim) => onAnimationChange?.(anim as any)}
            onDurationChange={(dur) => onDurationChange?.(dur as any)}
            onClose={() => onToggleAppearancePanel?.()}
          />
        )}

        <BlockWrapper layout={layout}>
          {isPreviewMode ? (
            <TabsLearner
              content={tabsContent}
              blockId={block.id}
              moduleId={moduleId ?? ""}
              lessonId={pageId ?? undefined}
            />
          ) : (
            <TabsEditor
              blockId={block.id}
              content={tabsContent}
              onChange={handleTabsContentChange}
            />
          )}
        </BlockWrapper>
      </div>
    </div>
  );
};


