import React, { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

// --- Types ---
interface LogoData {
    path: string | null;
    url: string | null;
    width?: number | null;
    height?: number | null;
}

// --- Helper Components ---
const Spinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- Main Modal Component ---
interface LogoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LogoModal: React.FC<LogoModalProps> = ({ isOpen, onClose }) => {
    const [logo, setLogo] = useState<LogoData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const ensureLogoRow = useCallback(async () => {
        const { data } = await supabase.from('portal_settings')
            .select('key')
            .eq('key', 'logo')
            .maybeSingle();
        
        if (!data) {
            // Seed the row once; ignore duplicate errors if another tab seeds concurrently
            const { error: insertError } = await supabase.from('portal_settings').insert({
                key: 'logo',
                value: { url: null, path: null, width: null, height: null }
            });
            // 23505 is the Postgres code for 'unique_violation'
            if (insertError && insertError.code !== '23505') {
                throw insertError;
            }
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setError('');
            setLoading(true);
            const fetchLogoSetting = async () => {
                const { data, error: fetchError } = await supabase
                    .from('portal_settings')
                    .select('value')
                    .eq('key', 'logo')
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    setError('Could not load logo setting.');
                } else {
                    setLogo(data?.value as LogoData ?? { path: null, url: null });
                }
                setLoading(false);
            };
            fetchLogoSetting();
        }
    }, [isOpen]);
    
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError('');
        const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            setError('Invalid file type. Please use PNG, JPG, or SVG.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setError('File is too large. Maximum size is 5MB.');
            return;
        }

        setIsUploading(true);
        try {
            const { data: { user }, error: uErr } = await supabase.auth.getUser();
            if (uErr || !user) {
              setError('You are not signed in. Please log in again.');
              setIsUploading(false);
              return;
            }
            const uid = user.id;

            // If a logo already exists, remove the old one from storage first
            if (logo?.path) {
                await supabase.storage.from('portal-branding').remove([logo.path]);
            }
            
            const filePath = `branding/logo-${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('portal-branding')
                .upload(filePath, file, { upsert: true, cacheControl: '3600', contentType: file.type });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('portal-branding').getPublicUrl(filePath);
            const url = publicUrl || null;

            let width: number | null = null, height: number | null = null;
            await new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; resolve(); };
              img.onerror = () => resolve();
              if (url) img.src = url;
              else resolve(); // Resolve if no URL
            });
            
            await ensureLogoRow();
            
            const { error: updErr } = await supabase
                .from('portal_settings')
                .update({ value: { path: filePath, url, width, height }, updated_by: uid })
                .eq('key', 'logo');

            if (updErr) {
                setError(updErr.message);
                return;
            }
            
            setLogo({ path: filePath, url, width, height });
            setError('');
            window.dispatchEvent(new CustomEvent('portal:logo-updated'));

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleRemove = async () => {
        setIsRemoving(true);
        setError('');
        try {
            const { data: { user }, error: uErr } = await supabase.auth.getUser();
            if (uErr || !user) {
              setError('You are not signed in. Please log in again.');
              setIsRemoving(false);
              return;
            }
            const uid = user.id;

            if (logo?.path) {
                const { error: removeError } = await supabase.storage.from('portal-branding').remove([logo.path]);
                if (removeError) {
                    console.warn('Could not remove file from storage (it may already be gone):', removeError.message);
                }
            }
            
            await ensureLogoRow();
            
            const { error: clrErr } = await supabase
                .from('portal_settings')
                .update({ value: { path: null, url: null, width: null, height: null }, updated_by: uid })
                .eq('key','logo');
            
            if (clrErr) {
                setError(clrErr.message);
                return;
            }

            setLogo({ path: null, url: null, width: null, height: null });
            window.dispatchEvent(new CustomEvent('portal:logo-updated'));

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsRemoving(false);
        }
    };

    if (!isOpen) return null;
    const isWorking = isUploading || isRemoving;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Manage Portal Logo</h2>
                    <button onClick={onClose} disabled={isWorking} className="text-gray-500 hover:text-gray-800 text-3xl font-light disabled:opacity-50" aria-label="Close modal">&times;</button>
                </div>
                
                <div className="p-6">
                    {loading ? <div className="text-center p-8">Loading...</div> : (
                        <>
                            <div className="mb-4 p-4 border rounded-lg bg-gray-50 min-h-[120px] flex justify-center items-center">
                                {logo?.url ? (
                                    <img src={logo.url} alt="Current Portal Logo" className="max-h-24 max-w-full" />
                                ) : (
                                    <p className="text-gray-500">No logo uploaded.</p>
                                )}
                            </div>

                            {error && <p className="text-red-600 bg-red-100 p-3 rounded-md text-sm mb-4">{error}</p>}
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 px-4 py-2 bg-secondary text-white rounded-md hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-wait flex items-center justify-center"
                                    disabled={isWorking}
                                >
                                    {isUploading && <Spinner />}
                                    {isUploading ? 'Uploading...' : (logo?.url ? 'Replace Logo' : 'Upload Logo')}
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/svg+xml" className="hidden" />
                                
                                {logo?.url && (
                                    <button
                                        onClick={handleRemove}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-wait flex items-center justify-center"
                                        disabled={isWorking}
                                    >
                                        {isRemoving && <Spinner />}
                                        {isRemoving ? 'Removing...' : 'Remove Logo'}
                                    </button>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 mt-2 text-center">Recommended: SVG or PNG on a transparent background. Max size: 5MB.</p>
                        </>
                    )}
                </div>

                <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50" disabled={isWorking}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogoModal;