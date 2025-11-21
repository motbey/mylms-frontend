import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import AuthWatcher from './AuthWatcher';
import { usePortalText } from '../theme/PortalTextProvider';
import { useLogo } from '../theme/LogoProvider';

// --- Main Layout Component ---
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { text, loading: textLoading } = usePortalText();
  const { logo, loading: logoLoading } = useLogo();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <AuthWatcher />
      <div className="min-h-screen flex flex-col">
        <header className="bg-white shadow-md sticky top-0 z-20">
          <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <NavLink to="/" className="flex items-center gap-3 text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
                {!logoLoading && logo?.url && (
                  <img
                    src={logo.url}
                    alt="Portal Logo"
                    className="h-10 w-auto object-contain"
                    loading="eager"
                    decoding="async"
                  />
                )}
                <span>{textLoading ? '...' : text.headerTitle}</span>
              </NavLink>
            </div>
            {/* Navigation links removed */}
          </nav>
        </header>

        <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="bg-white mt-8 py-4 border-t">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
                {textLoading ? '...' : text.footerText}
            </div>
        </footer>
      </div>
    </>
  );
};

export default Layout;