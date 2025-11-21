import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { listMyForms, MyForm, getFormById } from '../../src/services/forms';
import { saveOrSubmitSubmission, uploadAndLinkFile, getLatestUserSubmission, UserSubmission, getFilesForSubmission, getSignedUrl, deleteFormFile, uploadSignature } from '../../src/services/formSubmissions';
import { supabase } from '../../lib/supabaseClient';
import type { FormSchema, BaseFormField, FormAnswers, FormAnswerValue, FileAnswerItem, SignatureAnswer } from '../../src/types/forms';
import SignaturePad from '../../src/components/SignaturePad';
import RichTextViewer from '../../src/components/RichTextViewer';
import {
  Circle,
  Loader,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  CalendarDays,
  ChevronRight,
} from 'lucide-react';


// --- UserForms (List Page) ---

// --- Types and Constants for New Design ---
type FormStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'Approved' | 'Rejected';
const filterPills: ('All' | FormStatus)[] = ['All', 'Not Started', 'In Progress', 'Submitted', 'Approved', 'Rejected'];

const mapMyFormStatus = (status: MyForm['status']): FormStatus => {
  switch (status) {
    case 'Started': return 'In Progress';
    case 'Completed': return 'Approved';
    default: return status;
  }
};

const statusConfig: Record<FormStatus, { icon: React.FC<any>; ribbonClass: string; }> = {
  'Not Started': { icon: Circle, ribbonClass: 'bg-gray-400' },
  'In Progress': { icon: Loader, ribbonClass: 'bg-blue-500' },
  'Submitted': { icon: Send, ribbonClass: 'bg-purple-500' },
  'Approved': { icon: CheckCircle2, ribbonClass: 'bg-green-600' },
  'Rejected': { icon: XCircle, ribbonClass: 'bg-red-600' },
};

const accentColors = ['accent', 'secondary', 'primary'];
const accentColorClasses: { [key: string]: { ribbonBg: string; border: string; text: string; } } = {
  accent: { ribbonBg: 'bg-accent', border: 'border-accent', text: 'text-accent' },
  secondary: { ribbonBg: 'bg-secondary', border: 'border-secondary', text: 'text-secondary' },
  primary: { ribbonBg: 'bg-primary', border: 'border-primary', text: 'text-primary' },
};

type Urgency = 'overdue' | 'due-soon' | 'normal';
const getUrgency = (dueDate: string | null): Urgency | null => {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Compare dates only
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'due-soon';
  return 'normal';
};

// --- Helper Components for New Design ---

const DueDateBadge: React.FC<{ dueDate: string | null }> = ({ dueDate }) => {
  const urgency = getUrgency(dueDate);
  if (!urgency) return null;

  const urgencyStyles: Record<Urgency, string> = {
    overdue: 'bg-red-100 text-red-700',
    'due-soon': 'bg-orange-100 text-orange-700',
    normal: 'bg-gray-100 text-gray-700',
  };

  const formattedDate = new Date(dueDate!).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className={`inline-flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-full ${urgencyStyles[urgency]}`}>
      <CalendarDays size={14} />
      <span>Due {formattedDate}</span>
    </div>
  );
};

const FormCard: React.FC<{ form: MyForm; index: number }> = ({ form, index }) => {
  const displayStatus = mapMyFormStatus(form.status);
  const StatusIcon = statusConfig[displayStatus].icon;
  const accentKey = accentColors[index % accentColors.length];
  const colors = accentColorClasses[accentKey];

  return (
    <div className="relative overflow-hidden bg-white rounded-xl shadow-sm border h-full flex flex-col transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
      <div className={`absolute -top-8 -left-8 w-32 h-16 ${colors.ribbonBg} transform -rotate-45 flex justify-center items-end text-white text-[10px] font-bold pb-1 z-10 shadow-inner`}>
        <div className="flex items-center gap-1.5 transform rotate-45 translate-y-3 -translate-x-2">
          <StatusIcon size={12} className={displayStatus === 'In Progress' ? 'animate-spin' : ''} />
          <span>{displayStatus}</span>
        </div>
      </div>
      <div className="p-5 flex-grow flex flex-col">
        <h3 className="font-bold text-primary mb-2 mt-4 text-base">{form.form_name}</h3>
        <p className="text-sm text-gray-500 flex-grow mb-4">Complete this form to provide required information.</p>
        
        <div className="space-y-3 mb-4">
            <DueDateBadge dueDate={form.due_at} />
            {form.submitted_at && (
                <p className="text-xs text-gray-400">
                    Submitted on {new Date(form.submitted_at).toLocaleDateString()}
                </p>
            )}
        </div>

        <div className="mt-auto">
          <Link to={`/forms/${form.form_id}/fill`} className={`inline-block w-full text-center px-4 py-2 text-sm font-semibold rounded-lg border-2 ${colors.border} ${colors.text} bg-white hover:bg-gray-50 transition-colors`}>
            {['Not Started', 'Started', 'Rejected'].includes(form.status) ? 'Open Form' : 'View Form'}
          </Link>
        </div>
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => (
    <div className="text-center py-16 px-6 bg-gray-50 rounded-2xl border-2 border-dashed">
        <FileText className="mx-auto h-12 w-12 text-gray-400" strokeWidth={1} />
        <h3 className="mt-4 text-lg font-semibold text-gray-800">No forms to display</h3>
        <p className="mt-1 text-sm text-gray-500">
            You don’t have any forms that match the current filter.
        </p>
    </div>
);

export const UserForms: React.FC = () => {
  const [forms, setForms] = useState<MyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'All' | FormStatus>('All');

  useEffect(() => {
    const fetchForms = async () => {
      try {
        setLoading(true);
        setError(null);
        const myForms = await listMyForms();
        setForms(myForms);
      } catch (err: any) {
        console.error('Failed to load my forms:', err);
        setError('We couldn’t load your forms. Please refresh the page or try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchForms();
  }, []);

  const filteredForms = useMemo(() => {
    if (activeFilter === 'All') return forms;
    return forms.filter(form => mapMyFormStatus(form.status) === activeFilter);
  }, [forms, activeFilter]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-200 h-64 rounded-xl"></div>
            ))}
        </div>
      );
    }
    if (error) {
      return <p className="text-red-600 text-center py-8 bg-red-50 rounded-lg">{error}</p>;
    }
    if (filteredForms.length === 0) {
      return <EmptyState />;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredForms.map((form, index) => (
                <FormCard key={form.assignment_id} form={form} index={index} />
            ))}
        </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-8">
        <div>
            <nav className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                <Link to="/dashboard" className="hover:text-secondary">Dashboard</Link>
                <ChevronRight size={16} />
                <span>Forms</span>
            </nav>
            <h1 className="text-3xl font-bold text-gray-800">Forms</h1>
            <p className="mt-1 text-gray-500">Forms and surveys assigned to you.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            {filterPills.map(filter => (
                <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-full border-2 transition-colors ${
                        activeFilter === filter
                        ? 'bg-secondary text-white border-transparent'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-secondary hover:text-secondary'
                    }`}
                >
                    {filter}
                </button>
            ))}
        </div>

        <div>
            {renderContent()}
        </div>
    </div>
  );
};


// --- UserFillForm (Editable/Read-Only Page) ---
// THIS COMPONENT REMAINS UNCHANGED AS PER THE INSTRUCTIONS.

interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}
type PreSubmissionAnswerValue = FormAnswerValue | File | File[];

const SignatureImageViewer: React.FC<{ bucket: string; path: string }> = ({ bucket, path }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      let isMounted = true;
      const generateUrl = async () => {
        setLoading(true);
        setError(null);
        const signedUrl = await getSignedUrl(bucket, path);
        if (isMounted) {
            if (!signedUrl) {
                setError("Could not load signature image.");
            } else {
                setImageUrl(signedUrl);
            }
            setLoading(false);
        }
      };
      generateUrl();
      return () => { isMounted = false; };
    }, [bucket, path]);
  
    if (loading) return <div className="text-sm text-gray-500">Loading signature...</div>;
    if (error) return <div className="text-sm text-red-500">{error}</div>;
    if (imageUrl) return <img src={imageUrl} alt="Signature" className="max-w-xs border rounded-md bg-gray-50" />;
    return null;
};

const FileLink: React.FC<{ file: FileAnswerItem }> = ({ file }) => {
    const [loading, setLoading] = useState(false);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const signedUrl = await getSignedUrl(file.storageBucket, file.storagePath);
            window.open(signedUrl, '_blank');
        } catch(err) {
            console.error(err);
            // In a real app, show a toast notification here
        } finally {
            setLoading(false);
        }
    };

    return (
        <a href="#" onClick={handleClick} className="text-secondary hover:underline">
            {loading ? 'Generating link...' : file.fileName}
        </a>
    );
};


const renderAnswerReadOnly = (field: BaseFormField, answer: any) => {
    if (answer === null || answer === undefined) return <em className="text-gray-400">Not provided</em>;
    
    switch(field.type) {
        case 'file':
            const files = (Array.isArray(answer) ? answer : []) as FileAnswerItem[];
            if (files.length === 0) return <em className="text-gray-400">Not provided</em>;
            return (
                <ul className="list-disc list-inside space-y-1">
                    {files.map((file) => (
                        <li key={file.fileId}><FileLink file={file} /></li>
                    ))}
                </ul>
            );
        case 'signature': {
            const signature = answer as SignatureAnswer;
            if (signature && signature.storageBucket && signature.storagePath) {
                return <SignatureImageViewer bucket={signature.storageBucket} path={signature.storagePath} />;
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
            try { return new Date(answer + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' }); }
            catch { return String(answer); }
        case 'dropdown':
            const selectedOption = field.options?.find(o => o.value === answer);
            return selectedOption ? selectedOption.label : String(answer);
        case 'long_text':
             return <p className="whitespace-pre-wrap">{String(answer)}</p>;
        default:
            return String(answer);
    }
};

export const UserFillForm: React.FC = () => {
    const { formId } = useParams<{ formId: string }>();
    const navigate = useNavigate();

    const [schema, setSchema] = useState<FormSchema | null>(null);
    const [submission, setSubmission] = useState<UserSubmission | null>(null);
    const [assignment, setAssignment] = useState<{ id: string; started_at: string | null; } | null>(null);
    const [answers, setAnswers] = useState<Record<string, PreSubmissionAnswerValue>>({});
    
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploads, setUploads] = useState<Record<string, UploadItem[]>>({});
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!formId) return;
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate('/login');
                    return;
                }

                const form = await getFormById(formId);
                if (!form) {
                    setError("Form not found.");
                    setLoading(false);
                    return;
                }
                setSchema(form.schema);
                
                // FIX: Added explicit type annotation for `sub` to resolve a TypeScript inference issue where its properties were not being recognized.
                const sub: UserSubmission | null = await getLatestUserSubmission(formId, user.id);
                setSubmission(sub);

                const { data: assignmentData } = await supabase
                    .from('form_assignments')
                    .select('id, started_at')
                    .eq('form_id', formId)
                    .or(`target_type.eq.all,and(target_type.eq.user,target_id.eq.${user.id})`)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                setAssignment(assignmentData);
                
                // This line was causing an error, which is resolved by typing `sub` above.
                const readOnly = (sub?.status === 'submitted' && sub.review_status !== 'rejected') || sub?.review_status === 'approved';
                setIsReadOnly(readOnly);

                const initialAnswers: Record<string, PreSubmissionAnswerValue> = {};
                form.schema.sections.forEach(section => {
                    section.fields.forEach(field => {
                        initialAnswers[field.id] = field.defaultValue as PreSubmissionAnswerValue;
                    });
                });

                if (sub?.data?.answers) {
                    Object.assign(initialAnswers, sub.data.answers);
                }

                if (sub) {
                    const files = await getFilesForSubmission(sub.id);
                    Object.assign(initialAnswers, files);
                }

                setAnswers(initialAnswers);

            } catch (e: unknown) {
                console.error("Failed to load form data:", e);
                setError("Failed to load form data.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [formId, navigate]);

    useEffect(() => {
        if (assignment && assignment.started_at === null && !isReadOnly) {
            const markAsStarted = async () => {
                const { error: updateError } = await supabase
                    .from('form_assignments')
                    .update({ started_at: new Date().toISOString() })
                    .eq('id', assignment.id);
                
                if (updateError) {
                    console.warn('Could not mark form as started:', updateError.message);
                } else {
                    setAssignment(prev => prev ? { ...prev, started_at: new Date().toISOString() } : null);
                }
            };
            markAsStarted();
        }
    }, [assignment, isReadOnly]);

    const handleAnswerChange = (fieldId: string, value: PreSubmissionAnswerValue) => {
        setAnswers(prev => ({ ...prev, [fieldId]: value }));
        if (validationErrors[fieldId]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };
    
    const handleSignatureChange = (fieldId: string, dataUrl: string | null) => {
        handleAnswerChange(fieldId, dataUrl);
    };

    const processUploads = useCallback(async (fieldId: string, newUploads: UploadItem[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !formId) return;

        let currentSubmissionId = submission?.id;
        if (!currentSubmissionId) {
            try {
                const newId = await saveOrSubmitSubmission({ formId, userId: user.id, answers: {}, mode: 'draft' });
                setSubmission(prev => ({ ...(prev as UserSubmission), id: newId, status: 'started' }));
                currentSubmissionId = newId;
            } catch (e) {
                setUploads(prev => ({
                    ...prev,
                    [fieldId]: newUploads.map(u => ({...u, status: 'error', error: 'Could not create a draft to save files.'}))
                }));
                return;
            }
        }
        
        for (const uploadItem of newUploads) {
            setUploads(prev => ({
                ...prev,
                [fieldId]: prev[fieldId].map(u => u.id === uploadItem.id ? {...u, status: 'uploading'} : u)
            }));
            
            try {
                const newFileAnswer = await uploadAndLinkFile({
                    userId: user.id, formId, submissionId: currentSubmissionId, fieldKey: fieldId, file: uploadItem.file,
                    onProgress: (progress) => {
                        setUploads(prev => ({
                            ...prev,
                            [fieldId]: prev[fieldId].map(u => u.id === uploadItem.id ? {...u, progress} : u)
                        }));
                    }
                });

                setAnswers(prev => ({...prev, [fieldId]: [...((prev[fieldId] || []) as FileAnswerItem[]), newFileAnswer]}));
                setUploads(prev => ({
                    ...prev,
                    [fieldId]: prev[fieldId].map(u => u.id === uploadItem.id ? {...u, status: 'success'} : u)
                }));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                setUploads(prev => ({
                    ...prev,
                    [fieldId]: prev[fieldId].map(u => u.id === uploadItem.id ? {...u, status: 'error', error: message} : u)
                }));
            }
        }
    }, [formId, submission]);

    const handleFilesSelected = (fieldId: string, files: FileList | null) => {
        if (!files || files.length === 0) return;
        
        const newUploads: UploadItem[] = Array.from(files).map(file => ({
            id: `${file.name}-${Date.now()}`,
            file,
            status: 'pending',
            progress: 0,
        }));

        setUploads(prev => ({...prev, [fieldId]: [...(prev[fieldId] || []), ...newUploads]}));
        processUploads(fieldId, newUploads);
    };

    const handleRetryUpload = (fieldId: string, uploadId: string) => {
        const uploadItem = uploads[fieldId]?.find(u => u.id === uploadId);
        if (uploadItem) {
            processUploads(fieldId, [uploadItem]);
        }
    };
    
    const handleRemoveFile = async (fieldId: string, fileId: string) => {
        const answer = answers[fieldId];
        if (!Array.isArray(answer)) return;

        const fileToRemove = (answer as FileAnswerItem[]).find(f => f.fileId === fileId);
        if (!fileToRemove) return;

        try {
            await deleteFormFile(fileToRemove.fileId, fileToRemove.storageBucket, fileToRemove.storagePath);
            setAnswers(prev => {
                const prevAnswer = prev[fieldId];
                if (!Array.isArray(prevAnswer)) return prev; // Safety check
                return {
                    ...prev,
                    [fieldId]: (prevAnswer as FileAnswerItem[]).filter(f => f.fileId !== fileId)
                };
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message || "Failed to remove file.");
        }
    };

    const processSignatures = async (answersToProcess: Record<string, PreSubmissionAnswerValue>): Promise<FormAnswers> => {
        if (!schema || !formId) return answersToProcess as FormAnswers;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated for signature processing");

        const processedAnswers = { ...answersToProcess };

        const signatureFields = schema.sections.flatMap(s => s.fields).filter(f => f.type === 'signature');

        for (const field of signatureFields) {
            const answer = processedAnswers[field.id];
            if (typeof answer === 'string' && answer.startsWith('data:image/png;base64,')) {
                try {
                    processedAnswers[field.id] = await uploadSignature(
                        user.id,
                        formId,
                        field.id,
                        answer
                    );
                } catch (err) {
                    console.error("Failed to upload signature during submission process", err);
                    throw new Error(`Failed to save signature for field "${field.label}". Please try again.`);
                }
            }
        }
        return processedAnswers as FormAnswers;
    };


    const handleSave = async () => {
        if (!formId) return;
    
        // FIX: Explicitly type `uploadList` to fix "Property 'some' does not exist on type 'unknown'" error.
        if (Object.values(uploads).some((uploadList: UploadItem[]) => uploadList.some(u => u.status === 'uploading'))) {
            setError("Please wait for all uploads to finish before saving.");
            return;
        }
    
        setIsSaving(true);
        setSaveSuccessMessage(null);
        setError(null);
    
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");
    
            const processedAnswers = await processSignatures(answers);

            const finalAnswers: FormAnswers = {};
            for (const fieldId in processedAnswers) {
                if (schema?.sections.flatMap(s => s.fields).find(f => f.id === fieldId)?.type !== 'file') {
                    finalAnswers[fieldId] = processedAnswers[fieldId] as FormAnswerValue;
                }
            }
    
            const newSubmissionId = await saveOrSubmitSubmission({
                formId,
                userId: user.id,
                answers: finalAnswers,
                submissionId: submission?.id,
                mode: 'draft',
            });
    
            if (!submission && newSubmissionId) {
                setSubmission(prev => ({ ...(prev || {} as UserSubmission), id: newSubmissionId, status: 'started' }));
            }
    
            setSaveSuccessMessage("Progress saved!");
            setTimeout(() => setSaveSuccessMessage(null), 3000);
        } catch(e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schema) return;

        const errors: Record<string, string> = {};
        schema.sections.forEach(section => {
            section.fields.forEach(field => {
                if (field.required) {
                    const answer = answers[field.id];
                    if (answer === null || answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
                        errors[field.id] = `${field.label} is required.`;
                    }
                }
            });
        });

        setValidationErrors(errors);
        if (Object.keys(errors).length > 0) {
            return;
        }

        // FIX: Explicitly type `uploadList` to fix "Property 'some' does not exist on type 'unknown'" error.
        if (Object.values(uploads).some((uploadList: UploadItem[]) => uploadList.some(u => u.status === 'uploading'))) {
            setError("Please wait for all uploads to complete before submitting.");
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !formId) throw new Error("Not authenticated");

            const processedAnswers = await processSignatures(answers);

            const finalAnswers: FormAnswers = {};
            for (const fieldId in processedAnswers) {
                if (schema?.sections.flatMap(s => s.fields).find(f => f.id === fieldId)?.type !== 'file') {
                    finalAnswers[fieldId] = processedAnswers[fieldId] as FormAnswerValue;
                }
            }

            await saveOrSubmitSubmission({
                formId,
                userId: user.id,
                answers: finalAnswers,
                submissionId: submission?.id,
                mode: 'submit',
            });

            navigate('/forms');

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message || "An error occurred during submission.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading form...</div>;
    if (error && !isSubmitting) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg">{error}</div>;
    if (!schema) return <div className="p-8 text-center">Form could not be loaded.</div>;

    return (
        <div className="animate-fade-in space-y-6">
            <Link to="/forms" className="text-sm text-secondary hover:underline">&larr; Back to My Forms</Link>
            
            <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100">
                <h1 className="text-2xl font-bold text-primary mb-2">{schema.title}</h1>
                {schema.description && <RichTextViewer html={schema.description} className="text-gray-600 mb-4"/>}

                {isReadOnly ? (
                    <div>
                        {submission?.review_status === 'approved' && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">This form has been completed and approved.</div>}
                        {submission?.review_status === 'pending' && <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-md text-sm">Your submission is awaiting review.</div>}

                        {schema.sections.map(section => (
                            <div key={section.id} className="mb-6">
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
                                        
                                        return (
                                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 py-4">
                                                <div className="text-sm font-medium text-gray-600 col-span-1">{field.label}</div>
                                                <div className="text-sm text-gray-900 col-span-2">{renderAnswerReadOnly(field, answers[field.id])}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {submission?.review_status === 'rejected' && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <h3 className="font-bold text-red-800">This submission was rejected</h3>
                                {submission.rejection_reason && <p className="mt-1 text-sm text-red-700"><strong>Reason:</strong> {submission.rejection_reason}</p>}
                            </div>
                        )}
                        {schema.sections.map(section => (
                            <div key={section.id}>
                                {section.title && <h2 className="text-xl font-semibold text-primary border-b pb-2 mb-4">{section.title}</h2>}
                                <div className="space-y-4">
                                    {section.fields.map(field => {
                                        const fieldError = validationErrors[field.id];
                                        const commonInputClasses = "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary focus:outline-none shadow-sm transition-all duration-150 disabled:bg-gray-100 placeholder:text-gray-400";
                                        const fieldAnswer = answers[field.id];

                                        const renderField = () => {
                                            switch(field.type) {
                                                case 'short_text': return <input type="text" id={field.id} value={fieldAnswer as string || ''} onChange={e => handleAnswerChange(field.id, e.target.value)} className={commonInputClasses} placeholder={field.placeholder || ''} maxLength={field.maxLength || undefined} />;
                                                case 'long_text': return <textarea id={field.id} value={fieldAnswer as string || ''} onChange={e => handleAnswerChange(field.id, e.target.value)} className={commonInputClasses} placeholder={field.placeholder || ''} rows={4} maxLength={field.maxLength || undefined} />;
                                                case 'dropdown': return <select id={field.id} value={fieldAnswer as string || ''} onChange={e => handleAnswerChange(field.id, e.target.value)} className={commonInputClasses}><option value="">Select...</option>{field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>;
                                                case 'checkbox': return <label className="flex items-center"><input type="checkbox" id={field.id} checked={!!fieldAnswer} onChange={e => handleAnswerChange(field.id, e.target.checked)} className="h-4 w-4 text-accent border-gray-300 rounded" /><span className="ml-2 text-sm text-gray-700">{field.label}</span></label>;
                                                case 'checkbox_group': return <div className="space-y-2">{field.options?.map(opt => (<label key={opt.value} className="flex items-center"><input type="checkbox" checked={(fieldAnswer as string[] || []).includes(opt.value)} onChange={e => { const newSelection = e.target.checked ? [...(fieldAnswer as string[] || []), opt.value] : (fieldAnswer as string[] || []).filter(v => v !== opt.value); handleAnswerChange(field.id, newSelection); }} className="h-4 w-4 text-accent border-gray-300 rounded" /><span className="ml-2 text-sm text-gray-700">{opt.label}</span></label>))}</div>;
                                                case 'date': return <input type="date" id={field.id} value={fieldAnswer as string || ''} onChange={e => handleAnswerChange(field.id, e.target.value)} className={commonInputClasses} />;
                                                case 'signature': return <><SignaturePad onChange={(dataUrl) => handleSignatureChange(field.id, dataUrl)} disabled={isSubmitting} /></>;
                                                case 'file': return (
                                                    <div>
                                                        <input type="file" id={field.id} onChange={e => handleFilesSelected(field.id, e.target.files)} className={commonInputClasses} multiple={field.allowMultiple} />
                                                        {(uploads[field.id] || []).map(item => (
                                                          <div key={item.id} className="mt-2 text-xs">
                                                            <span>{item.file.name}</span>
                                                            {item.status === 'uploading' && <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${item.progress}%`}}></div></div>}
                                                            {item.status === 'error' && <div className="text-red-500">{item.error} <button type="button" onClick={() => handleRetryUpload(field.id, item.id)} className="text-blue-500 underline">Retry</button></div>}
                                                            {item.status === 'success' && <span className="text-green-500 ml-2">✓</span>}
                                                          </div>
                                                        ))}
                                                        <div className="mt-2 space-y-1">
                                                        {(answers[field.id] as FileAnswerItem[] || []).map(file => (
                                                            <div key={file.fileId} className="flex items-center justify-between text-sm p-1 bg-gray-50 rounded">
                                                                <span>{file.fileName}</span>
                                                                <button type="button" onClick={() => handleRemoveFile(field.id, file.fileId)} className="text-red-500 text-xs">Remove</button>
                                                            </div>
                                                        ))}
                                                        </div>
                                                    </div>
                                                );
                                                case 'static_text': return <RichTextViewer html={field.helpText || ''} />;
                                                case 'image': return field.imageUrl ? <img src={field.imageUrl} alt={field.imageAlt || ''} className="max-w-full rounded-md border" /> : null;
                                                case 'divider': return <hr className="my-4" />;
                                                default: return null;
                                            }
                                        };
                                        return (
                                            <div key={field.id}>
                                                {field.type !== 'checkbox' && field.type !== 'divider' && <label htmlFor={field.id} className="block text-sm font-medium text-gray-700">{field.label}{field.required && <span className="text-red-500">*</span>}</label>}
                                                {field.helpText && field.type !== 'static_text' && <RichTextViewer html={field.helpText} className="text-xs !text-gray-500 mb-1" />}
                                                {renderField()}
                                                {fieldError && <p className="text-red-600 text-xs mt-1">{fieldError}</p>}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                        {error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm">{error}</div>}
                        <div className="flex justify-end items-center pt-4 border-t gap-3">
                            {saveSuccessMessage && <span className="text-sm text-green-600">{saveSuccessMessage}</span>}
                            <button
                                type="button"
                                onClick={handleSave}
                                // FIX: Explicitly type `uploadList` to fix "Property 'some' does not exist on type 'unknown'" error.
                                disabled={isSaving || isSubmitting || Object.values(uploads).some((uploadList: UploadItem[]) => uploadList.some(u => u.status === 'uploading'))}
                                className="px-6 py-2 bg-white text-secondary border border-secondary font-semibold rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            {/* FIX: Explicitly type `uploadList` to fix "Property 'some' does not exist on type 'unknown'" error. */}
                            <button type="submit" disabled={isSubmitting || isSaving || Object.values(uploads).some((uploadList: UploadItem[]) => uploadList.some(u => u.status === 'uploading'))} className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 disabled:bg-gray-400">
                                {isSubmitting ? 'Submitting...' : submission ? 'Resubmit Form' : 'Submit Form'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
