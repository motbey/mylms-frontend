import { supabase } from '../../lib/supabaseClient';
import { FormAnswers, FileAnswerItem, SignatureAnswer } from '../types/forms';

type SubmissionMode = 'draft' | 'submit';

interface SaveOrSubmitInput {
  formId: string;
  userId: string;
  answers: FormAnswers;
  submissionId?: string | null;
  mode: SubmissionMode;
}

export async function saveOrSubmitSubmission(input: SaveOrSubmitInput): Promise<string> {
  const { formId, userId, answers, submissionId, mode } = input;

  const basePayload = {
    form_id: formId,
    user_id: userId,
    data: { answers },
  };

  const modePayload = mode === 'submit'
    ? {
        status: 'submitted' as const,
        submitted_at: new Date().toISOString(),
        review_status: 'pending' as const,
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
      }
    : {
        status: 'started' as const,
        submitted_at: null, // Explicitly clear submission timestamp for drafts
      };

  const finalPayload = { ...basePayload, ...modePayload };

  if (submissionId) {
    const { error } = await supabase
      .from('form_submissions')
      .update(finalPayload)
      .eq('id', submissionId)
      .eq('user_id', userId);

    if (error) {
      console.error(`Error updating submission in ${mode} mode:`, error);
      throw new Error('Could not save your progress.');
    }
    return submissionId;
  } else {
    const { data, error } = await supabase
      .from('form_submissions')
      .insert(finalPayload)
      .select('id')
      .single();

    if (error) {
      console.error(`Error inserting submission in ${mode} mode:`, error);
      throw new Error('Could not save your progress.');
    }
    return data.id;
  }
}

export async function getFilesForSubmission(submissionId: string): Promise<Record<string, FileAnswerItem[]>> {
    const { data, error } = await supabase
        .from('form_submission_files')
        .select('id, field_key, file_name, storage_bucket, storage_path, created_at')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching submission files:', error);
        throw new Error('Could not load uploaded files.');
    }

    const filesByField: Record<string, FileAnswerItem[]> = {};
    for (const row of data) {
        const fileItem: FileAnswerItem = {
            fileId: row.id,
            fileName: row.file_name,
            storageBucket: row.storage_bucket,
            storagePath: row.storage_path,
            uploadedAt: row.created_at,
        };
        if (!filesByField[row.field_key]) {
            filesByField[row.field_key] = [];
        }
        filesByField[row.field_key].push(fileItem);
    }
    return filesByField;
}

