/**
 * Shared Block Types for MyLMS Module/Lesson Builder
 * 
 * This file contains the base types for all content blocks.
 * All block types should extend BaseBlock to ensure consistent
 * metadata support and structure.
 */

// ============================================================================
// Block Metadata Types
// ============================================================================

/**
 * Metadata for learning analytics and AI processing.
 * Used to tag blocks with learning-related attributes.
 */
export interface BlockMetadata {
  /** Behaviour tag - e.g., 'attention', 'reflection', 'recall', 'instruction' */
  behaviourTag: string | null;
  /** Cognitive skill level (Bloom's taxonomy) - e.g., 'remember', 'understand', 'apply' */
  cognitiveSkill: string | null;
  /** Learning pattern - e.g., 'microlearning', 'scenario', 'spaced', 'jobaid' */
  learningPattern: string | null;
  /** Difficulty level (0-10), null means not set */
  difficulty: number | null;
  /** Free-text notes for AI/analytics */
  notes?: string | null;

  /** Who set these tags - 'ai' or 'human' or other string (legacy, use fieldSources instead) */
  source?: 'ai' | 'human' | string | null;

  /** Per-field source tracking - who set each individual field */
  fieldSources?: {
    behaviourTag?: 'ai' | 'human' | null;
    cognitiveSkill?: 'ai' | 'human' | null;
    learningPattern?: 'ai' | 'human' | null;
    difficulty?: 'ai' | 'human' | null;
  };

  /** AI explanations for each field */
  aiExplanations?: any;

  /** AI confidence scores for each field */
  aiConfidenceScores?: any;
}

/**
 * Default metadata values for new blocks
 */
export const DEFAULT_BLOCK_METADATA: BlockMetadata = {
  behaviourTag: null,
  cognitiveSkill: null,
  learningPattern: null,
  difficulty: null,
  notes: null,
};

/**
 * Helper function to check if a block has any metadata set
 */
export function hasBlockMetadata(metadata: BlockMetadata | undefined | null): boolean {
  if (!metadata) return false;
  return (
    (metadata.behaviourTag !== null && metadata.behaviourTag !== '') ||
    (metadata.cognitiveSkill !== null && metadata.cognitiveSkill !== '') ||
    (metadata.learningPattern !== null && metadata.learningPattern !== '') ||
    (metadata.difficulty !== null && metadata.difficulty > 0) ||
    (metadata.notes !== null && metadata.notes !== '')
  );
}

// ============================================================================
// Block Layout Types
// ============================================================================

export type ContentWidth = 'S' | 'M' | 'L';
export type PaddingSize = 'S' | 'M' | 'L';

export interface BlockLayout {
  contentWidth: ContentWidth;
  paddingSize: PaddingSize;
  paddingTop: number;
  paddingBottom: number;
}

export const DEFAULT_BLOCK_LAYOUT: BlockLayout = {
  contentWidth: 'M',
  paddingSize: 'M',
  paddingTop: 60,
  paddingBottom: 60,
};

export const PADDING_PRESETS: Record<PaddingSize, number> = {
  S: 30,
  M: 60,
  L: 120,
};

// ============================================================================
// Base Block Interface
// ============================================================================

/**
 * Base interface that all block types must extend.
 * Ensures consistent structure for metadata, layout, and ordering.
 */
export interface BaseBlock {
  /** Unique identifier for the block */
  id: string;
  /** Block type discriminator */
  type: string;
  /** Order index for sorting blocks */
  orderIndex: number;
  /** Optional metadata for learning analytics */
  metadata?: BlockMetadata;
  /** Optional layout settings */
  layout?: BlockLayout;
}

// ============================================================================
// Concrete Block Types
// ============================================================================

/**
 * Block style options for visual theming
 */
export type BlockStyle = 
  | 'light'
  | 'gray'
  | 'theme'
  | 'themeTint'
  | 'dark'
  | 'black'
  | 'custom'
  | 'image';

/**
 * Heading block - standalone heading without paragraph
 */
export interface HeadingBlock extends BaseBlock {
  type: 'heading';
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    heading?: string;
    [key: string]: unknown;
  };
}

/**
 * Subheading block - standalone subheading (smaller than heading)
 */
