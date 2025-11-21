import React, { useEffect, useState, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { adminTiles, AdminTileConfig } from '../../config/adminTiles';
import { addFavorite, removeFavorite } from '../../lib/favorites';
import AdminTile from '../../components/AdminTile';
import { useFavorites } from '../../providers/FavoritesProvider';
import FavoritesSection from '../../components/FavoritesSection';
import { Profile, getMyProfile } from '../../src/lib/profiles';
import RoleSwitcher from '../../src/components/RoleSwitcher';

// --- Simple Toast Component ---
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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { favoriteSlugs } = useFavorites(); // Use global favorites state

  // Check auth and load initial data
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      setLoading(true);
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
       if (!sessionUser) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setUser(sessionUser);

      const userProfile = await getMyProfile();
      if (!userProfile || !['admin', 'sub_admin'].includes(userProfile.role)) {
        navigate('/login', { replace: true });
        return;
      }
      setProfile(userProfile);
      setLoading(false);
    };
    checkAuthAndLoadData();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  const handleToggleFavorite = async (e: MouseEvent, tile: AdminTileConfig) => {
    e.preventDefault();
    e.stopPropagation();

    const isFavorited = favoriteSlugs.has(tile.slug);

    try {
      if (isFavorited) {
        await removeFavorite(tile.slug);
        setToast({ message: "Removed from favourites", type: 'success' });
      } else {
        await addFavorite(tile.slug, tile.label);
        setToast({ message: "Pinned to favourites", type: 'success' });
      }
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
    }
  };

  if (loading) {
    return <div className="text-center p-8">Loading admin dashboard...</div>;
  }
  
  return (
    <div className="animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-500">Logged in as {(profile?.first_name && profile?.last_name) ? `${profile.first_name} ${profile.last_name}` : user?.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
            {profile && (
              <RoleSwitcher 
                  currentRole={profile.role === 'admin' ? 'admin' : 'user'} 
                  roles={profile.roles ?? []} 
              />
            )}
            <button
              onClick={handleSignOut}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
            >
              Sign Out
            </button>
        </div>
      </div>
      
      <FavoritesSection />

      <div
        className="my-4 h-[4px] w-full rounded-full"
        style={{
          background: "linear-gradient(90deg, #030037 0%, #153AC7 40%, #0084FF 100%)",
          boxShadow: "0 0 6px rgba(21, 58, 199, 0.4), inset 0 1px 1px rgba(255,255,255,0.3)",
        }}
      />

      <div id="admin-tiles" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {adminTiles.map((tile) => (
          <AdminTile
            key={tile.slug}
            tile={tile}
            isFavorited={favoriteSlugs.has(tile.slug)}
            onToggleFavorite={(e) => handleToggleFavorite(e, tile)}
          />
        ))}
      </div>
    </div>
  );
}
