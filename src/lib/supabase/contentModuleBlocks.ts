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
