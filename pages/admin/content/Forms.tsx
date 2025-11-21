import React, { useEffect, useState, MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FavoritesSection from '../../../components/FavoritesSection';
import { supabase } from '../../../lib/supabaseClient';
import { listForms, duplicateForm, DbForm } from '../../../src/services/forms';

// --- Simple Toast component ---
type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const baseClasses =
    'fixed top-20 right-5 z-50 px-4 py-3 rounded-md shadow-lg text-white animate-fade-in-down';
  const typeClasses =
    type === 'success' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      {message}
    </div>
  );
};

const AdminForms: React.FC = () => {
  const navigate = useNavigate();

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [forms, setForms] = useState<DbForm[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicatingId, setIsDuplicatingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Load current user id for duplicateForm createdBy
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userId = data?.user?.id ?? null;
      setCurrentUserId(userId);
    });
  }, []);

  // Load forms from Supabase
  const loadForms = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await listForms();
      setForms(result);
    } catch (err: any) {
      console.error('Error loading forms', err);
      setError('Failed to load forms. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const handleDuplicate = async (formId: string) => {
    if (!currentUserId) {
      setToast({
        message: 'You must be logged in as an admin to copy forms.',
        type: 'error',
      });
      return;
    }

    try {
      setIsDuplicatingId(formId);
      await duplicateForm({ formId, createdBy: currentUserId });
      setToast({ message: 'Form copied successfully.', type: 'success' });
      await loadForms();
    } catch (err: any) {
      console.error('Error duplicating form', err);
      setToast({
        message: err.message ?? 'Failed to copy form. Please try again.',
        type: 'error',
      });
    } finally {
      setIsDuplicatingId(null);
    }
  };

  const handleCreateFormClick = async () => {
    setIsCreating(true);
    setToast(null);
    try {
      const { data: formId, error: rpcError } = await supabase.rpc('create_form_draft', { p_name: 'New Form' });
      if (rpcError) {
        throw rpcError;
      }

      if (!formId || typeof formId !== 'string') {
        throw new Error("Could not retrieve the new form's ID.");
      }

      navigate(`/admin/content/forms/${formId}`);

    } catch (err: any) {
      console.error("Error creating form draft:", err);
      setToast({
        message: err.message ?? "Failed to create a new form draft.",
        type: 'error',
      });
      setIsCreating(false);
    }
  };

  const handleEdit = (formId: string) => {
    navigate(`/admin/content/forms/${formId}`);
  };

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      <div className="bg-white p-8 rounded-lg shadow-md">
        <Link
          to="/admin/content"
          className="text-blue-600 hover:underline mb-6 inline-block"
        >
          &larr; Back to Content Management
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Manage Forms</h1>
        <p className="mt-4 text-gray-600">
          Create, copy and manage custom forms and surveys for your learners.
        </p>
      </div>

      <FavoritesSection />

      <div className="mt-10 bg-white p-8 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-700">Existing Forms</h2>
          <button
            onClick={handleCreateFormClick}
            disabled={isCreating}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create Form'}
          </button>
        </div>

        {isLoading && (
          <p className="text-gray-500">Loading forms…</p>
        )}

        {error && !isLoading && (
          <p className="text-red-600">{error}</p>
        )}

        {!isLoading && !error && forms.length === 0 && (
          <p className="text-gray-500">
            No forms yet. Click &quot;Create Form&quot; to add your first form.
          </p>
        )}

        {!isLoading && !error && forms.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 font-semibold text-gray-700">Name</th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">Version</th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">Created At</th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((form) => (
                  <tr key={form.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 text-gray-800">{form.name}</td>
                    <td className="py-2 pr-4 text-gray-600">v{form.version}</td>
                    <td className="py-2 pr-4 text-gray-600">
                      {form.created_at
                        ? new Date(form.created_at).toLocaleString()
                        : '—'}
                    </td>
                    <td className="py-2 pr-4 space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(form.id)}
                        className="inline-flex items-center px-3 py-1 rounded-md border border-gray-300 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(form.id)}
                        disabled={isDuplicatingId === form.id}
                        className="inline-flex items-center px-3 py-1 rounded-md border border-gray-300 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDuplicatingId === form.id ? 'Copying…' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminForms;