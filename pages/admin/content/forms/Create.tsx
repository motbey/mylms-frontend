import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { FormSchema, FormSection, BaseFormField, FormFieldType, FormFieldOption } from '../../../../src/types/forms';
import { createForm, getFormById, updateForm } from '../../../../src/services/forms';
import { supabase } from '../../../../lib/supabaseClient';
import { listAssignmentsForForm, createFormAssignment, deleteFormAssignment, DbFormAssignment, FormAssignmentTargetType } from '../../../../src/services/formAssignments';
import { listGroups, DbGroup } from '../../../../src/services/groups';
import { useUsersListing } from '../../../../src/hooks/useUsersListing';
import RichTextEditor from '../../../../src/components/RichTextEditor';
import ImageEditModal from '../../../../src/components/ImageEditModal';
import type { ImageEditResult } from '../../../../src/components/ImageEditModal';
import {
  Type,
  AlignLeft,
  List,
  ListChecks,
  CheckSquare,
  Calendar,
  Upload,
  PenTool,
  FileText,
  ImageIcon,
  Minus
} from 'lucide-react';


const defaultFormSchema: FormSchema = {
  title: 'New Form', // Title inside the schema, can be edited later
  description: '',
  category: undefined,
  version: 1,
  settings: {
    allowDrafts: true,
    allowMultipleSubmissions: false,
    requiresValidation: true,
    showSubmissionToUser: true,
  },
  sections: [
    {
      id: `section_${Date.now()}`,
      title: '',
      description: '',
      fields: [],
    },
  ],
};

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

function generateFieldId() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultField(type: FormFieldType): BaseFormField {
  const base: BaseFormField = {
    id: generateFieldId(),
    type,
    label: '',
    helpText: '',
    required: false,
    placeholder: '',
    maxLength: null,
    options: null,
    defaultValue: null,
    validation: {},
    layout: { width: 'full', order: 0 },
    visibilityConditions: [],
    visibleToRoles: undefined,
    readOnly: false,
    showInSummary: true,
    includeInPdf: true,
    pdfLabel: undefined,
  };

  switch (type) {
    case 'short_text':
      return { ...base, label: 'Short text', placeholder: 'Enter text' };
    case 'long_text':
      return { ...base, label: 'Long answer', placeholder: 'Enter detailed response' };
    case 'dropdown':
      return {
        ...base,
        label: 'Dropdown',
        options: [
          { value: 'option_1', label: 'Option 1' },
          { value: 'option_2', label: 'Option 2' },
        ],
      };
    case 'checkbox_group':
      return {
        ...base,
        label: 'Checkbox group',
        options: [
          { value: 'option_1', label: 'Option 1' },
          { value: 'option_2', label: 'Option 2' },
        ],
      };
    case 'checkbox':
      return { ...base, label: 'Checkbox', defaultValue: false };
    case 'date':
      return { ...base, label: 'Date' };
    case 'file':
      return { ...base, label: 'File upload' };
    case 'signature':
      return { ...base, label: 'Signature' };
    case 'static_text':
      return { ...base, label: 'Information text', readOnly: true };
    case 'image':
      return {
        ...base,
        label: 'Image',
        imageUrl: '',
        imageAlt: '',
        imageCaption: '',
      };
    case 'divider':
      return {
        ...base,
        type: 'divider',
        label: '',
        helpText: '',
        dividerStyle: 'solid',
        dividerColor: '#E5E7EB', // Tailwind gray-200
        dividerThickness: 1,
        dividerMarginTop: 8,
        dividerMarginBottom: 8,
      };
    default:
      return base;
  }
}

function slugifyOptionValue(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '') // remove weird chars
    .replace(/\s+/g, '_') || 'option';
}

