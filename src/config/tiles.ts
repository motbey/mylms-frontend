import React from 'react';
import { adminTiles } from "./adminTiles";
import { settingsTiles } from "./settingsTiles";

// A unified type that ensures 'to' is always present, which is required by FavoriteTile.
export type TileEntry = {
  slug: string;
  label: string;
  to: string; // 'to' is mandatory for a favorite link.
  icon: React.ReactElement;
  description?: string;
};

const allTilesArray: TileEntry[] = [
  // Admin tiles already have a 'to' property.
  ...adminTiles,

  // Settings tiles may have an 'action' instead of a 'to'.
  // For these, we'll default the link to the main settings page.
  ...settingsTiles.map(tile => ({
    ...tile,
    // If there's no direct link ('to'), default to the parent settings page.
    // This makes them valid favorites that take the user to the right context.
    to: tile.to || '/admin/settings',
  })),
];

const tilesMap: Map<string, TileEntry> = new Map();
for (const tile of allTilesArray) {
    if (!tilesMap.has(tile.slug)) {
        tilesMap.set(tile.slug, tile);
    } else {
        console.warn("[tiles] duplicate slug detected and ignored:", tile.slug);
    }
}

/**
 * Finds a tile configuration by its unique slug from the global registry.
 * @param slug - The slug of the tile to find.
 * @returns The tile configuration entry or undefined if not found.
 */
export function getTileBySlug(slug: string): TileEntry | undefined {
  return tilesMap.get(slug);
}