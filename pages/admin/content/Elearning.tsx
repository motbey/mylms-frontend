import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import FavoritesSection from '../../../components/FavoritesSection';
import { supabase } from '../../../lib/supabaseClient';
import { Upload } from 'lucide-react';

// --- Types ---
interface ScormModule {
  id: string;
  title: string;
  type: 'scorm';
  duration_minutes: number | null;
  launch_url: string;
  created_at: string;
  description: string | null;
}

// --- Reusable Toast Component ---
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onDismiss: () => void }> = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const baseClasses = "fixed top-20 right-5 z-50 px-4 py-3 rounded-md shadow-lg text-white animate-fade-in-down";
  const typeClasses = type === 'success' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      {message}
    </div>
  );
};

// --- Reusable Modal Component ---
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 sm:px-6" aria-modal="true" role="dialog" onClick={onClose}>
      <div className="w-full max-w-lg transform rounded-2xl bg-white shadow-xl transition-all max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="border-b px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light" aria-label="Close modal">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Reusable input component for form consistency
const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, id, ...props }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            id={id}
            {...props}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm disabled:bg-gray-100 placeholder:text-gray-400"
        />
    </div>
);

const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
};

const AdminElearning: React.FC = () => {
  // Form state
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Modules list state
  const [scormModules, setScormModules] = useState<ScormModule[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState<boolean>(true);
  const [modulesError, setModulesError] = useState<string | null>(null);
  
  const loadScormModules = useCallback(async () => {
    setIsLoadingModules(true);
    setModulesError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('modules')
        .select('id, title, type, duration_minutes, launch_url, created_at, description')
        .eq('type', 'scorm')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }
      setScormModules(data as ScormModule[]);
    } catch (err: any) {
      setModulesError('Failed to load SCORM modules. Please try again.');
      console.error(err);
    } finally {
      setIsLoadingModules(false);
    }
  }, []);

  useEffect(() => {
    loadScormModules();
  }, [loadScormModules]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const openUploadModal = () => setIsUploadModalOpen(true);

  const closeUploadModal = () => {
    if (isUploading) return; // Prevent closing while an upload is in progress

    // Reset form state for next time
    setTitle('');
    setDuration('');
    setFile(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    setError(null);
    
    setIsUploadModalOpen(false);
  };
  
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // --- Validation ---
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Module title is required.");
      return;
    }
    if (!file) {
      setError("A SCORM package (.zip file) is required.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("The selected file must be a .zip package.");
      return;
    }
    const durationMinutes = duration ? parseInt(duration, 10) : null;
    if (
      durationMinutes !== null &&
      (isNaN(durationMinutes) || durationMinutes < 0)
    ) {
      setError("Duration must be a positive number.");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload the ZIP to the TEMP bucket
      const objectPath = `temp/${crypto.randomUUID()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("scorm-packages-temp")
        .upload(objectPath, file);

      if (uploadError) {
        throw new Error(`Storage error: ${uploadError.message}`);
      }

      // 2. Build the zip_path for the Edge Function
      const zipPath = `scorm-packages-temp/${objectPath}`;

      // 3. Call the Edge Function to finalize
      const { data, error: functionError } = await supabase.functions.invoke(
        "finalize-scorm-upload",
        {
          body: {
            title: trimmedTitle,
            duration_minutes: durationMinutes,
            zip_path: zipPath,
          },
        }
      );

      if (functionError) {
        console.error("Edge function error:", functionError);
        throw new Error(
          `Error creating SCORM module: ${
            functionError.message || "details not available"
          }`
        );
      }

      // 4. Handle success
      const createdTitle = (data as any)?.module?.title ?? trimmedTitle;
      setToast({ message: `SCORM module '${createdTitle}' uploaded successfully.`, type: 'success' });
      closeUploadModal();
      await loadScormModules();

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link to="/admin/content" className="text-blue-600 hover:underline mb-4 inline-block text-sm">&larr; Back to Content Management</Link>
          <h1 className="text-2xl font-bold text-gray-800">E-Learning Content</h1>
          <p className="mt-2 text-gray-600">Upload and manage e-learning modules.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
             <Link
              to="/admin/content/upload-scorm-s3"
              className="px-6 py-2 text-center bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <Upload size={18} />
              Upload SCORM
            </Link>
        </div>
      </div>
      
      <FavoritesSection />

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md ring-1 ring-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">SCORM Modules</h2>
        {isLoadingModules ? (
            <p className="text-gray-500 text-center py-4">Loading SCORM modules…</p>
        ) : modulesError ? (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{modulesError}</div>
        ) : scormModules.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No SCORM modules have been uploaded yet.</p>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b">
                        <tr>
                            <th className="py-2 pr-4 font-semibold text-gray-700">Title</th>
                            <th className="py-2 pr-4 font-semibold text-gray-700">Duration (minutes)</th>
                            <th className="py-2 pr-4 font-semibold text-gray-700">Created At</th>
                            <th className="py-2 pr-4 font-semibold text-gray-700">Description</th>
                            <th className="py-2 pl-4 font-semibold text-gray-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scormModules.map((mod) => (
                            <tr key={mod.id} className="border-b last:border-b-0">
                                <td className="py-2 pr-4 font-medium text-gray-800">{mod.title}</td>
                                <td className="py-2 pr-4 text-gray-600">{mod.duration_minutes ?? '—'}</td>
                                <td className="py-2 pr-4 text-gray-600">{formatDate(mod.created_at)}</td>
                                <td className="py-2 pr-4 text-gray-600 truncate max-w-xs" title={mod.description || ''}>
                                    {mod.description || <span className="text-gray-400 italic">No description</span>}
                                </td>
                                <td className="py-2 pl-4 text-right">
                                    <Link
                                        to={`/scorm/${mod.id}`}
                                        className="px-3 py-1 bg-secondary text-white text-xs font-semibold rounded-md hover:opacity-90 transition-opacity"
                                    >
                                        Launch
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
      
      <Modal isOpen={isUploadModalOpen} onClose={closeUploadModal} title="Upload SCORM Package">
        <form onSubmit={handleUpload}>
          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

            <FormInput
              label="Module Title"
              id="module-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g., Fire Safety Training 2024"
              disabled={isUploading}
            />
            
            <FormInput
              label="Duration (minutes)"
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="0"
              placeholder="e.g., 30"
              disabled={isUploading}
            />

            <div>
              <label htmlFor="scorm-file" className="block text-sm font-medium text-gray-700 mb-1">SCORM Package (ZIP)</label>
              <input
                id="scorm-file"
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-secondary hover:file:bg-blue-100"
                required
                disabled={isUploading}
              />
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={closeUploadModal}
              disabled={isUploading}
              className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-wait"
            >
              {isUploading ? 'Uploading...' : 'Upload SCORM module'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminElearning;