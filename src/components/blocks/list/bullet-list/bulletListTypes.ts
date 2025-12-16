// Bullet list types (shared between LessonBuilder + BulletListBlock)

export type BulletStyle = "disc" | "circle" | "square" | "dash" | "check";

export interface BulletListItem {
  body: string; // HTML string content
  children?: BulletListItem[]; // Optional level-2 sublist (max 2 levels)
}