export interface SubheadingBlock extends BaseBlock {
  type: 'subheading';
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    subheading?: string;
    [key: string]: unknown;
  };
}

/**
 * Columns block - two side-by-side rich text columns
 */
export interface ColumnsBlock extends BaseBlock {
  type: 'columns';
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    columnOneContent?: string;
    columnTwoContent?: string;
    [key: string]: unknown;
  };
}

/**
 * Table block - editable table with rich text cells
 */
export interface TableBlock extends BaseBlock {
  type: 'table';
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    tableContent?: unknown; // TipTap JSON content
    borderMode?: 'normal' | 'dashed' | 'alternate';
    [key: string]: unknown;
  };
}

/**
 * Paragraph block - rich text content
 */
export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    html?: string;
    text?: string;
    [key: string]: unknown;
  };
}

/**
 * Paragraph with heading block - heading + paragraph content
 */
export interface ParagraphWithHeadingBlock extends BaseBlock {
  type: 'paragraph-with-heading';
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    heading?: string;
    html?: string;
    text?: string;
    [key: string]: unknown;
  };
}

/**
 * Paragraph with subheading block - smaller subheading + paragraph content
 */
export interface ParagraphWithSubheadingBlock extends BaseBlock {
  type: 'paragraph-with-subheading';
  style: BlockStyle;
  customBackgroundColor?: string;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    subheading?: string;
    html?: string;
    text?: string;
    [key: string]: unknown;
  };
}

/**
 * Image block - for displaying images
 */
export interface ImageBlock extends BaseBlock {
  type: 'image';
  style: BlockStyle;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    src: string;
    alt?: string;
    caption?: string;
  };
}

/**
 * Video block - for embedded videos
 */
export interface VideoBlock extends BaseBlock {
  type: 'video';
  style: BlockStyle;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    src: string;
    provider?: 'youtube' | 'vimeo' | 'upload';
    caption?: string;
  };
}

/**
 * Quote block - for highlighted quotes
 */
export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  style: BlockStyle;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    text: string;
    author?: string;
  };
}

/**
 * List block - for bullet/numbered lists
 */
export interface ListBlock extends BaseBlock {
  type: 'list';
  style: BlockStyle;
  layout: BlockLayout;
  metadata?: BlockMetadata;
  content: {
    listType: 'bullet' | 'numbered';
    items: string[];
  };
}

/**
 * Divider block - visual separator
 */
export interface DividerBlock extends BaseBlock {
  type: 'divider';
  style: BlockStyle;
  layout: BlockLayout;
  metadata?: BlockMetadata;
}

// ============================================================================
// Union Type for All Blocks
// ============================================================================

/**
 * Union type of all available block types.
 * Add new block types here as they are implemented.
 */
export type LessonBlock = 
  | HeadingBlock
  | SubheadingBlock
  | ParagraphBlock
  | ParagraphWithHeadingBlock
  | ParagraphWithSubheadingBlock
  | ColumnsBlock
  | TableBlock
  | ImageBlock
  | VideoBlock
  | QuoteBlock
  | ListBlock
  | DividerBlock;

/**
 * Type guard to check if a block is a specific type
 */
export function isBlockType<T extends LessonBlock['type']>(
  block: LessonBlock,
  type: T
): block is Extract<LessonBlock, { type: T }> {
  return block.type === type;
}

// ============================================================================
// Metadata Field Options (for popover UI)
// ============================================================================

export const BEHAVIOUR_TAG_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'attention', label: 'Attention / focus' },
  { value: 'reflection', label: 'Reflection' },
  { value: 'recall', label: 'Recall / quiz' },
  { value: 'instruction', label: 'Instruction / explanation' },
] as const;

export const COGNITIVE_SKILL_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'remember', label: 'Remember' },
  { value: 'understand', label: 'Understand' },
  { value: 'apply', label: 'Apply' },
  { value: 'analyse', label: 'Analyse' },
  { value: 'evaluate', label: 'Evaluate' },
  { value: 'create', label: 'Create' },
] as const;

export const LEARNING_PATTERN_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'microlearning', label: 'Microlearning' },
  { value: 'scenario', label: 'Scenario-based' },
  { value: 'spaced', label: 'Spaced repetition' },
  { value: 'jobaid', label: 'Job aid / reference' },
] as const;

