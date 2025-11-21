import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { listFavorites, removeFavorite, reorderFavorites, Favorite } from '../lib/favorites';
import { supabase } from '../lib/supabaseClient';

// --- Context Shape ---
interface FavoritesContextType {
  favorites: Favorite[];
  favoriteSlugs: Set<string>;
  refreshFavorites: () => Promise<void>;
  handleUnfavourite: (slug: string) => Promise<void>;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);


// --- Provider Component ---
export const FavoritesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  
  const favoriteSlugs = useMemo(() => new Set(favorites.map(f => f.slug)), [favorites]);
  
  const refreshFavorites = useCallback(async () => {
    try {
      if (!loading) setLoading(true);
      const favs = await listFavorites();
      setFavorites(favs);
    } catch (error: any) {
      // This could be exposed to a global toast provider if one existed
      console.error("FavoritesProvider Error:", error.message);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Initial fetch and listener setup
  useEffect(() => {
    // Fetch initial data
    refreshFavorites();
    
    // Listen for manual triggers (add/remove/reorder)
    window.addEventListener('favorites-changed', refreshFavorites);

    // Listen for auth changes to re-fetch on login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        refreshFavorites();
      }
    });

    return () => {
      window.removeEventListener('favorites-changed', refreshFavorites);
      subscription.unsubscribe();
    };
  }, [refreshFavorites]);

  const handleUnfavourite = async (slug: string) => {
    try {
      await removeFavorite(slug);
    } catch (error: any) {
      console.error("FavoritesProvider: Could not remove favourite.", error);
      // Revert is handled by the event listener re-fetching
    }
  };

  const value = useMemo(() => ({
    favorites,
    favoriteSlugs,
    refreshFavorites,
    handleUnfavourite,
    loading,
  }), [favorites, favoriteSlugs, refreshFavorites, handleUnfavourite, loading]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};


// --- Consumer Hook ---
export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};