export async function uploadAndLinkFile(
    { userId, formId, submissionId, fieldKey, file, onProgress }:
    { userId: string; formId: string; submissionId: string; fieldKey: string; file: File | Blob; onProgress: (progress: number) => void }
): Promise<FileAnswerItem> {
    const fileName = (file instanceof File) ? file.name : `signature_${Date.now()}.png`;
    const filePath = `user/${userId}/${formId}/${submissionId}/${fieldKey}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('form-uploads')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
    }
    
    onProgress(100);

    const { data: inserted, error: insertError } = await supabase
        .from('form_submission_files')
        .insert({
            submission_id: submissionId,
            field_key: fieldKey,
            file_name: fileName,
            storage_bucket: 'form-uploads',
            storage_path: filePath,
            uploaded_by: userId
        })
        .select('id, created_at')
        .single();
    
    if (insertError) {
        console.error('Error inserting file record:', insertError);
        await supabase.storage.from('form-uploads').remove([filePath]);
        throw new Error('Could not save file record after upload.');
    }

    return {
        fileId: inserted.id,
        fileName: fileName,
        storageBucket: 'form-uploads',
        storagePath: filePath,
        uploadedAt: inserted.created_at,
    };
}

export async function getSignedUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);
    
    if (error) {
        console.error('Error creating signed URL:', error);
        throw new Error('Could not get download link.');
    }
    return data.signedUrl;
}

export async function deleteFormFile(fileId: string, bucket: string, path: string): Promise<void> {
    const { error: dbError } = await supabase
        .from('form_submission_files')
        .delete()
        .eq('id', fileId);
    
    if (dbError) {
        console.error('Error deleting file record:', dbError);
        throw new Error('Could not remove file record from database.');
    }

    const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([path]);
        
    if (storageError) {
        console.warn('Could not remove file from storage, but DB record was deleted:', storageError);
    }
}

export async function uploadSignature(
  userId: string,
  formId: string,
  fieldId: string,
  dataUrl: string
): Promise<SignatureAnswer> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const fileName = `form-${formId}_user-${userId}_field-${fieldId}_${timestamp}.png`;
  const filePath = `${userId}/${formId}/${fileName}`;

  const { error } = await supabase.storage
    .from('signatures')
    .upload(filePath, blob, { contentType: 'image/png' });

  if (error) {
    console.error('Error uploading signature:', error);
    throw new Error('We couldn’t save your signature. Please try again.');
  }

  return {
    storageBucket: 'signatures',
    storagePath: filePath,
    signedAt: new Date().toISOString(),
  };
}

// --- Admin Review Types and Functions ---

export interface UnreviewedSubmission {
  id: string;
  form_id: string;
  user_id: string;
  submitted_at: string;
  form_name: string;
  learnerName: string;
  user_email: string;
}

export interface FullSubmission {
  id: string;
  form_id: string;
  user_id: string;
  submitted_at: string;
  data: { answers: FormAnswers };
  form_name: string;
  user_name: string;
  user_email: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_name: string | null;
  review_status: 'pending' | 'approved' | 'rejected' | null;
  rejection_reason: string | null;
  status: string;
}

export interface UserSubmission {
  id: string;
  data: { answers: FormAnswers };
  submitted_at: string | null;
  status: 'draft' | 'submitted' | 'started';
  review_status: 'pending' | 'approved' | 'rejected' | null;
  rejection_reason: string | null;
}

export async function getLatestUserSubmission(formId: string, userId: string): Promise<UserSubmission | null> {
    const { data, error } = await supabase
        .from('form_submissions')
        .select('id, data, submitted_at, status, review_status, rejection_reason')
        .eq('form_id', formId)
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false, nullsFirst: true })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching latest submission', error);
        throw error;
    }
    
    return data as UserSubmission | null;
}


export async function listUnreviewedSubmissions(limit = 5): Promise<UnreviewedSubmission[]> {
    const { data: submissions, error: subError } = await supabase
        .from('form_submissions')
        .select(`id, form_id, user_id, submitted_at, forms ( name )`)
        .eq('status', 'submitted')
        .eq('review_status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(limit);
        
    if (subError) {
        console.error('Error fetching unreviewed submissions:', subError);
        throw subError;
    }
    if (!submissions || submissions.length === 0) return [];
    
    const userIds = [...new Set(submissions.map(s => s.user_id).filter(Boolean))];
    if (userIds.length === 0) {
        return submissions.map(sub => ({
            id: sub.id,
            form_id: sub.form_id,
            user_id: sub.user_id,
            submitted_at: sub.submitted_at,
            // FIX: Cast `sub.forms` to an array type `as { name: string }[]` and access the first element, as TypeScript infers it as an array from the join query.
            form_name: ((sub.forms as { name: string }[])?.[0]?.name) || 'Unknown Form',
            learnerName: 'Unknown User',
            user_email: '',
        }));
    }

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);
        
    if (profileError) {
        console.error('Error fetching profiles for submissions:', profileError);
        throw profileError;
    }
    
    type ProfileData = { user_id: string; first_name: string | null; last_name: string | null; email: string | null };
    const profileMap = new Map(((profiles as ProfileData[]) || []).map(p => [p.user_id, p]));
    
    return submissions.map(sub => {
        const profile = sub.user_id ? profileMap.get(sub.user_id) : null;
        // FIX: Cast `sub.forms` to an array type `as { name: string }[]` and access the first element to match the inferred type from the join query.
        const form = (sub.forms as { name: string }[] | null)?.[0] ?? null;
        const learnerName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'Unknown User';

        return {
            id: sub.id,
            form_id: sub.form_id,
            user_id: sub.user_id,
            submitted_at: sub.submitted_at,
            form_name: form?.name || 'Unknown Form',
            learnerName: learnerName,
            user_email: profile?.email || '',
        };
    });
}

export async function getSubmissionById(submissionId: string): Promise<FullSubmission | null> {
    const { data: submission, error: subError } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();
    
    if (subError) throw subError;
    if (!submission) return null;

    const [formRes, profileRes, reviewerRes] = await Promise.all([
        supabase.from('forms').select('name').eq('id', submission.form_id).single(),
        supabase.from('profiles').select('first_name, last_name, email').eq('user_id', submission.user_id).single(),
        submission.reviewed_by ? supabase.from('profiles').select('first_name, last_name, email').eq('user_id', submission.reviewed_by).single() : Promise.resolve({ data: null, error: null })
    ]);

    if (formRes.error && formRes.error.code !== 'PGRST116') throw formRes.error;
    if (profileRes.error && profileRes.error.code !== 'PGRST116') throw profileRes.error;
    if (reviewerRes.error && reviewerRes.error.code !== 'PGRST116') throw reviewerRes.error;

    const formName = formRes.data?.name || 'Unknown Form';
    
    type ProfileInfo = { first_name: string | null; last_name: string | null; email: string | null; };
    const profile = profileRes.data as ProfileInfo | null;
    const userName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'Unknown User';
    
    const reviewerProfile = reviewerRes.data as ProfileInfo | null;
    const reviewerName = reviewerProfile ? [reviewerProfile?.first_name, reviewerProfile?.last_name].filter(Boolean).join(' ') || reviewerProfile?.email || 'Unknown Admin' : null;

    return {
        id: submission.id,
        form_id: submission.form_id,
        user_id: submission.user_id,
        submitted_at: submission.submitted_at,
        data: submission.data,
        form_name: formName,
        user_name: userName,
        user_email: profile?.email || '',
        reviewed_at: submission.reviewed_at,
        reviewed_by: submission.reviewed_by,
        reviewer_name: reviewerName,
        review_status: submission.review_status,
        rejection_reason: submission.rejection_reason,
        status: submission.status,
    };
}

export async function approveSubmission(submissionId: string, adminUserId: string): Promise<void> {
    const { error } = await supabase
        .from('form_submissions')
        .update({
            reviewed_at: new Date().toISOString(),
            reviewed_by: adminUserId,
            review_status: 'approved',
            rejection_reason: null,
        })
        .eq('id', submissionId);

    if (error) {
        console.error('Error marking submission as reviewed:', error);
        throw new Error('Could not update submission status.');
    }
}

export async function rejectSubmission(
    submissionId: string,
    adminUserId: string,
    reason: string
): Promise<void> {
    if (!reason || reason.trim() === '') {
        throw new Error('A reason for rejection is required.');
    }

    const { error } = await supabase
        .from('form_submissions')
        .update({
            reviewed_at: new Date().toISOString(),
            reviewed_by: adminUserId,
            review_status: 'rejected',
            rejection_reason: reason.trim(),
        })
        .eq('id', submissionId);

    if (error) {
        console.error('Error rejecting submission:', error);
        throw new Error('Could not update submission status to rejected.');
    }
}

export type DerivedStatus = 'Not Started' | 'Started' | 'Submitted' | 'Rejected' | 'Completed';

export interface AllSubmissionsParams {
  p_search?: string;
  p_status?: DerivedStatus | 'All';
  p_sort?: 'form' | 'learner' | 'submitted' | 'reviewed';
  p_dir?: 'asc' | 'desc';
  p_limit?: number;
  p_offset?: number;
}

export interface AllSubmissionsRow {
  id: string;
  form_title: string;
  learner_name: string;
  email: string;
  status: DerivedStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export async function fetchAllSubmissions(params: AllSubmissionsParams): Promise<{ rows: AllSubmissionsRow[], total: number }> {
    const { 
        p_search = '', 
        p_status = 'All',
        p_sort = 'submitted', 
        p_dir = 'desc', 
        p_limit = 25, 
        p_offset = 0 
    } = params;

    const rpcParams: any = {
        p_search,
        p_sort,
        p_dir,
        p_limit,
        p_offset,
    };
    if (p_status !== 'All') {
        rpcParams.p_status = p_status;
    }

    const { data, error } = await supabase.rpc('get_all_submissions', rpcParams);

    if (error) {
        console.error("Error fetching all submissions from RPC:", error);
        throw new Error(error.message || "An unknown error occurred while fetching submissions.");
    }
    
    const rows = (data as AllSubmissionsRow[]) ?? [];
    const rawTotal = (rows as any)[0]?.total;
    const total = Number.isFinite(rawTotal) ? rawTotal : rows.length;

    return { rows, total };
}