const getFieldOptions = (field: BaseFormField): FormFieldOption[] => {
  return Array.isArray(field.options) ? field.options : [];
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

const paletteFields: { type: FormFieldType; label: string }[] = [
    { type: 'short_text', label: 'Short Text' },
    { type: 'long_text', label: 'Long Answer' },
    { type: 'dropdown', label: 'Dropdown' },
    { type: 'checkbox_group', label: 'Checkbox Group' },
    { type: 'checkbox', label: 'Single Checkbox' },
    { type: 'date', label: 'Date' },
    { type: 'file', label: 'File Upload' },
    { type: 'signature', label: 'Signature' },
    { type: 'static_text', label: 'Static Text' },
    { type: 'image', label: 'Image' },
    { type: 'divider', label: 'Divider' },
];

const fieldIcons: Record<FormFieldType, React.ElementType> = {
  short_text: Type,
  long_text: AlignLeft,
  dropdown: List,
  checkbox_group: ListChecks,
  checkbox: CheckSquare,
  date: Calendar,
  file: Upload,
  signature: PenTool,
  static_text: FileText,
  image: ImageIcon,
  divider: Minus,
  // Add other types if necessary
  radio: List,
  number: Type,
  rating: Type,
  group: Type,
};

// --- Temporary Debug Panel for Diagnostics ---
const DebugInfoPanel: React.FC<{ info: any; onClose: () => void }> = ({ info, onClose }) => {
    if (!info) return null;
  
    return (
      <div className="fixed bottom-4 right-4 z-[100] bg-gray-800 text-white p-4 rounded-lg shadow-2xl w-full max-w-lg border border-yellow-400">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-lg text-yellow-400">{info.title || 'Debug Info'}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <pre className="text-xs bg-gray-900 p-3 rounded overflow-auto max-h-60">
          {JSON.stringify(info.data, null, 2)}
        </pre>
      </div>
    );
};

const CreateFormPage: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const [formName, setFormName] = useState<string>('New Form');
  const [formSchema, setFormSchema] = useState<FormSchema>(defaultFormSchema);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [assignments, setAssignments] = useState<DbFormAssignment[]>([]);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState<boolean>(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetType, setAssignTargetType] = useState<FormAssignmentTargetType>('user');
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignGroupId, setAssignGroupId] = useState<string | null>(null);
  const [assignIsDynamic, setAssignIsDynamic] = useState<boolean>(false);
  const [assignDueDate, setAssignDueDate] = useState<string | null>(null);

  const { rows: users, loading: isUsersLoading } = useUsersListing(1000); // Fetch up to 1000 users for dropdown
  const [groups, setGroups] = useState<DbGroup[]>([]);
  const [isGroupsLoading, setIsGroupsLoading] = useState<boolean>(false);

  // State for delete confirmation modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<DbFormAssignment | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);
  
  // State for section delete confirmation modal
  const [isDeleteSectionModalOpen, setIsDeleteSectionModalOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<FormSection | null>(null);

  // State for form delete confirmation modal
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const openPreview = () => setIsPreviewOpen(true);
  const closePreview = () => setIsPreviewOpen(false);
  
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fieldToUploadFor, setFieldToUploadFor] = useState<{ fieldId: string; sectionId: string } | null>(null);
  const [uploadState, setUploadState] = useState<{
    fieldId: string | null;
    status: 'idle' | 'uploading' | 'error';
    error?: string | null;
  }>({ fieldId: null, status: 'idle', error: null });

  // State for image editing modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<{ fieldId: string; sectionId: string; imageUrl: string } | null>(null);
  
  // State to track upload status for edited images
  const [editingUploadState, setEditingUploadState] = useState<Record<string, { status: 'uploading' | 'error', error?: string }>>({});


  // --- Temporary state for diagnostics ---
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };


  // Get current user for create mode
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userId = data?.user?.id ?? null;
      setCurrentUserId(userId);
    });
  }, []);

  // In Edit mode, load the form from Supabase
  useEffect(() => {
    const loadForm = async () => {
      if (!formId) {
        setToast({ message: "Form ID is missing, returning to list.", type: "error" });
        navigate('/admin/content/forms');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const existing = await getFormById(formId);
        if (!existing) {
          setError('Form not found.');
          return;
        }

        setFormName(existing.name);
        
        // --- NEW LOGIC for robust schema loading ---
        const fetchedSchema = existing.schema || {};
        const finalSchema = {
          ...defaultFormSchema,
          ...fetchedSchema,
        };

        // Ensure sections is a valid array, and has at least one section for new forms.
        if (!Array.isArray(finalSchema.sections) || finalSchema.sections.length === 0) {
          finalSchema.sections = defaultFormSchema.sections;
        }
        setFormSchema(finalSchema);
        // --- END NEW LOGIC ---

      } catch (err: any) {
        console.error('Error loading form', err);
        setError('Failed to load form. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadForm();
  }, [formId, navigate]);

  // Load groups for modal
  useEffect(() => {
    const loadGroups = async () => {
      try {
        setIsGroupsLoading(true);
        const result = await listGroups();
        setGroups(result);
      } catch (err) {
        console.error('Error loading groups', err);
      } finally {
        setIsGroupsLoading(false);
      }
    };
    loadGroups();
  }, []);

  // Load assignments when formId is present
  const loadAssignments = async () => {
    if (!formId) return;
    try {
      setIsAssignmentsLoading(true);
      setAssignmentsError(null);
      const result = await listAssignmentsForForm(formId);
      setAssignments(result);
    } catch (err: any) {
      console.error('Error loading assignments', err);
      setAssignmentsError('Failed to load assignments.');
    } finally {
      setIsAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    if (formId) {
      loadAssignments();
    }
  }, [formId]);

  const handleAddField = (sectionId: string, type: FormFieldType) => {
    setFormSchema((prev) => {
      if (!prev) return prev;
      const newField = createDefaultField(type);
      const sections = prev.sections.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            fields: [...section.fields, newField]
          };
        }
        return section;
      });
      return { ...prev, sections };
    });
  };
  
  const handleUpdateField = (sectionId: string, fieldId: string, updates: Partial<BaseFormField>) => {
    setFormSchema((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map((section) => {
        if (section.id !== sectionId) return section;
  
        return {
          ...section,
          fields: section.fields.map((field) =>
            field.id === fieldId ? { ...field, ...updates } : field
          ),
        };
      });
  
      return { ...prev, sections };
    });
  };
  
  const handleRemoveField = (sectionId: string, fieldId: string) => {
    setFormSchema((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.map((section) => {
        if (section.id !== sectionId) return section;
  
        return {
          ...section,
          fields: section.fields.filter((field) => field.id !== fieldId),
        };
      });
  
      return { ...prev, sections };
    });
  };
  
  const handleMoveField = (
    sectionId: string,
    fieldId: string,
    direction: 'up' | 'down'
  ) => {
    setFormSchema((prev) => {
      if (!prev) return prev;
  
      const sections = prev.sections.map((section) => {
        if (section.id !== sectionId) return section;
  
        const index = section.fields.findIndex((f) => f.id === fieldId);
        if (index === -1) return section;
  
        const newIndex = direction === 'up' ? index - 1 : index + 1;
  
        // out of bounds: do nothing
        if (newIndex < 0 || newIndex >= section.fields.length) {
          return section;
        }
  
        const newFields = [...section.fields];
        const [moved] = newFields.splice(index, 1);
        newFields.splice(newIndex, 0, moved);
  
        return {
          ...section,
          fields: newFields,
        };
      });
  
      return {
        ...prev,
        sections,
      };
    });
  };

  const handleMoveFieldToSection = (
    fieldId: string,
    fromSectionId: string,
    toSectionId: string
  ) => {
    if (fromSectionId === toSectionId) return;
  
    setFormSchema((prev) => {
      if (!prev) return prev;
  
      const sections = [...prev.sections];
  
      const fromIndex = sections.findIndex((s) => s.id === fromSectionId);
      const toIndex = sections.findIndex((s) => s.id === toSectionId);
  
      if (fromIndex === -1 || toIndex === -1) {
        return prev;
      }
  
      const fromSection = sections[fromIndex];
      const toSection = sections[toIndex];
  
      const fieldIndex = fromSection.fields.findIndex((f) => f.id === fieldId);
      if (fieldIndex === -1) {
        return prev;
      }
  
      const newFromFields = [...fromSection.fields];
      const [movedField] = newFromFields.splice(fieldIndex, 1);
  
      const newToFields = [...toSection.fields, movedField];
  
      sections[fromIndex] = {
        ...fromSection,
        fields: newFromFields,
      };
  
      sections[toIndex] = {
        ...toSection,
        fields: newToFields,
      };
  
      return {
        ...prev,
        sections,
      };
    });
  };

  const handleUpdateSectionTitle = (sectionId: string, title: string) => {
    setFormSchema((prev) => {
      if (!prev) return prev;
  
      const sections = prev.sections.map((section) =>
        section.id === sectionId ? { ...section, title } : section
      );
  
      return { ...prev, sections };
    });
  };
  
  const handleAddSection = () => {
    setFormSchema((prev) => {
      if (!prev) return prev;
  
      const newSectionId = crypto.randomUUID?.() ?? `section_${Date.now()}`;
      const newSection: FormSection = {
        id: newSectionId,
        title: '',
        fields: [],
      };
  
      return {
        ...prev,
        sections: [...prev.sections, newSection],
      };
    });
  };

  const handleMoveSection = (sectionId: string, direction: 'up' | 'down') => {
    setFormSchema((prev) => {
      if (!prev) return prev;
  
      const index = prev.sections.findIndex((s) => s.id === sectionId);
      if (index === -1) return prev;
  
      const newIndex = direction === 'up' ? index - 1 : index + 1;
  
      if (newIndex < 0 || newIndex >= prev.sections.length) {
        return prev; // out of bounds, no change
      }
  
      const newSections = [...prev.sections];
      const [moved] = newSections.splice(index, 1);
      newSections.splice(newIndex, 0, moved);
  
      return {
        ...prev,
        sections: newSections,
      };
    });
  };

  const handleRemoveSectionClick = (sectionId: string) => {
    if (!formSchema) return;

    if (formSchema.sections.length <= 1) {
      setToast({
        message: 'You must have at least one section in the form. This section cannot be deleted.',
        type: 'error',
      });
      return;
    }

    const section = formSchema.sections.find((s) => s.id === sectionId);
    if (section) {
      setSectionToDelete(section);
      setIsDeleteSectionModalOpen(true);
    }
  };

  const handleConfirmDeleteSection = () => {
    if (!sectionToDelete) return;

    setFormSchema((prev) => {
      if (!prev) return prev;
      const newSections = prev.sections.filter((s) => s.id !== sectionToDelete.id);
      return { ...prev, sections: newSections };
    });

    setIsDeleteSectionModalOpen(false);
    setSectionToDelete(null);
    setToast({ message: 'Section deleted successfully.', type: 'success' });
  };

  const handleCancelDeleteSection = () => {
      setIsDeleteSectionModalOpen(false);
      setSectionToDelete(null);
  }

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
  
    if (!destination) {
      return;
    }
  
    if (source.droppableId === 'field-palette' && destination.droppableId.startsWith('form-section-')) {
      const fieldType = draggableId.replace('palette-', '') as FormFieldType;
      const sectionId = destination.droppableId.replace('form-section-', '');
      if (fieldType && sectionId) {
        handleAddField(sectionId, fieldType);
      }
    }
    // Reordering logic will be added in a future step
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setToast({ message: 'Form name is required.', type: 'error' });
      return;
    }

    if (!formId) {
      setToast({ message: 'Form ID is missing.', type: 'error' });
      return;
    }
  
    try {
      setIsSaving(true);
      setToast(null);
  
      await updateForm(formId, {
        name: formName.trim(),
        schema: { ...formSchema, title: formName.trim() },
      });
      setToast({ message: 'Form updated successfully!', type: 'success' });
    } catch (err: any) {
      console.error('Error saving form', err);
      setToast({ message: err.message ?? 'Failed to save form.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = () => {
    setIsDeleteConfirmModalOpen(true);
    setDeleteConfirmInput('');
  };
  
  const closeDeleteModal = () => {
    setIsDeleteConfirmModalOpen(false);
  };
  
  const handleDeleteForm = async () => {
    if (!formId) {
        setToast({ message: 'Cannot delete form: Form ID is missing.', type: 'error' });
        return;
    }
    
    setIsDeleting(true);
    setToast(null);

    try {
        const { error } = await supabase.rpc('delete_form_and_assets', { p_form_id: formId });

        if (error) {
            throw error;
        }

        setToast({ message: 'Form deleted successfully.', type: 'success' });
        setTimeout(() => navigate('/admin/content/forms'), 1500);

    } catch (err: any) {
        console.error("Failed to delete form:", err);
        setToast({ message: `Failed to delete form: ${err.message}` || "An unknown error occurred during deletion.", type: 'error' });
        setIsDeleting(false);
        closeDeleteModal();
    }
  };

  const openAssignModal = () => {
    setAssignTargetType('user');
    setAssignUserId(null);
    setAssignGroupId(null);
    setAssignIsDynamic(false);
    setAssignDueDate(null);
    setAssignmentsError(null);
    setIsAssignModalOpen(true);
  };

  const closeAssignModal = () => setIsAssignModalOpen(false);

  const handleCreateAssignment = async () => {
    if (!formId || !currentUserId) {
      setAssignmentsError('You must be logged in as an admin to assign forms.');
      return;
    }

    try {
      setAssignmentsError(null);

      if (assignTargetType === 'user' && !assignUserId) {
        setAssignmentsError('Please select a user.');
        return;
      }

      if (assignTargetType === 'group' && !assignGroupId) {
        setAssignmentsError('Please select a group.');
        return;
      }

      const dueAtIso = assignDueDate ? new Date(assignDueDate).toISOString() : null;

      await createFormAssignment({
        formId,
        targetType: assignTargetType,
        targetId: assignTargetType === 'user' ? assignUserId : assignTargetType === 'group' ? assignGroupId : null,
        isDynamic: assignTargetType === 'group' ? assignIsDynamic : false,
        dueAt: dueAtIso,
        createdBy: currentUserId,
      });

      closeAssignModal();
      await loadAssignments();
      setToast({ message: 'Form assigned successfully.', type: 'success' });
    } catch (err: any) {
      console.error('Error creating assignment', err);
      setAssignmentsError(err.message ?? 'Failed to create assignment.');
    }
  };

  const openDeleteAssignmentModal = (assignment: DbFormAssignment) => {
    setAssignmentToDelete(assignment);
    setDeleteConfirmText('');
    setIsDeleteModalOpen(true);
  };
  
  const closeDeleteAssignmentModal = () => {
    setIsDeleteModalOpen(false);
    setAssignmentToDelete(null);
    setDeleteConfirmText('');
  };

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
  
    try {
      setIsDeletingAssignment(true);
      setAssignmentsError(null);
  
      await deleteFormAssignment(assignmentToDelete.id);
      await loadAssignments();
      setToast({ message: 'Assignment removed.', type: 'success' });
      closeDeleteAssignmentModal();
    } catch (err: any) {
      console.error('Error deleting assignment', err);
      setAssignmentsError(err.message ?? 'Failed to remove assignment.');
    } finally {
      setIsDeletingAssignment(false);
    }
  };

  const getAssignmentTargetLabel = (assignment: DbFormAssignment): string => {
    if (assignment.target_type === 'all') return 'All users';
    if (assignment.target_type === 'user') {
      const user = users?.find((u) => u.user_id === assignment.target_id);
      if (user) {
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'User';
        return `User: ${name}`;
      }
      return `User ID: ${assignment.target_id}`;
    }
    if (assignment.target_type === 'group') {
      const group = groups.find((g) => g.id === assignment.target_id);
      if (group) return `Group: ${group.name}`;
      return `Group ID: ${assignment.target_id}`;
    }
    return 'Unknown';
  };

  const handleImageUploadTrigger = (fieldId: string, sectionId: string) => {
    setFieldToUploadFor({ fieldId, sectionId });
    fileInputRef.current?.click();
  };

  const sanitizeFileName = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, '_').substring(0, 100);
  };

  const uploadImageForField = async (fieldId: string, sectionId: string, file: File) => {
      if (!formId || !currentUserId) {
          setUploadState({ fieldId, status: 'error', error: 'Form ID or User ID is missing.' });
          return;
      }
  
      setUploadState({ fieldId, status: 'uploading', error: null });
  
      try {
          const safeFileName = sanitizeFileName(file.name);
          const filePath = `images/admin/${currentUserId}/forms/${formId}/images/${Date.now()}-${safeFileName}`;
  
          const { error: uploadError } = await supabase.storage
              .from('form-images')
              .upload(filePath, file);
          
          if (uploadError) throw uploadError;
  
          const { data: { publicUrl } } = supabase.storage.from('form-images').getPublicUrl(filePath);
  
          if (!publicUrl) throw new Error("Could not get public URL after upload.");
  
          handleUpdateField(sectionId, fieldId, { imageUrl: publicUrl });
          setUploadState({ fieldId: null, status: 'idle', error: null });
          setToast({ message: "Image uploaded successfully.", type: 'success' });
      } catch (err: any) {
          console.error("Image upload failed:", err);
          setUploadState({ fieldId, status: 'error', error: err.message || 'Upload failed.' });
      }
  };

  const handleFileSelectedForUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && fieldToUploadFor) {
        const { fieldId, sectionId } = fieldToUploadFor;
        const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            setUploadState({ fieldId, status: 'error', error: 'Invalid file type. Please use PNG, JPG, GIF, or SVG.' });
            return;
        }
        uploadImageForField(fieldId, sectionId, file);
    }
    if (event.target) event.target.value = '';
  };
  
  const handleRemoveImage = async (field: BaseFormField, sectionId: string) => {
    const imageUrl = field.imageUrl;
    if (!imageUrl) return;

    // Clear UI first for responsiveness
    handleUpdateField(sectionId, field.id, { imageUrl: null });

    try {
        const url = new URL(imageUrl);
        const path = decodeURIComponent(url.pathname.split('/form-images/')[1]);
        if (!path) return;

        const { error: removeError } = await supabase.storage.from('form-images').remove([path]);
        if (removeError) throw removeError;
        setToast({ message: "Image removed from storage.", type: 'success'});
    } catch (err: any) {
        console.error("Could not remove image from storage:", err.message);
        // UI is already updated, so we just log the error. The URL field is now clear.
    }
  };

  const handleImageEditConfirm = async (result: ImageEditResult) => {
    if (!editingImage || !formId || !currentUserId) {
      setToast({ message: 'Cannot save image: missing form or user context.', type: 'error' });
      return;
    }
  
    const { fieldId, sectionId, imageUrl: originalUrl } = editingImage;
    const previousImageUrl = originalUrl; // Capture the old URL before any changes
  
    setEditingUploadState((prev) => ({ ...prev, [fieldId]: { status: 'uploading' } }));
    setIsEditModalOpen(false);
    setEditingImage(null);
  
    try {
      const { blob, meta } = result;
  
      // --- Upload new image ---
      const url = new URL(originalUrl);
      const pathParts = url.pathname.split('/');
      const originalFilename = pathParts[pathParts.length - 1];
      const baseName = decodeURIComponent(originalFilename).replace(/(-w\d+)?\.\w+$/i, '') || 'image';
      const fileExt = meta.format;
      const newImagePath = `images/admin/${currentUserId}/forms/${formId}/images/${Date.now()}-${baseName}-edited.${fileExt}`;
  
      const { error: uploadError } = await supabase.storage
        .from('form-images')
        .upload(newImagePath, blob, {
          upsert: false,
          contentType: meta.format === 'png' ? 'image/png' : 'image/webp',
          cacheControl: '31536000',
        });
  
      if (uploadError) throw uploadError;
  
      const { data } = supabase.storage.from('form-images').getPublicUrl(newImagePath);
      const newPublicUrl = data.publicUrl;
  
      // --- Update database record ---
      const currentSchema = formSchema;
      const newSections = currentSchema.sections.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          fields: section.fields.map((field) =>
            field.id === fieldId ? { ...field, imageUrl: newPublicUrl } : field
          ),
        };
      });
      const newSchema = { ...currentSchema, sections: newSections };
  
      const { error: updateError } = await supabase
        .from('forms')
        .update({ schema: newSchema })
        .eq('id', formId);
  
      if (updateError) throw updateError;
  
      // --- Cleanup old edited image (if applicable) ---
      if (
        previousImageUrl &&
        previousImageUrl !== newPublicUrl &&
        previousImageUrl.includes('-edited')
      ) {
        try {
          const oldUrl = new URL(previousImageUrl);
          const previousStoragePath = decodeURIComponent(oldUrl.pathname.split(`/form-images/`)[1]);
          if (previousStoragePath) {
            const { error: deleteError } = await supabase.storage
              .from('form-images')
              .remove([previousStoragePath]);
            if (deleteError) {
              console.error('Failed to delete old edited image:', deleteError);
            } else {
              console.log('Deleted old edited image:', previousStoragePath);
            }
          }
        } catch (e) {
          console.error('Error during cleanup of old image:', e);
        }
      }
  
      // --- Update local state and UI ---
      setFormSchema(newSchema);
      if (originalUrl.startsWith('blob:')) {
        URL.revokeObjectURL(originalUrl);
      }
      setToast({ message: 'Edited image uploaded successfully.', type: 'success' });
  
    } catch (err: any) {
      console.error('FULL IMAGE EDIT ERROR:', err);
      setToast({ message: `Image upload failed: ${err.message}`, type: 'error' });
      setEditingUploadState((prev) => ({ ...prev, [fieldId]: { status: 'error', error: err.message } }));
    } finally {
      setEditingUploadState((prev) => {
        const newState = { ...prev };
        if (newState[fieldId]?.status !== 'error') {
          delete newState[fieldId];
        }
        return newState;
      });
    }
  };

  const renderFieldTypeConfig = (field: BaseFormField, sectionId: string) => {
    if (field.type === 'dropdown' || field.type === 'checkbox_group') {
      const options = getFieldOptions(field);
  
      const handleOptionLabelChange = (index: number, newLabel: string) => {
        const current = options[index];
        const isAutoGenerated = !current.value || current.value === slugifyOptionValue(current.label || '');
        const newValue = isAutoGenerated ? slugifyOptionValue(newLabel) : current.value;
        const newOptions = options.map((opt, i) => (i === index ? { ...opt, label: newLabel, value: newValue } : opt));
        handleUpdateField(sectionId, field.id, { options: newOptions });
      };
  
      const handleAddOption = () => {
        const nextIndex = options.length + 1;
        const defaultLabel = `Option ${nextIndex}`;
        const newOption: FormFieldOption = {
          label: defaultLabel,
          value: slugifyOptionValue(defaultLabel),
        };
        handleUpdateField(sectionId, field.id, { options: [...options, newOption] });
      };
  
      const handleRemoveOption = (index: number) => {
        const newOptions = options.filter((_, i) => i !== index);
        handleUpdateField(sectionId, field.id, { options: newOptions });
      };
  
      return (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">
            {field.type === 'dropdown' ? 'Options' : 'Checkbox options'}
          </h4>
          {options.length === 0 && (
            <p className="text-xs text-gray-500 mb-2">
              {field.type === 'dropdown'
                ? 'No options yet. Add at least one option for this dropdown.'
                : 'No options yet. Add at least one checkbox option.'}
            </p>
          )}
          <div className="space-y-2">
            {options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => handleOptionLabelChange(index, e.target.value)}
                  placeholder="Please enter an item title"
                  className="flex-1 rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary"
                />
                <button type="button" onClick={() => handleRemoveOption(index)} className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={handleAddOption} className="mt-3 inline-flex items-center px-3 py-1.5 rounded-md border border-dashed border-gray-400 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50">+ Add option</button>
        </div>
      );
    }
  
    if (field.type === 'checkbox') {
      const isCheckedByDefault = Boolean(field.defaultValue);
      return (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Checkbox settings</h4>
          <label className="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isCheckedByDefault}
              onChange={(e) => handleUpdateField(sectionId, field.id, { defaultValue: e.target.checked })}
              className="h-4 w-4 text-accent border-gray-300 rounded mr-2"
            />
            Checked by default
          </label>
        </div>
      );
    }

    if (field.type === 'date') {
      const defaultMode = field.defaultValue === 'today' ? 'today' : 'none';
    
      const handleChangeDefaultMode = (mode: 'none' | 'today') => {
        handleUpdateField(sectionId, field.id, {
          defaultValue: mode === 'today' ? 'today' : null,
        });
      };
    
      return (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">
            Date settings
          </h4>
          <fieldset className="space-y-2 text-sm text-gray-700">
            <legend className="sr-only">Default value</legend>
            <div className="flex items-center">
              <input
                id={`date-default-none-${field.id}`}
                type="radio"
                name={`date-default-${field.id}`}
                checked={defaultMode === 'none'}
                onChange={() => handleChangeDefaultMode('none')}
                className="h-4 w-4 text-accent border-gray-300"
              />
              <label
                htmlFor={`date-default-none-${field.id}`}
                className="ml-2"
              >
                No default date
              </label>
            </div>
            <div className="flex items-center">
              <input
                id={`date-default-today-${field.id}`}
                type="radio"
                name={`date-default-${field.id}`}
                checked={defaultMode === 'today'}
                onChange={() => handleChangeDefaultMode('today')}
                className="h-4 w-4 text-accent border-gray-300"
              />
              <label
                htmlFor={`date-default-today-${field.id}`}
                className="ml-2"
              >
                Default to today
              </label>
            </div>
          </fieldset>
        </div>
      );
    }

    if (field.type === 'signature') {
      const includeInPdf =
        field.includeInPdf === undefined ? true : Boolean(field.includeInPdf);
    
      return (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">
            Signature settings
          </h4>
    
          <label className="flex items-center text-sm text-gray-700 mb-3">
            <input
              type="checkbox"
              checked={includeInPdf}
              onChange={(e) =>
                handleUpdateField(sectionId, field.id, { includeInPdf: e.target.checked })
              }
              className="h-4 w-4 text-accent border-gray-300 rounded mr-2"
            />
            Include signed image in PDF export
          </label>
    
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              PDF label (optional)
            </label>
            <input
              type="text"
              value={field.pdfLabel ?? ''}
              onChange={(e) =>
                handleUpdateField(sectionId, field.id, { pdfLabel: e.target.value })
              }
              placeholder="e.g. Learner signature, Manager signature"
              className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary"
            />
            <p className="mt-1 text-xs text-gray-500">
              If left blank, the field title will be used in PDF exports.
            </p>
          </div>
        </div>
      );
    }
    
    if (field.type === 'file') {
      const allowMultiple = Boolean(field.allowMultiple);
    
      return (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">
            File settings
          </h4>
    
          <label className="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) =>
                handleUpdateField(sectionId, field.id, { allowMultiple: e.target.checked })
              }
              className="h-4 w-4 text-accent border-gray-300 rounded mr-2"
            />
            Allow multiple files
          </label>
    
          <p className="mt-1 text-xs text-gray-500">
            When enabled, learners can select and upload more than one file.
          </p>
        </div>
      );
    }

    if (field.type === 'short_text' || field.type === 'long_text') {
      const isLong = field.type === 'long_text';
      const title = isLong ? 'Long answer settings' : 'Short text settings';
    
      const handlePlaceholderChange = (value: string) => {
        handleUpdateField(sectionId, field.id, { placeholder: value });
      };
    
      const handleMaxLengthChange = (value: string) => {
        const trimmed = value.trim();
        const parsed = trimmed === '' ? null : Number.parseInt(trimmed, 10);
        handleUpdateField(sectionId, field.id, {
          maxLength: Number.isFinite(parsed) && parsed! > 0 ? parsed : null,
        });
      };
    
      return (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-800 mb-3">{title}</h4>
    
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Placeholder text (optional)
            </label>
            <input
              type="text"
              value={field.placeholder ?? ''}
              onChange={(e) => handlePlaceholderChange(e.target.value)}
              placeholder={
                isLong
                  ? 'e.g. Provide detailed feedback here'
                  : 'e.g. Enter your full name'
              }
              className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary"
            />
          </div>
    
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Max length (characters, optional)
            </label>
            <input
              type="number"
              min={1}
              value={field.maxLength ?? ''}
              onChange={(e) => handleMaxLengthChange(e.target.value)}
              placeholder={isLong ? 'e.g. 1000' : 'e.g. 100'}
              className="block w-40 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary"
            />
            <p className="mt-1 text-xs text-gray-500">
              Leave blank for no limit.
            </p>
          </div>
        </div>
      );
    }

    if (field.type === 'image') {
        const isUploading = uploadState.fieldId === field.id && uploadState.status === 'uploading';
        const uploadError = uploadState.fieldId === field.id && uploadState.status === 'error' ? uploadState.error : null;
        const isEditingUploading = editingUploadState[field.id]?.status === 'uploading';
        const isWorkingOnImage = isUploading || isEditingUploading;

        return (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-800 mb-3">
              Image settings
            </h4>
      
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-gray-700">Image URL</label>
                  <div title={!formId ? 'You must save the form once to enable uploads.' : ''}>
                      <button 
                          type="button" 
                          onClick={() => handleImageUploadTrigger(field.id, sectionId)}
                          disabled={!formId || isWorkingOnImage}
                          className="text-xs font-medium text-secondary hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                      >
                          {field.imageUrl ? 'Replace image' : 'Upload image'}
                      </button>
                  </div>
              </div>
              <input
                type="text"
                value={field.imageUrl ?? ''}
                onChange={(e) => handleUpdateField(sectionId, field.id, { imageUrl: e.target.value })}
                placeholder="https://... or upload an image"
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary"
                disabled={isWorkingOnImage}
              />
            </div>

            {isUploading && <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2"><div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `100%` }}></div></div>}
            {uploadError && (
                <div className="p-2 mb-2 text-xs text-red-700 bg-red-100 rounded-md">
                    <p><strong>Error:</strong> {uploadError}</p>
                    <button type="button" onClick={() => handleImageUploadTrigger(field.id, sectionId)} className="font-semibold underline">Try again</button>
                </div>
            )}

            {field.imageUrl && (
                <div className="mb-3 p-2 border rounded-md bg-gray-50 flex items-start justify-between relative">
                    {isWorkingOnImage && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-md z-10">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <svg className="animate-spin h-5 w-5 text-secondary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Uploading...</span>
                            </div>
                        </div>
                    )}
                    <div>
                        <img src={field.imageUrl} alt={field.imageAlt || 'Preview'} className="max-w-xs max-h-48 rounded-md border" />
                        <button type="button" onClick={() => handleRemoveImage(field, sectionId)} disabled={isWorkingOnImage} className="mt-2 text-xs text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed">Remove image</button>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setEditingImage({ fieldId: field.id, sectionId, imageUrl: field.imageUrl! });
                            setIsEditModalOpen(true);
                        }}
                        disabled={isWorkingOnImage}
                        className="ml-4 px-3 py-1.5 text-xs font-medium text-secondary bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Edit
                    </button>
                </div>
            )}
      
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Alt text (optional)
              </label>
              <input type="text" value={field.imageAlt ?? ''} onChange={(e) => handleUpdateField(sectionId, field.id, { imageAlt: e.target.value })} placeholder="Short description for screen readers" className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary" />
            </div>
      
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Caption (optional)
              </label>
              <input type="text" value={field.imageCaption ?? ''} onChange={(e) => handleUpdateField(sectionId, field.id, { imageCaption: e.target.value })} placeholder="Text shown under the image" className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary" />
            </div>
          </div>
        );
      }

    if (field.type === 'divider') {
        const style = field.dividerStyle ?? 'solid';
        const color = field.dividerColor ?? '#E5E7EB';
        const thickness = field.dividerThickness ?? 1;
        const marginTop = field.dividerMarginTop ?? 8;
        const marginBottom = field.dividerMarginBottom ?? 8;
      
        const handleStyleChange = (value: 'solid' | 'dashed' | 'dotted') => {
          handleUpdateField(sectionId, field.id, { dividerStyle: value });
        };
      
        const handleColorChange = (value: string) => {
          handleUpdateField(sectionId, field.id, { dividerColor: value });
        };

        const handleThicknessChange = (value: string) => {
            const parsed = Number.parseInt(value, 10);
            handleUpdateField(sectionId, field.id, {
              dividerThickness: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
            });
        };
        
        const handleMarginTopChange = (value: string) => {
            const parsed = Number.parseInt(value, 10);
            handleUpdateField(sectionId, field.id, {
              dividerMarginTop: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
            });
        };
        
        const handleMarginBottomChange = (value: string) => {
            const parsed = Number.parseInt(value, 10);
            handleUpdateField(sectionId, field.id, {
              dividerMarginBottom: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
            });
        };
      
        return (
            <div className="mt-4 space-y-4">
              <h4 className="text-sm font-medium text-gray-800">
                Divider settings
              </h4>
        
              {/* Style */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Style
                </label>
                <select
                  value={style}
                  onChange={(e) =>
                    handleStyleChange(
                      e.target.value as 'solid' | 'dashed' | 'dotted'
                    )
                  }
                  className="block w-40 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary"
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </div>
        
              {/* Colour picker */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Colour
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary"
                    placeholder="#E5E7EB or CSS colour"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Use the colour picker or type a hex / CSS colour value.
                </p>
              </div>
        
              {/* Thickness */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Thickness
                </label>
                <select
                  value={thickness}
                  onChange={(e) => handleThicknessChange(e.target.value)}
                  className="block w-32 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary"
                >
                  <option value={1}>1px (thin)</option>
                  <option value={2}>2px (medium)</option>
                  <option value={3}>3px (thick)</option>
                </select>
              </div>
        
              {/* Margins */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Margin top (px)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={64}
                    value={marginTop}
                    onChange={(e) => handleMarginTopChange(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Margin bottom (px)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={64}
                    value={marginBottom}
                    onChange={(e) => handleMarginBottomChange(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>
            </div>
          );
    }

    return null;
  };
  
  const renderPreviewControl = (field: BaseFormField) => {
    const commonClasses =
      'block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm';
  
    switch (field.type) {
      case 'short_text': {
        const placeholder = field.placeholder ?? '';
        const maxLength =
          typeof field.maxLength === 'number' && field.maxLength > 0
            ? field.maxLength
            : undefined;

        return (
          <div className="relative">
            <input
              type="text"
              disabled
              placeholder={placeholder}
              maxLength={maxLength}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary focus:outline-none shadow-sm transition-all duration-150"
            />
            {maxLength && (
              <span className="absolute right-2 bottom-1 text-[11px] text-gray-400">
                0 / {maxLength}
              </span>
            )}
          </div>
        );
      }
      case 'long_text': {
        const placeholder = field.placeholder ?? '';
        const maxLength =
          typeof field.maxLength === 'number' && field.maxLength > 0
            ? field.maxLength
            : undefined;

        return (
          <div className="relative">
            <textarea
              disabled
              placeholder={placeholder}
              maxLength={maxLength}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary focus:outline-none shadow-sm transition-all duration-150 resize-none overflow-hidden"
              rows={3}
              onInput={(e) => {
                const target = e.currentTarget;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 250)}px`;
              }}
            />
            {maxLength && (
              <span className="absolute right-2 bottom-1 text-[11px] text-gray-400">
                0 / {maxLength}
              </span>
            )}
          </div>
        );
      }
      case 'dropdown': {
        const options =
          Array.isArray(field.options) && field.options.length > 0
            ? field.options
            : [{ value: '', label: 'Option 1' }];
  
        return (
          <select className={commonClasses} disabled>
            <option value="">Select…</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }
      case 'checkbox_group': {
        const options =
          Array.isArray(field.options) && field.options.length > 0
            ? field.options
            : [{ value: 'option_1', label: 'Option 1' }];
        return (
          <div className="space-y-1">
            {options.map((opt) => (
              <label key={opt.value} className="flex items-center text-sm text-gray-700">
                <input
                  type="checkbox"
                  disabled
                  className="h-4 w-4 text-accent border-gray-300 rounded mr-2"
                />
                {opt.label}
              </label>
            ))}
          </div>
        );
      }
      case 'checkbox': {
        const checked = Boolean(field.defaultValue);
        const hasHelpText =
          !!field.helpText && field.helpText.trim() !== '';
      
        return (
          <label className="flex items-center text-sm text-gray-700">
            <input
              type="checkbox"
              disabled
              checked={checked}
              className="h-4 w-4 text-accent border-gray-300 rounded mr-2"
            />
            {hasHelpText ? field.helpText : null}
          </label>
        );
      }
      case 'date': {
        let value = '';
      
        if (field.defaultValue === 'today') {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          value = `${year}-${month}-${day}`;
        }
      
        return (
          <input
            type="date"
            className={commonClasses}
            disabled
            value={value}
            onChange={() => {}}
          />
        );
      }
      case 'file': {
        const allowMultiple = Boolean(field.allowMultiple);
      
        return (
          <div className="space-y-1">
            <input
              type="file"
              className={commonClasses}
              disabled
              multiple={allowMultiple}
              onChange={() => {}}
            />
            {allowMultiple && (
              <p className="text-xs text-gray-500">
                Multiple files allowed
              </p>
            )}
          </div>
        );
      }
      case 'signature':
        return (
          <div className="border border-dashed border-gray-300 rounded-md h-24 flex flex-col items-center justify-center text-xs text-gray-500 bg-gray-50">
            <span>Signature pad preview</span>
            <span className="mt-1 text-[10px] text-gray-400">
              (Learners will sign here with mouse or touch)
            </span>
          </div>
        );
      case 'image': {
        const url = field.imageUrl?.trim();
        const alt = field.imageAlt?.trim() || field.label || 'Image';
        const caption = field.imageCaption?.trim();
      
        if (!url) {
          return (
            <div className="border border-dashed border-gray-300 rounded-md px-4 py-6 text-xs text-gray-500 bg-gray-50 text-center">
              Image preview
              <div className="mt-1 text-[11px] text-gray-400">
                (Set an image URL in the builder)
              </div>
            </div>
          );
        }
      
        return (
          <div className="space-y-1">
            <img
              src={url}
              alt={alt}
              className="max-w-full rounded-md border border-gray-200"
            />
            {caption && (
              <div className="text-xs text-gray-600 italic">{caption}</div>
            )}
          </div>
        );
      }
      case 'divider': {
        const style = field.dividerStyle ?? 'solid';
        const color = field.dividerColor ?? '#E5E7EB';
        const thickness = field.dividerThickness ?? 1;
        const marginTop = field.dividerMarginTop ?? 8;
        const marginBottom = field.dividerMarginBottom ?? 8;
      
        return (
          <div
            style={{
              marginTop,
              marginBottom,
            }}
          >
            <hr
              className="border-0"
              style={{
                borderTopWidth: `${thickness}px`,
                borderTopStyle: style,
                borderTopColor: color,
              }}
            />
          </div>
        );
      }
      default:
        return (
          <input
            type="text"
            className={commonClasses}
            disabled
          />
        );
    }
  };

  const pageTitle = 'Edit Form';
  const formControlClasses = "block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-offset-1 focus:ring-secondary disabled:bg-gray-100 placeholder:text-gray-400";

  return (
    <div className="animate-fade-in space-y-6">
      <input type="file" ref={fileInputRef} onChange={handleFileSelectedForUpload} accept="image/*" className="hidden" />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <DebugInfoPanel info={debugInfo} onClose={() => setDebugInfo(null)} />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link to="/admin/content/forms" className="text-sm text-secondary hover:underline">&larr; Back to Forms</Link>
          <h1 className="text-3xl font-bold text-primary mt-2">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          {formId && (
            <button
                type="button"
                onClick={openDeleteModal}
                disabled={isSaving || isLoading || isDeleting}
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-red-600 border border-red-500 shadow-sm transition-all duration-200 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                Delete Form
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading || isDeleting}
            className="inline-flex items-center justify-center rounded-xl bg-[#153AC7] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(21,58,199,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0f2da0] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Form'}
          </button>
        </div>
      </div>
      
      {isLoading && <div className="text-center p-8">Loading form...</div>}
      {error && <div className="text-center p-8 text-red-600">{error}</div>}

      {!isLoading && !error && formSchema && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Panel: Settings and Structure */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100">
                <label htmlFor="formName" className="block text-sm font-medium text-slate-700 mb-1">Form Name</label>
                <input
                  id="formName"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter form name..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-lg font-semibold text-primary outline-none focus:ring-2 focus:ring-secondary"
                  disabled={isSaving}
                />
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100 space-y-4">
                <h2 className="text-xl font-bold text-primary">Form Content</h2>
                {(Array.isArray(formSchema?.sections) ? formSchema.sections : []).map((section, sectionIndex) => {
                  const isCollapsed = collapsedSections[section.id] ?? false;
                  const fields = Array.isArray(section?.fields) ? section.fields : [];
                  return (
                  <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 mr-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Section title (optional)
                        </label>
                        <input
                          type="text"
                          value={section.title ?? ''}
                          onChange={(e) =>
                            handleUpdateSectionTitle(section.id, e.target.value)
                          }
                          placeholder={
                            sectionIndex === 0
                              ? 'e.g. Section 1'
                              : `e.g. Section ${sectionIndex + 1}`
                          }
                          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-secondary focus:ring-2 focus:ring-secondary"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                         <button
                            type="button"
                            onClick={() => toggleSectionCollapsed(section.id)}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            {isCollapsed ? 'Expand' : 'Collapse'}
                          </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSection(section.id, 'up')}
                          disabled={sectionIndex === 0}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSection(section.id, 'down')}
                          disabled={sectionIndex === (formSchema.sections?.length || 0) - 1}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ↓
                        </button>
                         <button
                            type="button"
                            onClick={() => handleRemoveSectionClick(section.id)}
                            className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete section
                          </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="mt-4">
                        <Droppable droppableId={`form-section-${section.id}`}>
                          {(provided, snapshot) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className={`min-h-[200px] p-2 rounded-lg transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-transparent'}`}
                            >
                              {fields.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-10">
                                  No fields yet. Drag fields here from the palette.
                                </p>
                              ) : (
                                <div className="space-y-4">
                                  {fields.map((field, fieldIndex) => {
                                    const isStaticText = field.type === 'static_text';
                                    const isDivider = field.type === 'divider';
                                    return (
                                      <div
                                        key={field.id}
                                        className="rounded-lg border border-gray-200 bg-white p-4 mb-4 shadow-sm"
                                      >
                                        <div className="flex items-start justify-between mb-3">
                                          <div className="flex-1 mr-2">
                                            {!isDivider && (
                                                <>
                                                <div className="text-sm font-semibold text-gray-800">
                                                    {field.label || 'Untitled field'}
                                                </div>
                                                <div className="text-xs text-gray-500 mb-1">
                                                    {field.type}
                                                </div>
                                                </>
                                            )}
                                            
                                            {isDivider && (
                                                <div className="text-sm font-semibold text-gray-800">Divider</div>
                                            )}


                                            {formSchema.sections.length > 1 && (
                                              <div className="mt-1">
                                                <label className="text-[11px] font-medium text-gray-600 mr-2">
                                                  Section:
                                                </label>
                                                <select
                                                  value={section.id}
                                                  onChange={(e) =>
                                                    handleMoveFieldToSection(
                                                      field.id,
                                                      section.id,
                                                      e.target.value
                                                    )
                                                  }
                                                  className="inline-block rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:border-secondary focus:ring-1 focus:ring-secondary"
                                                >
                                                  {(Array.isArray(formSchema?.sections) ? formSchema.sections : []).map((s, idx) => (
                                                    <option key={s.id} value={s.id}>
                                                      {s.title && s.title.trim() !== ''
                                                        ? s.title
                                                        : `Section ${idx + 1}`}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => handleMoveField(section.id, field.id, 'up')}
                                              disabled={fieldIndex === 0}
                                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                              ↑
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleMoveField(section.id, field.id, 'down')}
                                              disabled={fieldIndex === fields.length - 1}
                                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                              ↓
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveField(section.id, field.id)}
                                              className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>

                                        {!isDivider && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 items-start">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Field title
                                                </label>
                                                <input
                                                type="text"
                                                value={field.label ?? ''}
                                                onChange={(e) =>
                                                    handleUpdateField(section.id, field.id, { label: e.target.value })
                                                }
                                                className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:border-secondary focus:ring-2 focus:ring-secondary"
                                                placeholder="Enter field title"
                                                />
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                id={`required-${field.id}`}
                                                type="checkbox"
                                                checked={!!field.required}
                                                onChange={(e) =>
                                                    handleUpdateField(section.id, field.id, { required: e.target.checked })
                                                }
                                                className="h-4 w-4 text-accent border-gray-300 rounded"
                                                />
                                                <label
                                                htmlFor={`required-${field.id}`}
                                                className="ml-2 text-sm text-gray-700"
                                                >
                                                Required
                                                </label>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className={`block text-xs font-medium text-gray-700 mb-1 ${isStaticText ? 'sr-only' : ''}`}>
                                                Description (optional)
                                                </label>
                                                <RichTextEditor
                                                value={field.helpText ?? ''}
                                                onChange={(html) =>
                                                    handleUpdateField(section.id, field.id, { helpText: html })
                                                }
                                                placeholder={
                                                    isStaticText
                                                    ? "Enter the body content for this information block..."
                                                    : "Additional instructions or context for this field"
                                                }
                                                />
                                            </div>
                                            </div>
                                        )}
                                        
                                        {renderFieldTypeConfig(field, section.id)}
                                        
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )}
                  </div>
                );
              })}
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="inline-flex items-center px-4 py-2 rounded-md border border-dashed border-gray-400 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  + Add section
                </button>
              </div>
            </div>

            {/* Right Panel: Field Palette */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100">
                <h2 className="text-xl font-bold text-primary mb-4">Field Palette</h2>
                <p className="text-sm text-gray-600 mb-3">
                  Drag a field type to add it to the form.
                </p>
                 <Droppable droppableId="field-palette" isDropDisabled={true}>
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 gap-2">
                            {paletteFields.map((field, index) => {
                                const Icon = fieldIcons[field.type as FormFieldType] || Type;
                                return (
                                <Draggable key={field.type} draggableId={`palette-${field.type}`} index={index}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-md border border-gray-300 text-left text-sm bg-white hover:bg-gray-50 shadow-sm"
                                        >
                                            <Icon size={18} className="text-gray-500" />
                                            <span>{field.label}</span>
                                        </div>
                                    )}
                                </Draggable>
                            );
                        })}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={openPreview}
                    className="w-full px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Preview form
                  </button>
                </div>
              </div>
            </div>
          </div>
        </DragDropContext>
          )}
          
          {formId && (
            <div className="mt-10 bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Assignments</h2>
                <button
                  type="button"
                  onClick={openAssignModal}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Assign Form
                </button>
              </div>

              {assignmentsError && <p className="text-red-600 mb-2">{assignmentsError}</p>}
              {isAssignmentsLoading ? <p className="text-gray-500">Loading assignments…</p>
              : assignments.length === 0 ? <p className="text-gray-500">This form has no assignments yet.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead><tr className="border-b"><th className="py-2 pr-4 font-semibold text-gray-700">Target</th><th className="py-2 pr-4 font-semibold text-gray-700">Type</th><th className="py-2 pr-4 font-semibold text-gray-700">Dynamic</th><th className="py-2 pr-4 font-semibold text-gray-700">Due Date</th><th className="py-2 pr-4 font-semibold text-gray-700">Actions</th></tr></thead>
                    <tbody>
                      {assignments.map((assignment) => (
                        <tr key={assignment.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 text-gray-800">{getAssignmentTargetLabel(assignment)}</td>
                          <td className="py-2 pr-4 text-gray-600">{assignment.target_type}</td>
                          <td className="py-2 pr-4 text-gray-600">{assignment.target_type === 'group' ? (assignment.is_dynamic ? 'Yes' : 'No') : '—'}</td>
                          <td className="py-2 pr-4 text-gray-600">{assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : 'No due date'}</td>
                          <td className="py-2 pr-4"><button type="button" onClick={() => openDeleteAssignmentModal(assignment)} className="inline-flex items-center px-3 py-1 rounded-md border border-gray-300 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50">Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg text-gray-900">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Assign Form</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign to</label>
              <select value={assignTargetType} onChange={(e) => setAssignTargetType(e.target.value as FormAssignmentTargetType)} className={formControlClasses}><option value="user">Single user</option><option value="group">Group</option><option value="all">All users</option></select>
            </div>
            {assignTargetType === 'user' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <select value={assignUserId ?? ''} onChange={(e) => setAssignUserId(e.target.value || null)} className={formControlClasses}>
                  <option value="">Select a user…</option>
                  {isUsersLoading ? <option disabled>Loading users…</option> : (users?.map((user) => (<option key={user.user_id} value={user.user_id}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || user.user_id}</option>)))}
                </select>
              </div>
            )}
            {assignTargetType === 'group' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
                  <select value={assignGroupId ?? ''} onChange={(e) => setAssignGroupId(e.target.value || null)} className={formControlClasses}>
                    <option value="">Select a group…</option>
                    {isGroupsLoading ? <option disabled>Loading groups…</option> : (groups.map((group) => (<option key={group.id} value={group.id}>{group.name}</option>)))}
                  </select>
                </div>
                <div className="mb-4 flex items-center">
                  <input id="assign-dynamic" type="checkbox" checked={assignIsDynamic} onChange={(e) => setAssignIsDynamic(e.target.checked)} className="h-4 w-4 text-accent border-gray-300 rounded" />
                  <label htmlFor="assign-dynamic" className="ml-2 text-sm text-gray-700">Dynamic assignment (include future members)</label>
                </div>
              </>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Due date (optional)</label>
              <input type="date" value={assignDueDate ?? ''} onChange={(e) => setAssignDueDate(e.target.value ? e.target.value : null)} className={formControlClasses} />
            </div>
            {assignmentsError && <p className="text-red-600 mb-2">{assignmentsError}</p>}
            <div className="flex justify-end space-x-2 mt-4">
              <button type="button" onClick={closeAssignModal} className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleCreateAssignment} className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700">Assign</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && assignmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Remove assignment
            </h3>

            <p className="text-sm text-gray-700 mb-3">
              This will remove this form assignment for:
            </p>
            <p className="text-sm font-medium text-gray-900 mb-4">
              {getAssignmentTargetLabel(assignmentToDelete)}
            </p>

            <p className="text-sm text-gray-700 mb-3">
              This action cannot be undone. To confirm, please type
              <span className="font-semibold"> REMOVE </span>
              in the box below.
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type REMOVE to confirm"
              className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500 focus:ring-offset-0 mb-4"
            />

            <div className="flex justify-end space-x-2 mt-2">
              <button
                type="button"
                onClick={closeDeleteAssignmentModal}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                disabled={isDeletingAssignment}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAssignment}
                disabled={
                  isDeletingAssignment || deleteConfirmText !== 'REMOVE'
                }
                className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-semibold shadow hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingAssignment ? 'Removing…' : 'Confirm removal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteSectionModalOpen && sectionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Delete Section
            </h3>
            <p className="text-sm text-gray-700 mb-4">
                Are you sure you want to delete the section titled "{sectionToDelete.title || 'Untitled section'}"? All fields within this section will also be permanently removed. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2 mt-6">
                <button
                type="button"
                onClick={handleCancelDeleteSection}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                Cancel
                </button>
                <button
                type="button"
                onClick={handleConfirmDeleteSection}
                className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-semibold shadow hover:bg-red-700"
                >
                Confirm Delete
                </button>
            </div>
            </div>
        </div>
      )}
      
      {isDeleteConfirmModalOpen && (
          <Modal
            isOpen={isDeleteConfirmModalOpen}
            onClose={closeDeleteModal}
            title="Confirm Deletion"
          >
            <div className="space-y-4">
                <p className="text-sm text-gray-700">
                    This action will permanently delete the form <strong>&quot;{formName}&quot;</strong> and all associated uploaded files. This cannot be undone.
                </p>
                <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                    <strong>Note:</strong> If this form has any active assignments, the deletion will fail. You must remove all assignments first.
                </div>
                <p className="text-sm text-gray-600">
                    To confirm, type <strong className="text-red-700">DELETE</strong> into the box below.
                </p>
                <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500 focus:ring-offset-0 mb-4"
                    disabled={isDeleting}
                    placeholder="Type DELETE to confirm"
                />
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button onClick={closeDeleteModal} disabled={isDeleting} className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                    <button onClick={handleDeleteForm} disabled={isDeleting || deleteConfirmInput !== 'DELETE'} className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-semibold shadow hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                </div>
            </div>
          </Modal>
      )}

      {isPreviewOpen && formSchema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Form preview
            </h2>

            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {formSchema.title || formName || 'Untitled form'}
              </h3>
              {formSchema.description && (
                <p className="mt-1 text-sm text-gray-600">
                  {formSchema.description}
                </p>
              )}
            </div>

            {(() => {
              const sections = Array.isArray(formSchema?.sections) ? formSchema.sections : [];
              return sections.length > 0 ? (
                sections.map((section, index) => {
                  const hasTitle = !!section.title && section.title.trim() !== '';
                  const fields = Array.isArray(section?.fields) ? section.fields : [];

                  return (
                    <div
                      key={section.id}
                      className={`mb-6 ${
                        index > 0 ? 'mt-2' : ''
                      }`}
                    >
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        {hasTitle && (
                          <h3 className="text-sm font-semibold text-gray-900 mb-2">
                            {section.title}
                          </h3>
                        )}

                        <div className="space-y-4">
                          {fields.map((field) => {
                            const hasLabel = !!field.label && field.label.trim() !== '';
                            const hasHelpText = !!field.helpText && field.helpText.trim() !== '';

                            if (field.type === 'divider') {
                                return (
                                  <div key={field.id}>
                                    {renderPreviewControl(field)}
                                  </div>
                                );
                            }

                            if (field.type === 'static_text') {
                              return (
                                <div key={field.id} className="space-y-1">
                                  {hasLabel && (
                                    <div className="text-sm font-medium text-gray-800">
                                      {field.label}
                                    </div>
                                  )}
                                  {hasHelpText && (
                                    <div
                                      className="text-sm text-gray-700 prose"
                                      dangerouslySetInnerHTML={{ __html: field.helpText as string }}
                                    />
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div key={field.id} className="space-y-1">
                                {hasLabel && (
                                  <label className="block text-sm font-medium text-gray-700">
                                    {field.label}
                                    {field.required && <span className="text-red-500 ml-1">*</span>}
                                  </label>
                                )}

                                {hasHelpText && (
                                  <div
                                    className="text-xs text-gray-500 mb-1 prose"
                                    dangerouslySetInnerHTML={{ __html: field.helpText as string }}
                                  />
                                )}

                                {renderPreviewControl(field)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
              <p className="text-sm text-gray-500">
                This form has no sections or fields yet.
              </p>
            );
          })()}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={closePreview}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingImage && (
        <ImageEditModal
          open={isEditModalOpen}
          imageUrl={editingImage.imageUrl}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingImage(null);
          }}
          onConfirm={handleImageEditConfirm}
        />
      )}

    </div>
  );
};

export default CreateFormPage;