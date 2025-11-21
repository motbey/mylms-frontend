import React, { useState, useEffect, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import PortalThemesModal from './settings/PortalThemesModal';
import LogoModal from './settings/LogoModal';
import { settingsTiles, SettingsTileConfig } from '../../config/settingsTiles';
import { listFavorites, addFavorite, removeFavorite } from '../../lib/favorites';

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

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light" aria-label="Close modal">&times;</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

const SignupToggleModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const [allowSignup, setAllowSignup] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setError('');
            setLoading(true);
            const fetchSetting = async () => {
                const { data, error: fetchError } = await supabase
                    .from('portal_settings')
                    .select('value')
                    .eq('key', 'allow_signup')
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    console.error('Error fetching signup setting:', fetchError);
                    setError('Could not load setting. Please try again.');
                    setAllowSignup(true);
                } else {
                    setAllowSignup(data ? !!data.value : true);
                }
                setLoading(false);
            };
            fetchSetting();
        }
    }, [isOpen]);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        const { data: { user } } = await supabase.auth.getUser();
        const { error: upsertError } = await supabase
            .from('portal_settings')
            .upsert({
                key: 'allow_signup',
                value: allowSignup,
                updated_by: user?.id ?? null
            }, { onConflict: 'key' });

        if (upsertError) {
            console.error('Error saving setting:', upsertError);
            setError('Failed to save setting. Please try again.');
        } else {
            onClose();
        }
        setSaving(false);
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Sign-Up Toggle">
            {loading ? <div className="text-center p-4">Loading setting...</div> : (
                <>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border">
                        <label htmlFor="signup-toggle" className="text-gray-700 font-medium">Allow Sign Up on Home Page</label>
                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input 
                                type="checkbox" 
                                name="signup-toggle" 
                                id="signup-toggle"
                                checked={allowSignup}
                                onChange={() => setAllowSignup(!allowSignup)}
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                disabled={saving}
                            />
                            <label htmlFor="signup-toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                        </div>
                        <style>{`
                            .toggle-checkbox:checked { right: 0; border-color: var(--color-secondary); }
                            .toggle-checkbox:checked + .toggle-label { background-color: var(--color-secondary); }
                        `}</style>
                    </div>
                    {error && <p className="text-red-500 text-sm mt-4 text-center bg-red-50 p-2 rounded">{error}</p>}
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors" disabled={saving}>Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-secondary text-white rounded-md hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-wait" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </>
            )}
        </Modal>
    );
};

// --- Main Page Component ---
const AdminSettings: React.FC = () => {
  const [isThemeModalOpen, setThemeModalOpen] = useState(false);
  const [isLogoModalOpen, setLogoModalOpen] = useState(false);
  const [isSignupToggleModalOpen, setSignupToggleModalOpen] = useState(false);
  const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const refreshFavorites = async () => {
    try {
      const favs = await listFavorites();
      setFavoriteSlugs(new Set(favs.map(f => f.slug)));
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
    }
  };

  useEffect(() => {
    refreshFavorites();
  }, []);

  const handleToggleFavorite = async (e: MouseEvent, tile: SettingsTileConfig) => {
    e.preventDefault();
    e.stopPropagation();

    const isFavorited = favoriteSlugs.has(tile.slug);
    // Optimistic UI update
    const newSlugs = new Set(favoriteSlugs);
    if (isFavorited) {
      newSlugs.delete(tile.slug);
    } else {
      newSlugs.add(tile.slug);
    }
    setFavoriteSlugs(newSlugs);

    try {
      if (isFavorited) {
        await removeFavorite(tile.slug);
        setToast({ message: "Removed from favourites", type: 'success' });
      } else {
        await addFavorite(tile.slug, tile.label);
        setToast({ message: "Pinned to favourites", type: 'success' });
      }
    } catch (error: any) {
      // Revert UI on failure and show specific error
      setToast({ message: error.message ?? 'An unknown error occurred', type: 'error' });
      await refreshFavorites(); 
    }
  };
  
  const handleTileAction = (action?: SettingsTileConfig['action']) => {
    if (!action) return;
    switch (action) {
      case 'openThemeModal': setThemeModalOpen(true); break;
      case 'openLogoModal': setLogoModalOpen(true); break;
      case 'openSignupToggleModal': setSignupToggleModalOpen(true); break;
    }
  };

  return (
    <div className="animate-fade-in">
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        <div className="mb-6">
            <Link to="/admin" className="text-blue-600 hover:underline text-sm">&larr; Back to Admin Dashboard</Link>
        </div>
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">System Settings</h1>
            <p className="text-gray-500">Configure global portal settings and appearance.</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {settingsTiles.map((tile) => {
                const isFavorited = favoriteSlugs.has(tile.slug);
                const tileContent = (
                    <div className="relative h-full p-6 bg-gradient-to-br from-white to-neutral rounded-xl shadow-md border-2 border-transparent group-hover:border-secondary group-hover:shadow-lg transition-all duration-200 ease-in-out transform group-hover:-translate-y-1 flex flex-col justify-start min-h-40">
                        <button
                            onClick={(e) => handleToggleFavorite(e, tile)}
                            className="absolute top-3 right-3 p-1 rounded-full z-10"
                            aria-pressed={isFavorited}
                            aria-label={isFavorited ? `Remove ${tile.label} from favourites` : `Add ${tile.label} to favourites`}
                        >
                            <StarIcon filled={isFavorited} />
                        </button>
                        <div className="mb-4">{tile.icon}</div>
                        <h2 className="text-xl font-bold text-primary mb-2">{tile.label}</h2>
                        <p className="text-sm text-[#858585] flex-grow">{tile.description}</p>
                    </div>
                );

                if (tile.to) {
                    return (
                        <Link to={tile.to} key={tile.slug} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ring-secondary rounded-xl" aria-label={`Navigate to ${tile.label}`}>
                            {tileContent}
                        </Link>
                    );
                }

                return (
                    <button key={tile.slug} onClick={() => handleTileAction(tile.action)} className="group block h-full text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ring-secondary rounded-xl" aria-label={`Open settings for ${tile.label}`}>
                        {tileContent}
                    </button>
                );
            })}
        </div>
        
        {/* Modals */}
        <PortalThemesModal isOpen={isThemeModalOpen} onClose={() => setThemeModalOpen(false)} />
        <LogoModal isOpen={isLogoModalOpen} onClose={() => setLogoModalOpen(false)} />
        <SignupToggleModal isOpen={isSignupToggleModalOpen} onClose={() => setSignupToggleModalOpen(false)} />
    </div>
  );
};

export default AdminSettings;