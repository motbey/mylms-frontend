import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getUserAndRole, redirectByRole } from '../lib/auth';

const AuthWatcher = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // This watcher handles redirects on auth state *changes*.
        // Page-specific guards handle initial load protection.
        if (event === 'SIGNED_IN') {
          // Add a small delay to ensure the session is fully propagated and
          // any post-signup logic (like profile creation) can complete.
          setTimeout(async () => {
              const { role } = await getUserAndRole();
              // Avoid redirecting if user is already on a page for their role, e.g. /admin/users
              const path = redirectByRole(role);
              if (!location.pathname.startsWith(path)) {
                 navigate(path, { replace: true });
              }
          }, 200);
        } else if (event === 'SIGNED_OUT') {
          navigate('/', { replace: true });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  return null; // This component is purely for side effects
};

export default AuthWatcher;
