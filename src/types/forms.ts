// src/types/forms.ts

export type FormFieldType =
  | 'short_text'
  | 'long_text'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'checkbox_group'
  | 'date'
  | 'number'
  | 'rating'
  | 'signature'
  | 'file'
  | 'static_text'
  | 'group'
  | 'image'
  | 'divider';

export type FormRole = 'admin' | 'subadmin' | 'user' | 'security';

export type VisibilityOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte';

export interface VisibilityCondition {
  fieldId: string;
  operator: VisibilityOperator;
  value: string | number | boolean | (string | number)[];
}

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldValidation {
  min?: number;
  max?: number;
  maxLength?: number;

  pattern?: string;
}

export type FormFieldWidth = 'full' | 'half' | 'third';

export interface FormFieldLayout {
  width?: FormFieldWidth;
  order?: number;
}

export interface BaseFormField {
  id: string;
  type: FormFieldType;
  label?: string;
  helpText?: string;
  required?: boolean;
  placeholder?: string | null;
  maxLength?: number | null;
  options?: FormFieldOption[] | null;
  defaultValue?: unknown;
  validation?: FormFieldValidation;
  layout?: FormFieldLayout;
  visibilityConditions?: VisibilityCondition[];
  visibleToRoles?: FormRole[];
  readOnly?: boolean;
  showInSummary?: boolean;
  includeInPdf?: boolean;
  pdfLabel?: string;
  allowMultiple?: boolean; // used for file upload fields
  
  // Image-specific (used when type === 'image')
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;

  // Divider-specific (when type === 'divider')
  dividerStyle?: 'solid' | 'dashed' | 'dotted';
  dividerColor?: string | null;
  dividerThickness?: number | null;
  dividerMarginTop?: number | null;
  dividerMarginBottom?: number | null;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: BaseFormField[];
}

export interface FormSettings {
  allowDrafts?: boolean;
  allowMultipleSubmissions?: boolean;
  requiresValidation?: boolean;
  showSubmissionToUser?: boolean;
}

export interface FormSchema {
  title: string;
  description?: string;
  category?: string;
  version?: number;
  settings?: FormSettings;
  sections: FormSection[];
}

// ===== Submission data =====

export interface FileAnswerItem {
  fileId: string;
  fileName: string;
  storageBucket: string;
  storagePath: string;
  uploadedAt: string;
}

export interface SignatureAnswer {
  storageBucket: string;
  storagePath: string;
  signedAt: string;
}

export type FormAnswerValue =
  | string
  | number
  | boolean
  | string[]
  | FileAnswerItem[]
  | SignatureAnswer
  | null;

export interface FormAnswers {
  [fieldId: string]: FormAnswerValue;
}

export interface FormSubmissionDataMetadata {
  savedAsDraftAt?: string;
  submittedFromIp?: string;
  userAgent?: string;
  pdfGeneratedAt?: string | null;
  lastEditedAt?: string;
}

export interface FormSubmissionData {
  answers: FormAnswers;
  metadata?: FormSubmissionDataMetadata;
}