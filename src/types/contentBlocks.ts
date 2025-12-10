// src/types/contentBlocks.ts

export interface BlockMetadata {
  behaviourTag?: string | null;      // e.g. "attention"
  cognitiveSkill?: string | null;    // e.g. "analyse"
  learningPattern?: string | null;   // e.g. "scenario"
  difficulty?: number | null;        // 0–10
  notes?: string | null;             // "Notes for AI / analytics"
  
  // Who set these tags - 'ai' or 'human'
  source?: 'ai' | 'human' | string | null;
  
  // Per-field source tracking
  fieldSources?: {
    behaviourTag?: 'ai' | 'human' | null;
    cognitiveSkill?: 'ai' | 'human' | null;
    learningPattern?: 'ai' | 'human' | null;
    difficulty?: 'ai' | 'human' | null;
  };
  
  // AI explanations and confidence scores
  aiExplanations?: any;
  aiConfidenceScores?: any;
}

/** List style options for ordered lists */
export type OrderedListStyleType =
  | "decimal" // 1, 2, 3
  | "lower-alpha" // a, b, c
  | "upper-alpha" // A, B, C
  | "lower-roman" // i, ii, iii
  | "upper-roman"; // I, II, III

/** A single item in an ordered list (supports 2 levels of nesting) */
export interface OrderedListItem {
  body: string; // HTML string content
  children?: OrderedListItem[]; // Optional level-2 sublist
}

/** Bullet style options for unordered/bullet lists */
export type BulletStyleType = "disc" | "circle" | "square" | "dash" | "check";

/** A single item in a bullet list (supports 2 levels of nesting) */
export interface BulletListItem {
  body: string; // HTML string content
  children?: BulletListItem[]; // Optional level-2 sublist
}

// Structured content for blocks with multiple parts
export interface StructuredBlockContent {
  heading?: string;      // For paragraph-with-heading
  subheading?: string;   // For paragraph-with-subheading
  body?: string;         // The main content/body
  columnOne?: string;    // For columns block
  columnTwo?: string;    // For columns block
  // For table block
  tableContent?: unknown;
  borderMode?: string;
  // For numbered/ordered list block
  items?: OrderedListItem[];
  startNumber?: number;
  listStyle?: OrderedListStyleType;
  subStyle?: OrderedListStyleType; // Level-2 list style
  numberColor?: string;
  // For bullet list block
  bulletItems?: BulletListItem[];
  bulletStyle?: BulletStyleType;
  bulletSubStyle?: BulletStyleType; // Level-2 bullet style
  bulletColor?: string;
  // For image-centered block
  media_asset_id?: string | null;
  alt_text?: string;
  caption?: string | null;
  public_url?: string | null;
  // Structured image object with full asset info
  image?: {
    media_asset_id: string | null;
    url: string | null;
    alt_text: string;
    title: string;
    description: string;
  };
  // For image-text block
  layout?: {
    imagePosition: "left" | "right";
    imageWidth: 25 | 50 | 75;
  };
  text?: {
    heading: string;
    body: string;
  };
  ai_metadata?: unknown;
  // For flashcards block
  title?: string | null;
  cards?: {
    id: string;
    frontHtml?: string;
    backHtml?: string;
    frontDisplayMode?: "text" | "centeredImage" | "fullCardImage";
    backDisplayMode?: "text" | "centeredImage" | "fullCardImage";
    frontImage?: { id: string; url: string; alt?: string } | null;
    backImage?: { id: string; url: string; alt?: string } | null;
  }[];
}

/**
 * Style information for block appearance.
 * Stored inside content_json so we don't need schema changes.
 */
export interface BlockStyleData {
  /** The named style preset (light, gray, theme, etc.) or "custom" for custom color */
  style?: 'light' | 'gray' | 'theme' | 'themeTint' | 'dark' | 'black' | 'custom' | 'image' | null;
  /** Custom background color hex (e.g. "#FF5500"), only used when style is "custom" */
  customBackgroundColor?: string | null;
}

/** Animation types for block entrance effects */
export type BlockAnimationType = 
  | "none"
  | "fade-in"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "bounce";

/** Animation duration presets */
export type BlockAnimationDurationType = "fast" | "normal" | "slow" | "very-slow";

export interface TextBlockContentJson {
  blockType: string;                 // internal text block type, e.g. "paragraph", "heading", "columns"
  content: string | StructuredBlockContent;  // rich text HTML (string) or structured content (object)
  metadata: BlockMetadata;
  /** Optional styling data for block appearance */
  style?: BlockStyleData;
  /** Optional entrance animation for the block */
  animation?: BlockAnimationType;
  /** Optional animation duration */
  animationDuration?: BlockAnimationDurationType;
}

