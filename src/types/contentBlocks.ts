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

// Structured content for blocks with multiple parts
export interface StructuredBlockContent {
  heading?: string;      // For paragraph-with-heading
  subheading?: string;   // For paragraph-with-subheading
  body?: string;         // The main content/body
  columnOne?: string;    // For columns block
  columnTwo?: string;    // For columns block
}

export interface TextBlockContentJson {
  blockType: string;                 // internal text block type, e.g. "paragraph", "heading", "columns"
  content: string | StructuredBlockContent;  // rich text HTML (string) or structured content (object)
  metadata: BlockMetadata;
}

