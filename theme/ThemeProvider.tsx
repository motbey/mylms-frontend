import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Theme {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  loading: boolean;
  reload: () => Promise<void>;
}

const themeDefaults: Theme = {
  primary: '#030037',   // ISS Dark Blue
  secondary: '#153ac7', // Persian Blue
  accent: '#0084ff',    // Azure Blue
  neutral: '#F4EBE5',   // Sand 3
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(themeDefaults);
  const [loading, setLoading] = useState(true);

  const fetchTheme = useCallback(async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('portal_settings')
        .select('value')
        .eq('key', 'theme')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching theme settings:", error.message);
      }
      
      const loadedTheme = data?.value as Partial<Theme> | null;
      setThemeState({ ...themeDefaults, ...loadedTheme });
      setLoading(false);
    }, []);

  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-secondary', theme.secondary);
    root.style.setProperty('--color-accent', theme.accent);
    root.style.setProperty('--color-neutral', theme.neutral);
  }, [theme]);
  
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const value = useMemo(() => ({ theme, setTheme, loading, reload: fetchTheme }), [theme, loading, fetchTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
