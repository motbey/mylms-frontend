import { supabase } from '../../../lib/supabaseClient';
import type { TextBlockContentJson } from '../../types/contentBlocks';
import { TEXT_BLOCK_TYPES } from '../../constants/textBlockTypes';

// ---------------------------------------------------------------------------
// Types for reading blocks from the database
// ---------------------------------------------------------------------------

export interface ContentModuleBlockRow {
  id: string;
  page_id: string;
  type: string;
  order_index: number;
  content_json: TextBlockContentJson | null;
  learning_goal: string | null;
  media_type: string;
  difficulty_level: number;
  is_core: boolean;
  mbl_metadata: unknown | null;
  media_asset_id: string | null; // FK to media_assets for image blocks
}

// ---------------------------------------------------------------------------
// Fetch blocks by page_id
// ---------------------------------------------------------------------------

export async function getContentModuleBlocksByPageId(
  pageId: string
): Promise<ContentModuleBlockRow[]> {
  const { data, error } = await supabase
    .from('content_module_blocks')
    .select('*')
    .eq('page_id', pageId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching content_module_blocks', error);
    throw error;
  }

  return (data ?? []) as ContentModuleBlockRow[];
}

// ---------------------------------------------------------------------------
// Upsert a single block
// ---------------------------------------------------------------------------

export interface UpsertContentModuleBlockParams {
  id?: string;                 // if provided → update, otherwise insert
  pageId: string;              // maps to page_id
  type: string;                // existing block type value used in the app
  orderIndex: number;          // maps to order_index
  contentJson: TextBlockContentJson;
  learningGoal?: string | null;
  mediaType?: string | null;
  isCore?: boolean | null;
  difficultyLevel?: number | null;
  mediaAssetId?: string | null; // FK to media_assets for image blocks
}

export async function upsertContentModuleBlock(
  params: UpsertContentModuleBlockParams
) {
  const {
    id,
    pageId,
    type,
    orderIndex,
    contentJson,
    learningGoal = null,
    mediaType = null,
    isCore = null,
    difficultyLevel = null,
    mediaAssetId = null,
  } = params;

  // Map internal block types to DB enum values
  // All text-based blocks map to "text" for the content_block_type enum
  const dbType = TEXT_BLOCK_TYPES.includes(type) ? 'text' : type;

  // Default media_type to "text" if not provided
  const resolvedMediaType = mediaType ?? 'text';

  // Default difficulty_level to 0 if not a number
  const resolvedDifficultyLevel =
    typeof difficultyLevel === 'number' ? difficultyLevel : 0;

  // Default is_core to false if not a boolean
  const resolvedIsCore = typeof isCore === 'boolean' ? isCore : false;

  const payload: any = {
    page_id: pageId,
    type: dbType,
    order_index: orderIndex,
    content_json: contentJson,
    learning_goal: learningGoal,
    media_type: resolvedMediaType,
    is_core: resolvedIsCore,
    difficulty_level: resolvedDifficultyLevel,
    media_asset_id: mediaAssetId, // FK to media_assets for image blocks
  };

  if (id) {
    payload.id = id;
  }

  const { data, error } = await supabase
    .from('content_module_blocks')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error upserting content_module_blocks', error);
    throw error;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Delete a single block by ID
// ---------------------------------------------------------------------------

export async function deleteContentModuleBlock(blockId: string): Promise<void> {
  const { error } = await supabase
    .from('content_module_blocks')
    .delete()
    .eq('id', blockId);

  if (error) {
    console.error('Error deleting content_module_block', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// TODO: AI Integration with Media Assets
// ---------------------------------------------------------------------------
// When assembling lesson context for the AI, join content_module_blocks
// to media_assets via media_asset_id so the AI can see image metadata.
// Example SQL:
//
// select cmb.*, ma.alt_text, ma.title, ma.description, ma.tags,
//        ma.behaviour_tag, ma.cognitive_skill, ma.learning_pattern, ma.difficulty
// from content_module_blocks cmb
// left join media_assets ma on ma.id = cmb.media_asset_id
// where cmb.page_id = :page_id
// order by cmb.order_index;
//
// This allows the AI to understand image content and generate better lessons.
