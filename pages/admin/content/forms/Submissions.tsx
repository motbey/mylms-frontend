import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { getSubmissionById, approveSubmission, rejectSubmission, FullSubmission, DerivedStatus, getFilesForSubmission } from '../../../../src/services/formSubmissions';
import { getFormById } from '../../../../src/services/forms';
import { FormSchema, BaseFormField, FileAnswerItem, SignatureAnswer } from '../../../../src/types/forms';
import { supabase } from '../../../../lib/supabaseClient';
import RichTextViewer from '../../../../src/components/RichTextViewer';
import { useSubmissionsListing } from '../../../../src/hooks/useSubmissionsListing';
import SubmissionStatusBadge from '../../../../src/components/SubmissionStatusBadge';

// --- Helper Functions & Components ---
const clsx = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

const formatDate = (isoString: string | null): string => {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return 'Invalid Date';
  }
};

const FileLink: React.FC<{ file: FileAnswerItem }> = ({ file }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDownload = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: urlError } = await supabase.storage
                .from(file.storageBucket)
                .createSignedUrl(file.storagePath, 3600); // 60 minutes
            
            if (urlError) throw urlError;
            
            window.open(data.signedUrl, '_blank');
        } catch (err: any) {
            setError('Could not get link.');
            console.error("Error creating signed URL:", err);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <li key={file.fileId}>
            <button type="button" onClick={handleDownload} disabled={loading} className="text-secondary hover:underline disabled:text-gray-500 disabled:no-underline">
                {file.fileName}
            </button>
            {loading && <span className="text-xs text-gray-500 ml-2">Generating link...</span>}
            {error && (
                <span className="text-xs text-red-500 ml-2">
                    {error} <button type="button" onClick={handleDownload} className="underline font-semibold">Retry</button>
                </span>
            )}
        </li>
    );
};


const Toast: React.FC<{ message: string; type: 'success' | 'error'; onDismiss: () => void }> = ({ message, type, onDismiss }) => {
    useEffect(() => {
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    }, [onDismiss]);
  
    const baseClasses = "fixed top-20 right-5 z-50 px-4 py-3 rounded-md shadow-lg text-white animate-fade-in-down";
    const typeClasses = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  
    return (
      <div className={`${baseClasses} ${typeClasses}`}>
        {message}
      </div>
    );
};


