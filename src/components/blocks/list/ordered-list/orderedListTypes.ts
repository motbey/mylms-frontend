// Ordered / numbered list types (shared between LessonBuilder + OrderedListBlock)

export type OrderedListStyle =
  | "decimal" // 1, 2, 3
  | "lower-alpha" // a, b, c
  | "upper-alpha" // A, B, C
  | "lower-roman" // i, ii, iii
  | "upper-roman"; // I, II, III

export interface NumberedListItem {
  body: string; // HTML string content
  children?: NumberedListItem[]; // Optional level-2 sublist (max 2 levels)
}

export interface NumberedListContent {
  items: NumberedListItem[];
  start?: number; // default 1
  style?: OrderedListStyle; // Level-1 style, default "decimal"
  subStyle?: OrderedListStyle; // Level-2 style, default "lower-alpha"
}


