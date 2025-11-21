import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

async function fetchLogoUrlWithProbe(setDebug: (s: string) => void): Promise<string | null> {
  // 1) Try exact match
  let q1 = await supabase
    .from('portal_settings')
    .select('key,value')
    .eq('key', 'logo')
    .limit(1)
    .maybeSingle();

  if (q1.error) {
    setDebug(`Query key='logo' → ${q1.error.message}`);
    return null;
  }
  if (q1.data) {
    const v = q1.data.value as any;
    setDebug(`Exact 'logo' found → ${v?.url ? 'URL present' : 'no url, has path? ' + (v?.path || 'no')}`);
    if (v?.url) return v.url;
    if (v?.path) {
      const pub = supabase.storage.from('portal-branding').getPublicUrl(v.path);
      return pub.data?.publicUrl ?? null;
    }
    return null;
  }

  // 2) If not found, list any near matches (helps detect case/space issues or duplicates)
  const q2 = await supabase
    .from('portal_settings')
    .select('key')
    .ilike('key', 'logo%')
    .limit(5);

  if (q2.error) {
    setDebug(`Probe ilike('logo%') → ${q2.error.message}`);
    return null;
  }

  const keys = (q2.data || []).map(r => r.key).join(', ') || 'none';
  setDebug(`No exact 'logo'. Visible keys starting 'logo': ${keys}`);
  return null;
}

type LogoData = { 
  url?: string | null; 
  path?: string | null; 
  width?: number | null; 
  height?: number | null 
};

interface LogoContextType {
  logo: LogoData | null;
  loading: boolean;
  reload: () => Promise<void>;
}

const LogoContext = createContext<LogoContextType | undefined>(undefined);

export const LogoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logo, setLogo] = useState<LogoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState<string>('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const u = await fetchLogoUrlWithProbe(setDebug);
      setLogo(u ? { url: u } : null);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    reload(); // Initial fetch
    
    const handleLogoUpdate = () => {
      reload();
    };
    
    window.addEventListener('portal:logo-updated', handleLogoUpdate);
    
    return () => {
      window.removeEventListener('portal:logo-updated', handleLogoUpdate);
    };
  }, [reload]);
  
  const value = useMemo(() => ({ logo, loading, reload }), [logo, loading, reload]);

  return (
    <LogoContext.Provider value={value}>
      {children}
    </LogoContext.Provider>
  );
};

export const useLogo = (): LogoContextType => {
  const context = useContext(LogoContext);
  if (context === undefined) {
    throw new Error('useLogo must be used within a LogoProvider');
  }
  return context;
};