import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface ScormModule {
  id: string;
  title: string;
  launch_url: string;
}

const ScormPlayer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [module, setModule] = useState<ScormModule | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // --- Inject SCORM API Shim ---
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/scorm-api-1_2.js";
    script.async = false; // Ensure immediate execution
    document.head.appendChild(script);

    return () => {
      // Cleanup script and window.API to prevent state leaking between modules
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
      // @ts-ignore
      delete window.API;
      // @ts-ignore
      delete window.API_1484_11;
    };
  }, []);

  useEffect(() => {
    if (!id) {
      setError('Module ID is missing.');
      setLoading(false);
      return;
    }

    const fetchModule = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('modules')
          .select('id, title, launch_url')
          .eq('id', id)
          .eq('type', 'scorm')
          .single();

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            throw new Error('SCORM module not found.');
          }
          throw fetchError;
        }
        
        if (!data || !data.launch_url) {
            throw new Error('Module data is incomplete or missing a launch URL.');
        }

        setModule(data as ScormModule);

        const launchUrl = data.launch_url;
        let s3Key = '';

        // Logic to normalize the launch URL into a clean S3 Key
        if (launchUrl.startsWith('http://') || launchUrl.startsWith('https://')) {
            try {
                // Extract path from full URL (e.g. https://bucket.../key)
                const urlObj = new URL(launchUrl);
                s3Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
            } catch (e) {
                console.error("Failed to parse URL", e);
                s3Key = launchUrl;
            }
        } else if (launchUrl.startsWith('modules/')) {
            // Already in the new clean format: modules/uuid/index.html
            s3Key = launchUrl;
        } else {
            // Legacy format: bucket/modules/uuid/index.html
            // We strip the first segment (bucket name)
            const parts = launchUrl.split('/');
            if (parts.length > 1) {
                s3Key = parts.slice(1).join('/');
            } else {
                s3Key = launchUrl;
            }
        }

        // Set the proxy URL
        setIframeSrc(`/scorm/${s3Key}`);

      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred while fetching the module.');
      } finally {
        setLoading(false);
      }
    };

    fetchModule();
  }, [id]);

  const handleIFrameLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Access the contentWindow. This works because we are on the same origin via the proxy.
    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) return;

    const parentWin = window as any;
    const childWin = iframeWindow as any;

    // Explicitly inject the API object if it exists in parent but not in child
    if (parentWin.API && !childWin.API) {
      childWin.API = parentWin.API;
      console.log("[MyLMS] Injected SCORM 1.2 API into iframe");
    }
    if (parentWin.API_1484_11 && !childWin.API_1484_11) {
      childWin.API_1484_11 = parentWin.API_1484_11;
      console.log("[MyLMS] Injected SCORM 2004 API into iframe");
    }
  };

  if (loading) {
    return (
      <div className="text-center p-10">
        <p className="text-gray-600">Loading SCORM module...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-10 bg-red-50 rounded-lg">
        <p className="text-red-700 font-semibold">Error</p>
        <p className="text-red-600 mt-2">{error}</p>
        <Link to="/admin/content/elearning" className="mt-4 inline-block text-sm text-secondary hover:underline">&larr; Back to E-Learning Content</Link>
      </div>
    );
  }

  if (!module || !iframeSrc) {
    return (
       <div className="text-center p-10">
        <p className="text-gray-600">Module could not be loaded.</p>
        <Link to="/admin/content/elearning" className="mt-4 inline-block text-sm text-secondary hover:underline">&larr; Back to E-Learning Content</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
            <div>
                <Link to="/admin/content/elearning" className="text-sm text-secondary hover:underline">&larr; Back to E-Learning Content</Link>
                <h1 className="text-2xl font-bold text-primary mt-1">{module.title}</h1>
            </div>
        </div>
      
      <div className="w-full bg-gray-200 rounded-lg overflow-hidden shadow-md">
         <iframe
            ref={iframeRef}
            src={iframeSrc}
            onLoad={handleIFrameLoad}
            title={module.title}
            style={{ width: "100%", height: "80vh", border: "none" }}
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
        />
      </div>
    </div>
  );
};

export default ScormPlayer;