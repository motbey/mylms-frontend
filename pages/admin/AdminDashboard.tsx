import React, { useEffect, useState, MouseEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { adminTiles, AdminTileConfig } from '../../config/adminTiles';
import { addFavorite, removeFavorite } from '../../lib/favorites';
import AdminTile from '../../components/AdminTile';
import { useFavorites } from '../../providers/FavoritesProvider';
import FavoritesSection from '../../components/FavoritesSection';
import { Profile, getMyProfile } from '../../src/lib/profiles';
import RoleSwitcher from '../../src/components/RoleSwitcher';
import { listUnreviewedSubmissions, UnreviewedSubmission } from '../../src/services/formSubmissions';

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

const formatDateShort = (isoString: string | null): string => {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('en-AU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  } catch(e) { return 'Invalid Date'; }
};


const FormsToReview: React.FC = () => {
    const [submissions, setSubmissions] = useState<UnreviewedSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadSubmissions = async () => {
            try {
                const data = await listUnreviewedSubmissions(5);
                setSubmissions(data);
            } catch (err: any) {
                setError("We couldn’t load your to-do items. Please refresh the page.");
            } finally {
                setLoading(false);
            }
        };
        loadSubmissions();
    }, []);

    const renderContent = () => {
        if (loading) return <p className="text-sm text-gray-500 text-center py-4">Loading review items...</p>;
        if (error) return <p className="text-sm text-red-600 text-center py-4">{error}</p>;
        if (submissions.length === 0) return (
            <div className="text-center py-4">
                <p className="text-sm font-semibold text-green-700">You’re all caught up!</p>
                <p className="text-xs text-gray-500 mt-1">There are no new form submissions to review right now.</p>
            </div>
        );

        return (
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr>
                            <th className="py-2 pr-2 font-semibold text-gray-600 text-left">Learner</th>
                            <th className="py-2 px-2 font-semibold text-gray-600 text-left">Form</th>
                            <th className="py-2 px-2 font-semibold text-gray-600 text-left">Submitted</th>
                            <th className="py-2 pl-2 font-semibold text-gray-600 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {submissions.map(sub => (
                            <tr key={sub.id} className="border-t border-gray-100">
                                <td className="py-2 pr-2 text-gray-800 truncate" title={sub.learnerName}>{sub.learnerName}</td>
                                <td className="py-2 px-2 text-gray-600 truncate" title={sub.form_name}>{sub.form_name}</td>
                                <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{formatDateShort(sub.submitted_at)}</td>
                                <td className="py-2 pl-2 text-right">
                                    <Link to={`/admin/forms/submissions/${sub.id}`} className="px-2 py-1 text-xs font-medium text-secondary bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100">Review</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 pr-4">
                    <h2 className="text-base font-bold text-primary">Forms to review</h2>
                    <p className="text-xs text-gray-500 mt-1">These forms have been submitted by learners and are waiting for your review.</p>
                </div>
                <div className="md:col-span-2">
                    {renderContent()}
                    {submissions.length > 0 && (
                        <div className="text-right mt-2">
                            <Link to="/admin/forms/submissions" className="text-xs font-semibold text-secondary hover:underline">View all &rarr;</Link>
                        </div>
                    )}
                </div>
            </div>
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

      <div className="my-6">
        <FormsToReview />
      </div>

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