// --- List Page ---
export const AdminFormSubmissionsListPage: React.FC = () => {
    const {
      rows, total, loading, error,
      search, setSearch,
      statusFilter, setStatusFilter,
      sort, dir, setSortKey,
      page, setPage,
      pageSize, setPageSize,
      pageCount,
      load: retryFetch,
    } = useSubmissionsListing(25);
  
    const statusOptions: (DerivedStatus | 'All')[] = ['All', 'Not Started', 'Started', 'Submitted', 'Rejected', 'Completed'];
  
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

    const handleDownloadPdf = async (submissionId: string) => {
        setDownloadingPdfId(submissionId);
        setToast(null);

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error("Authentication error. Please log in again.");
            }

            // Use fetch for robust file downloads instead of invoke
            // FIX: Access the protected 'url' property using `as any` to bypass TypeScript's visibility check, as this is required for manual fetch calls.
            const response = await fetch(`${(supabase.functions as any).url}/generate-submission-pdf`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ submissionId }),
            });

            if (!response.ok) {
                // Try to parse error from Edge function response
                let errorMsg = `Failed to generate PDF (status ${response.status}).`;
                try {
                    const errorBody = await response.json();
                    if (errorBody.error) {
                        errorMsg = errorBody.error;
                    }
                } catch(e) { /* ignore if response is not json */ }
                throw new Error(errorMsg);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `submission-${submissionId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (err: any) {
            console.error("PDF download error:", err);
            setToast({
                message: err.message || "Failed to download PDF.",
                type: 'error',
            });
        } finally {
            setDownloadingPdfId(null);
        }
    };

    const SortHeader: React.FC<{ label: string; keyName: ReturnType<typeof useSubmissionsListing>['sort']; className?: string }> = ({ label, keyName, className }) => (
      <th
        scope="col"
        className={clsx('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 select-none cursor-pointer hover:bg-slate-100 transition-colors', className)}
        onClick={() => setSortKey(keyName)}
        title={`Sort by ${label}`}
      >
        <span className="inline-flex items-center gap-1.5">
          {label}
          <span className={clsx('text-slate-400', sort === keyName && 'text-slate-800')}>
              {sort === keyName ? (dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </span>
      </th>
    );
    
    return (
      <div className="animate-fade-in space-y-6">
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        <div>
          <Link to="/admin" className="text-sm text-secondary hover:underline">&larr; Back to Dashboard</Link>
          <h1 className="text-3xl font-bold text-primary mt-2">All Forms Overview</h1>
        </div>
  
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-md ring-1 ring-gray-100 space-y-4">
          {/* Controls */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
              {/* Search Input */}
              <div className="relative w-full md:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search form, name, email..."
                  className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as (DerivedStatus | 'All'))}
                className="w-full md:w-auto rounded-lg border border-gray-300 bg-white px-3 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-secondary"
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status === 'All' ? 'All Statuses' : status}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500 flex-shrink-0">
              Showing {rows.length > 0 ? (page * pageSize) + 1 : 0}–{Math.min((page + 1) * pageSize, total)} of {total}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr>
                  <SortHeader label="Form" keyName="form" />
                  <SortHeader label="Learner" keyName="learner" />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Email</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <SortHeader label="Submitted" keyName="submitted" />
                  <SortHeader label="Reviewed" keyName="reviewed" />
                  <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && !error && (
                  <tr><td className="px-4 py-10 text-sm text-gray-500 text-center" colSpan={7}>Loading submissions...</td></tr>
                )}
                {error && !loading && (
                  <tr>
                    <td className="px-4 py-10 text-sm text-red-600 text-center" colSpan={7}>
                      <p>{error}</p>
                      <button onClick={() => retryFetch()} className="mt-2 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        Retry
                      </button>
                    </td>
                  </tr>
                )}
                {!loading && !error && rows.length === 0 && (
                  <tr><td className="px-4 py-10 text-sm text-gray-500 text-center" colSpan={7}>No form submissions match your filters.</td></tr>
                )}
                {!loading && !error && rows.map((sub) => {
                  const status = sub.status?.toLowerCase() || '';
                  const isStarted = status === 'started';
                  const isSubmitted = status === 'submitted';
                  const isCompleted = status === 'completed';

                  return (
                    <tr key={sub.id} className="hover:bg-neutral/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{sub.form_title}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{sub.learner_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{sub.email}</td>
                      <td className="px-4 py-3 text-sm"><SubmissionStatusBadge status={sub.status} /></td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(sub.submitted_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(sub.reviewed_at)}</td>
                      <td className="px-3 py-3 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                            <Link
                                to={`/admin/forms/submissions/${sub.id}`}
                                className={clsx(
                                    'rounded-lg border px-3 py-1 text-xs font-medium',
                                    isSubmitted
                                    ? 'border-blue-200 bg-blue-50 text-secondary hover:bg-blue-100 font-semibold'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                                    isStarted && 'opacity-50 cursor-not-allowed'
                                )}
                                onClick={isStarted ? (e) => e.preventDefault() : undefined}
                                aria-disabled={isStarted}
                                style={isStarted ? { pointerEvents: 'none' } : {}}
                            >
                                {isSubmitted ? 'Review' : 'View'}
                            </Link>
                            {isCompleted && (
                                <button
                                    type="button"
                                    onClick={() => handleDownloadPdf(sub.id)}
                                    disabled={downloadingPdfId === sub.id}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    {downloadingPdfId === sub.id ? '...' : 'PDF'}
                                </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
  
          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <span>Rows per page</span>
                <select
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  disabled={loading}
                >
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <span>Page {page + 1} of {pageCount}</span>
                <button
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={page + 1 >= pageCount || loading}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
};
  
// --- Review Page ---

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
  
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 sm:px-6" aria-modal="true" role="dialog">
        <div className="w-full max-w-lg transform rounded-2xl bg-white shadow-xl transition-all max-h-[85vh] overflow-hidden flex flex-col">
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

// --- New component to handle async fetching of signed URLs for private images ---
const SignatureImage: React.FC<{ bucket: string; path: string }> = ({ bucket, path }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      let isMounted = true;
      const generateUrl = async () => {
        setLoading(true);
        setError(null);
        // Create a signed URL with a 1-hour expiry for secure access to the private image
        const { data, error: urlError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 3600);
  
        if (!isMounted) return;
  
        if (urlError) {
          console.error("Error creating signed URL:", urlError);
          setError("Could not load signature image.");
        } else {
          setImageUrl(data.signedUrl);
        }
        setLoading(false);
      };
  
      generateUrl();
  
      return () => {
        isMounted = false;
      };
    }, [bucket, path]);
  
    if (loading) {
      return <div className="text-sm text-gray-500">Loading signature...</div>;
    }
  
    if (error) {
      return <div className="text-sm text-red-500">{error}</div>;
    }
  
    if (imageUrl) {
      return <img src={imageUrl} alt="Signature" className="max-w-xs border rounded-md bg-gray-50" />;
    }
  
    return null;
};

const renderAnswer = (field: BaseFormField, answer: any) => {
    if (answer === null || answer === undefined || (typeof answer === 'string' && answer.trim() === '') || (Array.isArray(answer) && answer.length === 0)) {
        return <em className="text-gray-400">Not provided</em>;
    }
    
    switch(field.type) {
        case 'file':
            const fileAnswers = (answer as FileAnswerItem[]) || [];
            if (fileAnswers.length === 0) {
                return <em className="text-gray-400">Not provided</em>;
            }
            return (
                <ul className="list-disc list-inside space-y-1">
                    {fileAnswers.map(file => <FileLink key={file.fileId} file={file} />)}
                </ul>
            );
        case 'signature': {
            const signature = answer as SignatureAnswer;
            if (signature && signature.storageBucket && signature.storagePath) {
                // Use the new component to handle fetching the secure, temporary URL
                return <SignatureImage bucket={signature.storageBucket} path={signature.storagePath} />;
            }
            return <em className="text-gray-400">No signature provided</em>;
        }
        case 'checkbox_group':
            const optionsMap = new Map(field.options?.map(o => [o.value, o.label]));
            const labels = Array.isArray(answer) ? answer.map(val => optionsMap.get(val) || val) : [String(answer)];
            return <ul className="list-disc list-inside"> {labels.map((label, i) => <li key={i}>{label}</li>)} </ul>;
        case 'checkbox':
            return answer ? 'Checked' : 'Not checked';
        case 'date':
            try {
                return new Date(answer + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
            } catch {
                return String(answer);
            }
        case 'dropdown':
            const selectedOption = field.options?.find(o => o.value === answer);
            return selectedOption ? selectedOption.label : String(answer);
        case 'long_text':
             return <p className="whitespace-pre-wrap">{String(answer)}</p>;
        case 'static_text':
            return null; // Static text has no answer
        case 'divider':
            return null; // Divider has no answer
        default:
            return String(answer);
    }
};

export const AdminFormSubmissionReviewPage: React.FC = () => {
    const { submissionId } = useParams<{ submissionId: string }>();
    const navigate = useNavigate();

    const [submission, setSubmission] = useState<FullSubmission | null>(null);
    const [schema, setSchema] = useState<FormSchema | null>(null);
    const [files, setFiles] = useState<Record<string, FileAnswerItem[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    useEffect(() => {
        if (!submissionId || submissionId === 'undefined') {
            setError("Submission ID not found.");
            setLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                const subData = await getSubmissionById(submissionId);
                if (!subData) {
                    throw new Error("Submission not found.");
                }
                setSubmission(subData);

                const [formData, fileData] = await Promise.all([
                    getFormById(subData.form_id),
                    getFilesForSubmission(subData.id)
                ]);
                
                if (!formData) {
                    throw new Error("Associated form could not be found.");
                }
                setSchema(formData.schema);
                setFiles(fileData);
            } catch (err: any) {
                setError(err.message || "Failed to load submission data.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [submissionId]);
    
    const handleApprove = async () => {
        if (!submissionId) return;
        setIsApproving(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Admin user not found.");

            await approveSubmission(submissionId, user.id);
            setToast({ message: "Submission approved.", type: 'success' });
            setTimeout(() => navigate('/admin/forms/submissions'), 2000);
        } catch (err: any) {
            setError(err.message);
            setIsApproving(false);
        }
    };

    const handleOpenRejectModal = () => {
        setRejectionReason('');
        setError(null);
        setIsRejectModalOpen(true);
    };

    const handleCloseRejectModal = () => {
        if (!isRejecting) {
            setIsRejectModalOpen(false);
        }
    };

    const handleReject = async () => {
        if (!submissionId || !rejectionReason.trim()) return;
        setIsRejecting(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Admin user not found.");

            await rejectSubmission(submissionId, user.id, rejectionReason);
            setToast({ message: "Submission rejected and learner will see the reason.", type: 'success' });
            setTimeout(() => navigate('/admin/forms/submissions'), 2000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsRejecting(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading submission...</div>;
    if (error && !isRejectModalOpen) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>;
    if (!submission || !schema) return <div className="p-8 text-center">Submission or form schema not found.</div>;

    const allAnswers = { ...(submission.data?.answers || {}), ...files };

    const renderStatus = () => {
        switch (submission.review_status) {
            case 'approved':
                return <div className="text-sm text-green-700 bg-green-100 px-4 py-2 rounded-md">Approved by {submission.reviewer_name || 'an admin'} on {formatDate(submission.reviewed_at)}.</div>;
            case 'rejected':
                return (
                    <div className="text-sm text-red-700 bg-red-100 px-4 py-2 rounded-md">
                        <p><strong>Rejected by {submission.reviewer_name || 'an admin'} on {formatDate(submission.reviewed_at)}.</strong></p>
                        {submission.rejection_reason && <p className="mt-1">Reason: {submission.rejection_reason}</p>}
                    </div>
                );
            default: // pending or null
                const canReview = submission.status === 'submitted';
                if (!canReview) {
                    return null;
                }
                return (
                    <>
                        <button
                            onClick={handleOpenRejectModal}
                            disabled={isApproving || isRejecting}
                            className="px-6 py-2 bg-white text-red-600 border border-red-500 font-semibold rounded-md hover:bg-red-50 disabled:opacity-50"
                        >
                            Reject
                        </button>
                        <button 
                            onClick={handleApprove}
                            disabled={isApproving || isRejecting}
                            className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 disabled:bg-gray-400"
                        >
                            {isApproving ? 'Approving...' : 'Approve'}
                        </button>
                    </>
                );
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

            <Link to="/admin/forms/submissions" className="text-sm text-secondary hover:underline">&larr; Back to All Submissions</Link>
            
            <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100">
                <h1 className="text-2xl font-bold text-primary mb-2">Review Submission: {schema.title}</h1>
                <div className="text-sm text-gray-500 space-y-1">
                    <p><strong>Submitted by:</strong> {submission.user_name} ({submission.user_email})</p>
                    <p><strong>Submitted on:</strong> {formatDate(submission.submitted_at)}</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100 space-y-6">
                {schema.sections.map(section => (
                    <div key={section.id}>
                        {section.title && <h2 className="text-xl font-semibold text-primary border-b pb-2 mb-4">{section.title}</h2>}
                        <div className="divide-y divide-gray-200">
                            {section.fields.map(field => {
                                if (field.type === 'static_text') {
                                    return (
                                        <div key={field.id} className="py-4">
                                            {field.label && <h3 className="text-sm font-semibold text-gray-800 mb-1">{field.label}</h3>}
                                            <RichTextViewer html={field.helpText || ''} />
                                        </div>
                                    );
                                }
                                if (field.type === 'image') {
                                    return (
                                        <div key={field.id} className="py-4 text-center">
                                            {field.imageUrl && <img src={field.imageUrl} alt={field.imageAlt || ''} className="max-w-full rounded-md border inline-block" />}
                                            {field.imageCaption && <p className="text-xs text-gray-600 italic mt-1">{field.imageCaption}</p>}
                                        </div>
                                    );
                                }
                                if (field.type === 'divider') {
                                    return (
                                        <div key={field.id} className="py-4">
                                            <hr style={{
                                                borderTopStyle: field.dividerStyle || 'solid',
                                                borderColor: field.dividerColor || '#E5E7EB',
                                                borderWidth: `${field.dividerThickness || 1}px`,
                                                marginTop: `${field.dividerMarginTop || 8}px`,
                                                marginBottom: `${field.dividerMarginBottom || 8}px`,
                                            }} />
                                        </div>
                                    );
                                }

                                // For all other interactive fields, render the label/answer pair
                                return (
                                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 py-4">
                                        <div className="text-sm font-medium text-gray-600 col-span-1">{field.label}</div>
                                        <div className="text-sm text-gray-900 col-span-2">{renderAnswer(field, allAnswers[field.id])}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end gap-4 mt-6">
                {renderStatus()}
            </div>

            <Modal isOpen={isRejectModalOpen} onClose={handleCloseRejectModal} title="Reject submission?">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">This will mark the submission as rejected. The reason you provide will be visible to the learner.</p>
                    <div>
                        <label htmlFor="rejection_reason" className="block text-sm font-medium text-gray-700">Reason for rejection <span className="text-red-500">*</span></label>
                        <textarea
                            id="rejection_reason"
                            rows={4}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
                            placeholder="e.g., The uploaded certificate is out of date. Please upload a current one."
                            disabled={isRejecting}
                        />
                    </div>
                    {error && <p className="text-red-600 bg-red-100 p-3 rounded-md text-sm">{error}</p>}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button onClick={handleCloseRejectModal} disabled={isRejecting} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                        <button 
                            onClick={handleReject} 
                            disabled={isRejecting || !rejectionReason.trim()}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                        >
                            {isRejecting ? 'Rejecting...' : 'Reject Submission'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};