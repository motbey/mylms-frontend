import React, { useState, useEffect, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { contentTiles, ContentTile } from '../../config/contentTiles';
import { listFavorites, addFavorite, removeFavorite } from '../../lib/favorites';
import FavoritesSection from '../../components/FavoritesSection';

// --- Reusable Components for this page ---
const StarIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      className={filled ? 'fill-yellow-400 text-yellow-500' : 'text-gray-400 hover:text-yellow-400'}
    />
  </svg>
);

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onDismiss: () => void }> = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const baseClasses = "fixed top-20 right-5 z-50 px-4 py-3 rounded-md shadow-lg text-white animate-fade-in-down";
  const typeClasses = type === 'error' ? 'bg-red-500' : 'bg-green-500';

  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      {message}
    </div>
  );
};


const AdminContentDashboard: React.FC = () => {
    const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const refreshFavorites = async () => {
            try {
                const favs = await listFavorites();
                setFavoriteSlugs(new Set(favs.map(f => f.slug)));
            } catch (error: any) {
                setToast({ message: error.message, type: 'error' });
            }
        };
        refreshFavorites();
    }, []);

    const handleToggleFavorite = async (e: MouseEvent, tile: ContentTile) => {
        e.preventDefault();
        e.stopPropagation();

        const isFavorited = favoriteSlugs.has(tile.slug);
        const originalSlugs = new Set(favoriteSlugs);

        // Optimistic UI update
        const newSlugs = new Set(originalSlugs);
        if (isFavorited) {
            newSlugs.delete(tile.slug);
        } else {
            if (newSlugs.size >= 6) {
                setToast({ message: "You can pin up to 6 favourites. Remove one to add another.", type: 'error' });
                return;
            }
            newSlugs.add(tile.slug);
        }
        setFavoriteSlugs(newSlugs);

        try {
            if (isFavorited) {
                await removeFavorite(tile.slug);
            } else {
                await addFavorite(tile.slug, tile.label);
            }
        } catch (error: any) {
            setFavoriteSlugs(originalSlugs); // Revert on error
            setToast({ message: error.message, type: 'error' });
        }
    };


    return (
        <div className="animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <div className="mb-6">
                <Link to="/admin" className="text-blue-600 hover:underline text-sm">&larr; Back to Admin Dashboard</Link>
            </div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Content Management</h1>
                <p className="text-gray-500">Manage all learning materials and custom forms from this hub.</p>
            </div>
            
            <FavoritesSection />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {contentTiles.map((tile) => {
                    const isFavorited = favoriteSlugs.has(tile.slug);
                    return (
                        <Link
                            to={tile.to}
                            key={tile.slug}
                            className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ring-secondary rounded-xl"
                            aria-label={`Navigate to ${tile.label}`}
                        >
                            <div className="relative h-full p-6 bg-gradient-to-br from-white to-neutral rounded-xl shadow-md border-2 border-transparent group-hover:border-secondary group-hover:shadow-lg transition-all duration-200 ease-in-out transform group-hover:-translate-y-1 flex flex-col justify-start min-h-40">
                                <button
                                    onClick={(e) => handleToggleFavorite(e, tile)}
                                    className="absolute top-3 right-3 p-1 rounded-full z-10"
                                    aria-pressed={isFavorited}
                                    aria-label={isFavorited ? `Remove ${tile.label} from favourites` : `Add ${tile.label} to favourites`}
                                >
                                    <StarIcon filled={isFavorited} />
                                </button>
                                <div>
                                    <div className="mb-4">{tile.icon}</div>
                                    <h2 className="text-xl font-bold text-primary mb-2">{tile.label}</h2>
                                </div>
                                <p className="text-sm text-[#858585] flex-grow">{tile.description}</p>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </div>
    );
};

export default AdminContentDashboard;
