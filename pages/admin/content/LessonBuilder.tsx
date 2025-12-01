import React, { Fragment, useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronUp, ChevronDown, Copy, Trash2, X, LayoutGrid, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import TipTapEditor from '../../../src/components/editor/TipTapEditor';
import { BlockStyleMenu, type BlockStyle } from '../../../src/components/blocks/BlockStyleMenu';

type LessonPage = {
  id: string;
  title: string;
};

// Layout types
type ContentWidth = 'S' | 'M' | 'L';
type PaddingSize = 'S' | 'M' | 'L';

interface BlockLayout {
  contentWidth: ContentWidth;
  paddingSize: PaddingSize;
  paddingTop: number;
  paddingBottom: number;
}

// Default layout values
const DEFAULT_BLOCK_LAYOUT: BlockLayout = {
  contentWidth: 'M',
  paddingSize: 'M',
  paddingTop: 60,
  paddingBottom: 60,
};

// Padding presets
const PADDING_PRESETS: Record<PaddingSize, number> = {
  S: 30,
  M: 60,
  L: 120,
};

// Block types
type LessonBlockType = 'paragraph';

interface LessonBlock {
  id: string;
  type: LessonBlockType;
  orderIndex: number;
  style: BlockStyle;
  customBackgroundColor?: string; // hex, e.g. "#F4EBE5" – used when style === 'custom'
  layout: BlockLayout;
  content: {
    html?: string;
    text?: string; // legacy support
    [key: string]: unknown;
  };
}

// Helper to get Tailwind classes for block styles
function getBlockStyleClasses(style: BlockStyle): string {
  switch (style) {
    case 'light':
      return 'bg-gray-50 text-gray-900';
    case 'gray':
      return 'bg-gray-200 text-gray-900';
    case 'theme':
      return 'bg-[#ff7a1a] text-white';
    case 'themeTint':
      return 'bg-[#FFE2CC] text-gray-900';
    case 'dark':
      return 'bg-neutral-800 text-white';
    case 'black':
      return 'bg-black text-white';
    case 'custom':
      // Custom is handled via inline style, keep text neutral by default
      return 'text-gray-900';
    case 'image':
      return 'bg-cover bg-center bg-gradient-to-br from-gray-600 to-gray-800 text-white'; // placeholder gradient
    default:
      return 'bg-white text-gray-900';
  }
}

// Helper to get content width classes
function getContentWidthClasses(width: ContentWidth): string {
  switch (width) {
    case 'S':
      return 'max-w-2xl mx-auto';
    case 'M':
      return 'max-w-3xl mx-auto';
    case 'L':
      return 'max-w-5xl mx-auto';
    default:
      return 'max-w-3xl mx-auto';
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

const FormatPanel: React.FC<FormatPanelProps> = ({ layout, onChange, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
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
            {(['S', 'M', 'L'] as ContentWidth[]).map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => handleContentWidthChange(width)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                  layout.contentWidth === width
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
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
            {(['S', 'M', 'L'] as PaddingSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handlePaddingSizeChange(size)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                  layout.paddingSize === size
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
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
                  onChange={(e) => handlePaddingTopChange(Number(e.target.value))}
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
                onChange={(e) => handlePaddingBottomChange(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#ff7a00]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="160"
                  value={layout.paddingBottom}
                  onChange={(e) => handlePaddingBottomChange(Number(e.target.value))}
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

// ParagraphBlock component
interface ParagraphBlockProps {
  block: LessonBlock;
  onChange: (updated: LessonBlock) => void;
  onStyleChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  onLayoutChange: (layout: BlockLayout) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isFormatPanelOpen: boolean;
  onToggleFormatPanel: () => void;
}

const ParagraphBlock: React.FC<ParagraphBlockProps> = ({
  block,
  onChange,
  onStyleChange,
  onLayoutChange,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isFormatPanelOpen,
  onToggleFormatPanel,
}) => {
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Get initial HTML content
  const initialHtml =
    block.content.html && block.content.html.trim().length > 0
      ? block.content.html
      : '<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>';

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
    block.style === 'custom' && block.customBackgroundColor
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
        style={inlineBackgroundColor ? { backgroundColor: inlineBackgroundColor } : undefined}
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
                ? 'text-[#ff7a00] bg-orange-50'
                : 'text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>

          {/* Style (palette) - opens BlockStyleMenu */}
          <button
            type="button"
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
              styleMenuOpen
                ? 'text-[#ff7a00] bg-orange-50'
                : 'text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50'
            }`}
            title="Block style"
            onClick={(e) => {
              e.stopPropagation();
              setStyleMenuOpen((prev) => !prev);
            }}
          >
            🎨
          </button>

          {/* Appearance */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            title="Block appearance"
          >
            ✏️
          </button>

          {/* Memory-learning metadata */}
          <button
            type="button"
            className="inline-flex items-center justify-center h-6 w-6 text-slate-500 hover:text-[#ff7a00] hover:bg-slate-50 rounded-full transition-colors"
            title="Block metadata (learning fingerprint)"
          >
            ✨
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

        {/* Block Style Menu – positioned relative to the block */}
        <BlockStyleMenu
          open={styleMenuOpen}
          onClose={() => setStyleMenuOpen(false)}
          style={block.style}
          customBackgroundColor={block.customBackgroundColor}
          onChange={(newStyle, customColor) => {
            onStyleChange(newStyle, customColor);
            // Don't close menu when selecting custom - let the color picker handle it
            if (newStyle !== 'custom') {
              setStyleMenuOpen(false);
            }
          }}
          className="top-14 left-4"
        />

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
            ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
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
  | 'text'
  | 'statement'
  | 'quote'
  | 'list'
  | 'image'
  | 'gallery'
  | 'multimedia'
  | 'interactive'
  | 'knowledge_check'
  | 'chart'
  | 'divider'
  | 'block_templates'
  | 'code';

type BlockTemplate = {
  id: string;
  title: string;
  description: string;
};

const BLOCK_LIBRARY_CATEGORIES: { id: BlockCategoryId; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'statement', label: 'Statement' },
  { id: 'quote', label: 'Quote' },
  { id: 'list', label: 'List' },
  { id: 'image', label: 'Image' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'multimedia', label: 'Multimedia' },
  { id: 'interactive', label: 'Interactive' },
  { id: 'knowledge_check', label: 'Knowledge Check' },
  { id: 'chart', label: 'Chart' },
  { id: 'divider', label: 'Divider' },
  { id: 'block_templates', label: 'Block Templates' },
  { id: 'code', label: 'Code' },
];

const TEXT_TEMPLATES: BlockTemplate[] = [
  {
    id: 'paragraph',
    title: 'Paragraph',
    description: 'Write free-form text with a simple paragraph block.',
  },
  {
    id: 'paragraph_heading',
    title: 'Paragraph with heading',
    description: 'Add a heading above your paragraph to introduce the topic.',
  },
  {
    id: 'paragraph_subheading',
    title: 'Paragraph with subheading',
    description: 'Use a smaller subheading to add structure to your content.',
  },
  {
    id: 'columns',
    title: 'Columns',
    description: 'Display text in multiple columns for comparison or summaries.',
  },
  {
    id: 'table',
    title: 'Table',
    description: 'Organise text into a simple table layout.',
  },
];

const LessonBuilder: React.FC = () => {
  const { moduleId, pageId } = useParams<{ moduleId: string; pageId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<LessonPage | null>(null);
  const [loading, setLoading] = useState(true);

  // Author state (from authenticated user)
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorInitials, setAuthorInitials] = useState<string>('?');

  // Block Library panel state
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BlockCategoryId | null>(null);

  // Blocks state
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);

  // Format panel state - tracks which block's format panel is open
  const [openFormatBlockId, setOpenFormatBlockId] = useState<string | null>(null);

  // Hover state - tracks which block is currently hovered (for insertion handles)
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  // Hover state - tracks which insertion handle is being hovered
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(null);

  // Pending insertion index - where to insert the next block when selected from Block Library
  const [pendingInsertIndex, setPendingInsertIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadPageAndUser = async () => {
      if (!pageId) {
        setLoading(false);
        return;
      }

      // Load lesson page
      const { data, error } = await supabase
        .from('content_module_pages')
        .select('id, title')
        .eq('id', pageId)
        .single();

      if (error) {
        console.error('Error loading lesson page', error);
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
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('user_id', user.id)
          .single();

        let displayName = user.email ?? '';

        if (profile && !profileError) {
          const parts: string[] = [];
          if (profile.first_name) parts.push(profile.first_name);
          if (profile.last_name) parts.push(profile.last_name);
          if (parts.length > 0) {
            displayName = parts.join(' ');
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

      setLoading(false);
    };

    loadPageAndUser();
  }, [pageId]);

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
        b.id === blockId
          ? { ...b, style: newStyle, customBackgroundColor }
          : b
      )
    );
  };

  const handleLayoutChange = (blockId: string, newLayout: BlockLayout) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, layout: newLayout } : b
      )
    );
  };

  const handleToggleFormatPanel = useCallback((blockId: string) => {
    setOpenFormatBlockId((prev) => (prev === blockId ? null : blockId));
  }, []);

  // Handle click on insertion handle between blocks
  const handleInsertClick = (index: number) => {
    setPendingInsertIndex(index);
    setIsBlockLibraryOpen(true);
  };

  // Create a new paragraph block at a specific index or at the end
  const createParagraphBlockAtIndex = (insertIndex: number | null) => {
    setBlocks((prev) => {
      const newBlock: LessonBlock = {
        id: crypto.randomUUID(),
        type: 'paragraph',
        orderIndex: 0, // will be recalculated
        style: 'light',
        customBackgroundColor: undefined,
        layout: { ...DEFAULT_BLOCK_LAYOUT },
        content: {
          html: '<p>When we show up to the present moment with all of our senses, we invite the world to fill us with joy. The pains of the past are behind us. The future has yet to unfold. But the now is full of beauty simply waiting for our attention.</p>',
        },
      };

      let newBlocks: LessonBlock[];

      if (insertIndex !== null && insertIndex >= 0 && insertIndex <= prev.length) {
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

  const handleDeleteBlock = (blockId: string) => {
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

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;

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

  const handleMoveBlockUp = (blockId: string) => moveBlock(blockId, 'up');
  const handleMoveBlockDown = (blockId: string) => moveBlock(blockId, 'down');

  const title = page?.title || 'Lesson';

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
            if (moduleId) {
              navigate(`/admin/content/module-builder/${moduleId}`);
            } else {
              navigate('/admin/content/module-builder');
            }
          }}
          className="text-blue-600 hover:underline mb-6 inline-block text-sm"
        >
          &larr; Back to Module Builder
        </button>

        {/* Lesson title */}
        <h1 className="text-4xl font-light text-gray-700 mb-6">{title}</h1>

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
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="4" y="4" width="6" height="6" rx="1" />
                  <rect x="14" y="4" width="6" height="6" rx="1" />
                  <rect x="4" y="14" width="6" height="6" rx="1" />
                  <rect x="14" y="14" width="6" height="6" rx="1" />
                </svg>
                <span className="text-[10px] text-white font-medium leading-tight">Block</span>
                <span className="text-[10px] text-white font-medium leading-tight -mt-0.5">Library</span>
              </button>

              {/* Block type icons */}
              <div className="flex items-center gap-4">
                {/* Text */}
                <button
                  type="button"
                  onClick={handleAddParagraphBlock}
                  className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  <span className="text-xs text-red-500 font-medium">Text</span>
                </button>

                {/* List */}
                <button
                  type="button"
                  onClick={() => console.log('List block clicked')}
                  className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span className="text-xs text-gray-600 font-medium">List</span>
                </button>

                {/* Image */}
                <button
                  type="button"
                  onClick={() => console.log('Image block clicked')}
                  className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-600 font-medium">Image</span>
                </button>

                {/* Video */}
                <button
                  type="button"
                  onClick={() => console.log('Video block clicked')}
                  className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-600 font-medium">Video</span>
                </button>

                {/* Process */}
                <button
                  type="button"
                  onClick={() => console.log('Process block clicked')}
                  className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="text-xs text-gray-600 font-medium">Process</span>
                </button>

                {/* Flashcards */}
                <button
                  type="button"
                  onClick={() => console.log('Flashcards block clicked')}
                  className="flex flex-col items-center justify-center gap-2 w-20 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-xs text-gray-600 font-medium">Flashcards</span>
                </button>

                {/* Sorting */}
                <button
                  type="button"
                  onClick={() => console.log('Sorting block clicked')}
                  className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-xs text-gray-600 font-medium">Sorting</span>
                </button>

                {/* Continue */}
                <button
                  type="button"
                  onClick={() => console.log('Continue block clicked')}
                  className="flex flex-col items-center justify-center gap-2 w-16 h-20 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-xs text-gray-600 font-medium">Continue</span>
                </button>
              </div>
            </div>
          </div>
          </div>
        ) : (
          /* Blocks list - FULL WIDTH (edge-to-edge) */
          <div>
            {(() => {
              const sortedBlocks = blocks.slice().sort((a, b) => a.orderIndex - b.orderIndex);
              return sortedBlocks.map((block, index) => {
                if (block.type === 'paragraph') {
                  return (
                    <Fragment key={block.id}>
                      <BlockHoverWrapper
                        onMouseEnter={() => setHoveredBlockId(block.id)}
                        onMouseLeave={() => setHoveredBlockId(null)}
                      >
                        <ParagraphBlock
                          block={block}
                          onChange={handleUpdateBlock}
                          onStyleChange={(newStyle, customColor) =>
                            handleBlockStyleChange(block.id, newStyle, customColor)
                          }
                          onLayoutChange={(newLayout) =>
                            handleLayoutChange(block.id, newLayout)
                          }
                          onDuplicate={() => handleDuplicateBlock(block.id)}
                          onDelete={() => handleDeleteBlock(block.id)}
                          onMoveUp={() => handleMoveBlockUp(block.id)}
                          onMoveDown={() => handleMoveBlockDown(block.id)}
                          canMoveUp={index > 0}
                          canMoveDown={index < sortedBlocks.length - 1}
                          isFormatPanelOpen={openFormatBlockId === block.id}
                          onToggleFormatPanel={() => handleToggleFormatPanel(block.id)}
                        />
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
                }
                return null;
              });
            })()}

            {/* Add block button below existing blocks (centered) */}
            <div className="max-w-4xl mx-auto px-8 mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setIsBlockLibraryOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
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
        className={`fixed inset-0 z-50 ${isBlockLibraryOpen ? 'visible' : 'invisible'}`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
            isBlockLibraryOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => {
            setIsBlockLibraryOpen(false);
            setPendingInsertIndex(null);
          }}
        />

        {/* Slide-out panel with categories + templates */}
        <div
          className={`absolute inset-y-0 left-0 bg-white shadow-xl border-r border-gray-200 transform transition-all duration-200 flex flex-col ${
            isBlockLibraryOpen ? 'translate-x-0' : '-translate-x-full'
          } ${selectedCategory ? 'w-[500px]' : 'w-48'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Block Library</h2>
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
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              ))}
            </nav>

            {/* Templates panel - hidden until a category is selected */}
            <section
              className={`absolute top-0 bottom-0 left-44 right-0 bg-gray-50 border-l border-gray-200 px-4 py-4 overflow-y-auto transform transition-transform duration-200 ${
                selectedCategory ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              {selectedCategory === 'text' ? (
                <div className="space-y-3">
                  {TEXT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        if (tpl.id === 'paragraph') {
                          handleAddParagraphBlock();
                        } else {
                          console.log('Selected text template', tpl.id);
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
              ) : selectedCategory ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">
                  <div className="text-center">
                    <div className="text-2xl mb-2">📦</div>
                    <div>
                      Templates for{' '}
                      <span className="font-medium text-gray-700">
                        {BLOCK_LIBRARY_CATEGORIES.find((c) => c.id === selectedCategory)?.label}
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
    </div>
  );
};

export default LessonBuilder;

