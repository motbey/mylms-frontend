// src/components/blocks/sorting/sorting-types.ts
// Types for the Sorting Activity content block

export interface SortingCategory {
  id: string; // e.g. "cat-1"
  label: string; // e.g. "Category 1"
}

export interface SortingItem {
  id: string; // e.g. "item-1"
  text: string; // learner sees this
  // Optional: link to an image from Media Library (usually a URL)
  imageUrl?: string | null;
  // Optional extra metadata (handy later, not required)
  altText?: string | null;
  correctCategoryId: string; // must match one of categories[id]
  feedbackCorrect?: string;
  feedbackIncorrect?: string;
}

export interface SortingActivitySettings {
  randomizeOrder?: boolean;
  allowRetry?: boolean;
  showPerItemFeedback?: boolean;
}

export interface SortingActivityContent {
  title?: string;
  instructions?: string;
  categories: SortingCategory[];
  items: SortingItem[];
  settings?: SortingActivitySettings;
}
