import { supabase } from './supabaseClient';

// Type for a single favorite item returned from the database
export interface Favorite {
  slug: string;
  label: string;
  pos: number;
}

/**
 * Fetches the user's favorite admin tiles from the database.
 * @returns A promise that resolves to an array of favorite items.
 */
export async function listFavorites(): Promise<Favorite[]> {
  const { data, error } = await supabase.rpc('list_favorites');

  if (error) {
    console.error('Error fetching favorites:', error);
    throw new Error('Could not fetch your favorites.');
  }

  // Ensure the results are sorted by position, as the RPC guarantees it.
  return data || [];
}

/**
 * Adds a tile to the user's favorites.
 * @param slug - The unique identifier for the tile.
 * @param label - The display name of the tile.
 * @returns A promise that resolves when the operation is complete.
 */
export async function addFavorite(slug: string, label: string): Promise<void> {
  const { error } = await supabase.rpc('add_favorite', {
    p_slug: slug,
    p_label: label,
  });

  if (error) {
    if (error.message.includes('FAVORITES_LIMIT')) {
      throw new Error("You can pin up to 6 favourites. Remove one to add another.");
    }
    console.error('Error adding favorite:', error);
    throw new Error('Could not add to your favorites.');
  }
  window.dispatchEvent(new CustomEvent('favorites-changed'));
}

/**
 * Removes a tile from the user's favorites.
 * @param slug - The unique identifier for the tile to remove.
 * @returns A promise that resolves when the operation is complete.
 */
export async function removeFavorite(slug: string): Promise<void> {
  const { error } = await supabase.rpc('remove_favorite', { p_slug: slug });

  if (error) {
    console.error('Error removing favorite:', error);
    throw new Error('Could not remove from your favorites.');
  }
  window.dispatchEvent(new CustomEvent('favorites-changed'));
}

/**
 * Reorders the user's favorites in the database.
 * @param slugOrder - An array of slugs in the desired new order.
 * @returns A promise that resolves when the operation is complete.
 */
export async function reorderFavorites(slugOrder: string[]): Promise<void> {
    const { error } = await supabase.rpc('reorder_favorites', { p_order: slugOrder });
    if (error) {
        console.error('Error reordering favorites:', error);
        throw new Error('Could not save the new order.');
    }
    window.dispatchEvent(new CustomEvent('favorites-changed'));
}
