import React from "react";
import { adminTiles } from "./adminTiles";
import { settingsTiles } from "./settingsTiles";
import { contentTiles, contentActionTiles } from "./contentTiles";

// This is the unified type for any tile that can be a favorite.
// It ensures a 'to' link is always present for navigation.
export type TileEntry = {
  slug: string;
  label: string;
  to: string; // 'to' is mandatory for a favorite link.
  icon: React.ReactElement;
  description?: string;
};

// Helper function to normalize any tile object into a valid TileEntry.
// It provides a fallback 'to' for settings tiles that open modals.
function toEntry(t: any): TileEntry {
  return {
    slug: t.slug,
    label: t.label,
    to: t.to ?? "/admin/settings", // Fallback for action-based tiles
    icon: t.icon,
    description: t.description,
  };
}

const allTilesArray: TileEntry[] = [
  ...adminTiles.map(toEntry),
  ...settingsTiles.map(toEntry),
  ...contentTiles.map(toEntry),
  ...contentActionTiles.map(toEntry),
];

// The single source of truth for all tiles, keyed by slug for fast lookups.
export const ALL_TILES: Record<string, TileEntry> = allTilesArray.reduce((acc, t) => {
  if (!acc[t.slug]) {
    acc[t.slug] = t;
  } else {
    // This warning helps developers catch accidental slug collisions.
    console.warn("[tiles] duplicate slug:", t.slug);
  }
  return acc;
}, {} as Record<string, TileEntry>);

/**
 * Finds a tile configuration by its unique slug from the global registry.
 * @param slug - The slug of the tile to find.
 * @returns The tile configuration entry or undefined if not found.
 */
export function getTileBySlug(slug: string): TileEntry | undefined {
  return ALL_TILES[slug];
}
