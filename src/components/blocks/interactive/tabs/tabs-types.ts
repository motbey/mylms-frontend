export type TabsStyle = "light" | "dark";

export interface TabsTab {
  id: string; // stable uuid-ish string
  title: string; // tab header label
  content: string; // rich text HTML string (like paragraph block content)
  image?:
    | {
        mediaId?: string | null;
        url?: string | null; // resolved URL if we have it
        alt?: string | null;
      }
    | null;
}

export interface TabsSettings {
  style?: TabsStyle; // default "light"
  allowKeyboardNav?: boolean; // default true
}

export interface TabsContent {
  title?: string; // optional internal title for authors
  tabs: TabsTab[];
  settings?: TabsSettings;
}


