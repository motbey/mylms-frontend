import React, { useState, useEffect } from 'react';
import { useFavorites } from '../providers/FavoritesProvider';
import FavoriteTile from './FavoriteTile';
import FavoritesEmptyState from './FavoritesEmptyState';
import { getTileBySlug } from '../config/tiles';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { reorderFavorites, Favorite } from '../lib/favorites';

const Toast: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-20 right-5 z-50 px-4 py-3 rounded-md shadow-lg text-white bg-red-500 animate-fade-in-down">
      {message}
    </div>
  );
};

const FavoritesSection: React.FC = () => {
  const { favorites, loading, handleUnfavourite } = useFavorites();
  const [localFavorites, setLocalFavorites] = useState<Favorite[]>(favorites);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  useEffect(() => {
    setLocalFavorites(favorites);
  }, [favorites]);

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const items = Array.from(localFavorites);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);

    // Optimistic update
    setLocalFavorites(items);

    setIsSavingOrder(true);
    try {
      // FIX: Explicitly type `f` as `Favorite` to resolve a TypeScript inference issue
      // where it was being incorrectly inferred as `unknown`.
      await reorderFavorites(items.map((f: Favorite) => f.slug));
      // No need to call refreshFavorites on success, as the optimistic state is correct.
      // The global state will be updated by the 'favorites-changed' event if needed elsewhere.
    } catch (error: any) {
      setErrorToast(error.message || 'Could not save new order.');
      // Revert on error
      setLocalFavorites(favorites);
    } finally {
      setIsSavingOrder(false);
    }
  };

  if (loading) {
    return <div className="my-6 text-center text-sm text-gray-500 py-2">Loading Favourites...</div>;
  }

  return (
    <div className="my-8">
      {errorToast && <Toast message={errorToast} onDismiss={() => setErrorToast(null)} />}
      <h2 className="text-base font-semibold text-gray-700 mb-3">Favourites</h2>
      
      {localFavorites.length === 0 ? (
        <FavoritesEmptyState />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="favorites" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 transition-opacity ${isSavingOrder ? 'opacity-75 cursor-wait' : ''}`}
              >
                {localFavorites.map((fav, index) => {
                  const tile = getTileBySlug(fav.slug);
                  if (!tile) {
                    console.warn("Unknown favourite slug, skipping render:", fav.slug);
                    return null;
                  }
                  return (
                    <Draggable key={fav.slug} draggableId={fav.slug} index={index}>
                      {(provided, snapshot) => (
                        <FavoriteTile
                          innerRef={provided.innerRef}
                          draggableProps={provided.draggableProps}
                          dragHandleProps={provided.dragHandleProps}
                          isDragging={snapshot.isDragging}
                          slug={fav.slug}
                          label={fav.label ?? tile.label}
                          icon={tile.icon}
                          to={tile.to}
                          onUnfavourite={handleUnfavourite}
                        />
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
};

export default FavoritesSection;
