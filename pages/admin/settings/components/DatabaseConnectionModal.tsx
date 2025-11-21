import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

// --- Types ---
type DbTestResult = {
  ok: boolean;
  latencyMs: number;
  auth: 'authenticated' | 'anon';
  email?: string | null;
  sampleKey?: string | null;
  error?: string | null;
};

// --- Helper Components ---
const Spinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ResultRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
        <dt className="text-sm font-medium text-gray-600">{label}</dt>
        <dd className="text-sm text-gray-900 text-right">{children}</dd>
    </div>
);

// --- Main Modal Component ---
interface DatabaseConnectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DatabaseConnectionModal: React.FC<DatabaseConnectionModalProps> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<DbTestResult | null>(null);

    const runTest = useCallback(async () => {
        setLoading(true);
        setResult(null);

        const t0 = performance.now();
        
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from('portal_settings').select('key').limit(1);

        const t1 = performance.now();
        const latencyMs = Math.round(t1 - t0);

        if (error) {
            let errorMessage = `Network/credentials error. Check project URL and anon key. Details: ${error.message}`;
            // 42501 is Postgres' insufficient_privilege code, often seen with RLS issues.
            if (error.code === '42501' || error.message.includes('permission denied')) { 
                errorMessage = "Read blocked by RLS on portal_settings. Ensure a SELECT policy allows anon/authenticated to read ‘logo/theme/portal_text’ keys.";
            }

            setResult({
                ok: false,
                latencyMs,
                auth: user ? 'authenticated' : 'anon',
                email: user?.email,
                error: errorMessage,
            });
        } else {
            setResult({
                ok: true,
                latencyMs,
                auth: user ? 'authenticated' : 'anon',
                email: user?.email,
                sampleKey: data?.[0]?.key ?? '(none)',
            });
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            runTest();
        }
    }, [isOpen, runTest]);

    const handleCopyError = () => {
        if (result?.error) {
            navigator.clipboard.writeText(result.error).catch(err => console.error('Failed to copy text: ', err));
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="db-conn-title">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b flex justify-between items-center">
                    <h2 id="db-conn-title" className="text-xl font-bold text-primary">Database Connection</h2>
                    <button onClick={onClose} disabled={loading} className="text-gray-500 hover:text-gray-800 text-3xl font-light disabled:opacity-50" aria-label="Close modal">&times;</button>
                </div>
                
                <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">This test checks network access, auth, and read RLS by performing a lightweight query.</p>
                    
                    <div className="bg-gray-50 p-4 rounded-lg min-h-[200px] flex items-center justify-center">
                        {loading ? (
                            <div className="flex items-center text-gray-600">
                                <Spinner /> Testing connection...
                            </div>
                        ) : result && (
                            <dl className="w-full">
                                <ResultRow label="Status">
                                    {result.ok ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">✅ Connected</span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">❌ Failed</span>
                                    )}
                                </ResultRow>
                                <ResultRow label="Latency">
                                    <span>{result.latencyMs} ms</span>
                                </ResultRow>
                                <ResultRow label="Auth">
                                    <span className="truncate max-w-xs">
                                        {result.auth === 'authenticated' ? `Authenticated as ${result.email}` : 'Anonymous'}
                                    </span>
                                </ResultRow>
                                <div className="pt-2">
                                    <dt className="text-sm font-medium text-gray-600 mb-1">{result.ok ? 'Sample Read' : 'Error Details'}</dt>
                                    <dd className="text-sm text-gray-900 bg-white p-2 border rounded-md font-mono text-xs break-words">
                                        {result.ok ? (
                                            <pre className="whitespace-pre-wrap">{`SELECT "key" FROM "portal_settings" LIMIT 1;\n→ Returned: "${result.sampleKey}"`}</pre>
                                        ) : (
                                            <>
                                                <p>{result.error}</p>
                                                <button 
                                                    onClick={handleCopyError} 
                                                    className="text-blue-600 hover:underline text-xs mt-2 font-sans"
                                                >
                                                    Copy error
                                                </button>
                                            </>
                                        )}
                                    </dd>
                                </div>
                            </dl>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-b-lg flex justify-between items-center">
                    <button 
                        onClick={runTest} 
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50" 
                        disabled={loading}
                    >
                        Re-run Test
                    </button>
                    <button 
                        onClick={onClose} 
                        className="px-5 py-2 bg-secondary text-white rounded-md hover:opacity-90 transition-colors disabled:opacity-50" 
                        disabled={loading}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatabaseConnectionModal;