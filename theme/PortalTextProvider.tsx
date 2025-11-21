import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PortalText {
  headerTitle: string;
  welcomeMsg: string;
  footerText: string;
}

interface PortalTextContextType {
  text: PortalText;
  setText: (text: PortalText) => void;
  loading: boolean;
  reload: () => Promise<void>;
}

const textDefaults: PortalText = {
  headerTitle: 'Welcome to ConPass',
  welcomeMsg: 'Manage learning, compliance and access in one place.',
  footerText: '© ISS Training — All rights reserved.',
};

const PortalTextContext = createContext<PortalTextContextType | undefined>(undefined);

export const PortalTextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [text, setTextState] = useState<PortalText>(textDefaults);
  const [loading, setLoading] = useState(true);

  const fetchText = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'portal_text')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching portal text settings:", error.message);
    }
    
    const loadedText = data?.value as Partial<PortalText> | null;
    setTextState({ ...textDefaults, ...loadedText });
    setLoading(false);
  }, []);
  
  useEffect(() => {
    fetchText();
  }, [fetchText]);
  
  const setText = (newText: PortalText) => {
    setTextState(newText);
  };
  
  const value = useMemo(() => ({ text, setText, loading, reload: fetchText }), [text, loading, fetchText]);

  return (
    <PortalTextContext.Provider value={value}>
      {children}
    </PortalTextContext.Provider>
  );
};

export const usePortalText = (): PortalTextContextType => {
  const context = useContext(PortalTextContext);
  if (context === undefined) {
    throw new Error('usePortalText must be used within a PortalTextProvider');
  }
  return context;
};
