// src/constants/textBlockTypes.ts
// 
// These are the internal block type keys used in the Lesson Builder UI.
// When saving to Supabase, all of these map to the DB enum value "text".

export const TEXT_BLOCK_TYPES: string[] = [
  "heading",
  "subheading",
  "paragraph",
  "paragraph-with-heading",
  "paragraph-with-subheading",
  "columns",
  "table",
];

