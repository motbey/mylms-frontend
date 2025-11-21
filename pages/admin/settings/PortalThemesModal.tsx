import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useTheme } from '../../../theme/ThemeProvider';
import { usePortalText } from '../../../theme/PortalTextProvider';

// --- Helper Components ---
const ColorInput: React.FC<{ label: string; value: string; onChange: (value: string) => void; disabled?: boolean; }> = ({ label, value, onChange, disabled }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <div className="mt-1 flex items-center gap-2 rounded-md shadow-sm">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-10 p-1 border border-gray-300 rounded-md cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm h-10 px-3"
        disabled={disabled}
      />
    </div>
  </div>
);

const TextInput: React.FC<{ id: string; label: string; value: string; onChange: (value: string) => void; type?: 'text' | 'textarea'; disabled?: boolean }> = ({ id, label, value, onChange, type = 'text', disabled }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
        {type === 'textarea' ? (
            <textarea
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
                disabled={disabled}
            />
        ) : (
            <input
                id={id}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
                disabled={disabled}
            />
        )}
    </div>
);

// --- Main Modal Component ---
interface PortalThemesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PortalThemesModal: React.FC<PortalThemesModalProps> = ({ isOpen, onClose }) => {
  const { theme: globalTheme, setTheme: setGlobalTheme, loading: themeLoading, reload: reloadTheme } = useTheme();
  const { text: globalText, setText: setGlobalText, reload: reloadText, loading: textLoading } = usePortalText();
  
  // Local state for editing
  const [themeState, setThemeState] = useState(globalTheme);
  const [textState, setTextState] = useState(globalText);
  const [originalState, setOriginalState] = useState({ theme: globalTheme, text: globalText });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // When modal opens, sync local state with global context
      setThemeState(globalTheme);
      setTextState(globalText);
      setOriginalState({ theme: globalTheme, text: globalText });
      setError('');
    }
  }, [isOpen, globalTheme, globalText]);

  useEffect(() => {
    // Live preview effect
    if (isOpen) {
      setGlobalTheme(themeState);
    }
  }, [themeState, isOpen, setGlobalTheme]);
  
  const handleCancel = () => {
    setGlobalTheme(originalState.theme); // Revert live preview
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updated_by = user?.id ?? null;

      const { error: upsertError } = await supabase.from('portal_settings').upsert([
        { key: 'theme', value: themeState, updated_by },
        { key: 'portal_text', value: textState, updated_by }
      ], { onConflict: 'key' });

      if (upsertError) throw upsertError;

      // Persist to global context after successful save
      setGlobalTheme(themeState);
      setGlobalText(textState);
      onClose();

    } catch (e: any) {
      setError(`Failed to save settings: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to reset all themes and text to their default values? This cannot be undone.")) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('reset_portal_settings_to_defaults');
      if (rpcError) throw rpcError;
      
      // Reload from DB and update contexts
      await reloadText();
      await reloadTheme();
      
      onClose();

    } catch (e: any) {
      setError(`Failed to reset settings: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  const isLoading = themeLoading || textLoading;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 overflow-y-auto" onMouseDown={handleCancel}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mt-8 animate-fade-in-down" onMouseDown={(e) => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Portal Themes & Text</h2>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-800 text-3xl font-light" aria-label="Close modal">&times;</button>
        </div>
        
        {isLoading ? <div className="p-8 text-center">Loading settings...</div> : (
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {error && <p className="text-red-600 bg-red-100 p-3 rounded-md text-sm">{error}</p>}
            
            <fieldset>
              <legend className="text-lg font-semibold text-primary mb-3">Colours</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ColorInput label="Primary" value={themeState.primary} onChange={(c) => setThemeState(t => ({...t, primary: c}))} disabled={saving} />
                <ColorInput label="Secondary" value={themeState.secondary} onChange={(c) => setThemeState(t => ({...t, secondary: c}))} disabled={saving} />
                <ColorInput label="Accent" value={themeState.accent} onChange={(c) => setThemeState(t => ({...t, accent: c}))} disabled={saving} />
                <ColorInput label="Neutral (Background Tint)" value={themeState.neutral} onChange={(c) => setThemeState(t => ({...t, neutral: c}))} disabled={saving} />
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-lg font-semibold text-primary mb-3">Portal Text</legend>
              <div className="space-y-4">
                <TextInput id="headerTitle" label="Header Title" value={textState.headerTitle} onChange={v => setTextState(t => ({...t, headerTitle: v}))} disabled={saving} />
                <TextInput id="welcomeMsg" label="Welcome Message" value={textState.welcomeMsg} onChange={v => setTextState(t => ({...t, welcomeMsg: v}))} type="textarea" disabled={saving} />
                <TextInput id="footerText" label="Footer Text" value={textState.footerText} onChange={v => setTextState(t => ({...t, footerText: v}))} disabled={saving} />
              </div>
            </fieldset>
          </div>
        )}

        <div className="p-6 bg-gray-50 rounded-b-lg flex flex-wrap justify-end items-center gap-3">
            <button onClick={handleCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50" disabled={saving}>Cancel</button>
            <button onClick={handleReset} className="px-4 py-2 bg-white text-red-600 border border-red-500 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50" disabled={saving}>Reset to Defaults</button>
            <button onClick={handleSave} className="px-6 py-2 bg-secondary text-white rounded-md hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-wait" disabled={saving || isLoading}>
                {saving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default PortalThemesModal;
