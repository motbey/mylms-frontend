import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import FavoritesSection from '../../../components/FavoritesSection';
import type { UsersListRow } from '../../../src/types/users';

// A generic modal component, consistent with others in the application.
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 sm:px-6" aria-modal="true" role="dialog">
      <div className="w-full max-w-4xl transform rounded-2xl bg-white shadow-xl transition-all max-h-[85vh] overflow-hidden flex flex-col">
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

const Toast: React.FC<{ message: string; type: 'success' | 'error'; onDismiss: () => void }> = ({ message, type, onDismiss }) => {
    useEffect(() => {
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    }, [onDismiss]);
  
    const baseClasses = "fixed top-20 right-5 z-[100] px-4 py-3 rounded-md shadow-lg text-white animate-fade-in-down";
    const typeClasses = type === 'error' ? 'bg-red-500' : 'bg-green-500';
  
    return (
      <div className={`${baseClasses} ${typeClasses}`}>
        {message}
      </div>
    );
};

// This type must exactly match the `RETURNS TABLE` definition of the `list_user_competencies` RPC.
type UserCompetencyRow = {
  event_id: string;
  competency_id: string;
  competency_title: string | null;
  competency_description: string | null;
  competency_is_active: boolean | null;
  event_status: 'valid' | 'expired' | 'revoked' | 'not_achieved';
  achieved_date: string | null;
  expires_on: string | null;
  is_achieved: boolean;
  accreditor: string | null;
  notes: string | null;
  expiry_mode: 'auto' | 'manual' | 'none' | null;
  created_at: string | null;
  created_by_name: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
  revoked_at: string | null;
  revoked_by_name: string | null;
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-AU', {
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

const formatDateOnly = (dateString: string | null): string => {
    if (!dateString) return '—';
    try {
      // Add T00:00:00 to ensure the date is parsed in local timezone, not UTC
      return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-4 w-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
  
const AuditInfoTooltip: React.FC<{ comp: UserCompetencyRow }> = ({ comp }) => (
    <div className="relative group inline-flex ml-2">
        <InfoIcon className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-xs
                        rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white
                        shadow-lg ring-1 ring-black/10 opacity-0 group-hover:opacity-100
                        transition-opacity z-20">
            <ul className="space-y-1 text-left">
                <li><strong>Assigned:</strong> {formatDateOnly(comp.achieved_date)} by {comp.created_by_name || 'System'}</li>
                {comp.updated_at && comp.created_at && new Date(comp.updated_at).getTime() !== new Date(comp.created_at).getTime() && (
                    <li><strong>Updated:</strong> {formatDate(comp.updated_at)} by {comp.updated_by_name || 'System'}</li>
                )}
                {comp.revoked_at && (
                    <li><strong>Revoked:</strong> {formatDate(comp.revoked_at)} by {comp.revoked_by_name || 'System'}</li>
                )}
            </ul>
        </div>
    </div>
);

const UserCompetenciesPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as { user?: UsersListRow } | undefined;
  const selectedUser = state?.user;

  const [items, setItems] = useState<UserCompetencyRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);

  // Revoke modal state
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [selectedEventToRevoke, setSelectedEventToRevoke] = useState<UserCompetencyRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Assign/Edit modal and form state
  const [modalMode, setModalMode] = useState<'assign' | 'edit'>('assign');
  const [selectedEvent, setSelectedEvent] = useState<UserCompetencyRow | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  type SimpleCompetency = { id: string; title: string; validity_days: number | null; };
  const [availableCompetencies, setAvailableCompetencies] = useState<SimpleCompetency[]>([]);
  const [isLoadingCompetencies, setIsLoadingCompetencies] = useState(false);
  const [selectedCompetencyId, setSelectedCompetencyId] = useState("");
  const [achievedDate, setAchievedDate] = useState("");
  const [expiryMode, setExpiryMode] = useState<"auto" | "manual" | "none">("auto");
  const [manualExpiryDate, setManualExpiryDate] = useState("");
  const [accreditor, setAccreditor] = useState("");
  const [notes, setNotes] = useState("");
  const [isAchieved, setIsAchieved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Confirmation modal state for edits
  const [isConfirmUpdateOpen, setIsConfirmUpdateOpen] = useState(false);
  const [confirmUpdateText, setConfirmUpdateText] = useState("");

  const todayStr = new Date().toISOString().split("T")[0]; // 'YYYY-MM-DD'


  const loadUserCompetencies = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("list_user_competencies", { p_user_id: userId });
    if (rpcError) {
      console.error("Error loading user competencies", rpcError);
      setError("Could not load competencies for this user.");
      setItems([]);
    } else {
      setItems((data as UserCompetencyRow[]) ?? []);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadUserCompetencies();
  }, [loadUserCompetencies]);
  
  // --- Revoke Logic ---
  const handleOpenRevokeModal = (comp: UserCompetencyRow) => {
    setSelectedEventToRevoke(comp);
    setRevokeError(null);
    setIsRevokeModalOpen(true);
  };
  const handleCloseRevokeModal = () => !isRevoking && setIsRevokeModalOpen(false);
  const handleConfirmRevoke = async () => {
    if (!selectedEventToRevoke) return;
    setRevokeError(null);
    setIsRevoking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Could not identify current user.");
      const { error: rpcError } = await supabase.rpc('revoke_competency_event', { p_event_id: selectedEventToRevoke.event_id, p_revoked_by: user.id });
      if (rpcError) throw rpcError;
      await loadUserCompetencies();
      setToast({ message: "Competency revoked successfully.", type: 'success' });
      handleCloseRevokeModal();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : "An unexpected error occurred.";
      setRevokeError(message);
    } finally {
      setIsRevoking(false);
    }
  };
  
  // --- Assign/Edit Modal & Form Logic ---
  const resetFormState = () => {
    setSelectedCompetencyId("");
    setAchievedDate("");
    setExpiryMode("auto");
    setManualExpiryDate("");
    setAccreditor("");
    setNotes("");
    setIsAchieved(false);
    setFormError(null);
    setSelectedEvent(null);
  };

  const loadAvailableCompetencies = async () => {
    setIsLoadingCompetencies(true);
    setFormError(null);
    const { data, error } = await supabase.from("competencies").select("id, title, validity_days").eq("is_active", true).eq("is_archived", false).order("title");
    if (error) {
      setFormError("Could not load available competencies.");
    } else {
      setAvailableCompetencies(data ?? []);
    }
    setIsLoadingCompetencies(false);
  };

  const handleOpenAssignModal = () => {
    setModalMode('assign');
    resetFormState();
    if (availableCompetencies.length === 0) loadAvailableCompetencies();
    setIsAssignOpen(true);
  };
  
  const handleOpenEditModal = (comp: UserCompetencyRow) => {
    setModalMode('edit');
    setSelectedEvent(comp);
    setFormError(null);
    
    // Use the new `expiry_mode` from the DB as the source of truth
    const mode = comp.expiry_mode || 'auto';
    setExpiryMode(mode);

    if (mode === 'manual') {
      setManualExpiryDate(comp.expires_on ? comp.expires_on.split('T')[0] : '');
    } else {
      setManualExpiryDate('');
    }

    // Set remaining form fields from the selected row
    setSelectedCompetencyId(comp.competency_id);
    setAchievedDate(comp.achieved_date ? comp.achieved_date.split('T')[0] : "");
    setAccreditor(comp.accreditor || "");
    setNotes(comp.notes || "");
    setIsAchieved(comp.is_achieved);
    
    setIsAssignOpen(true);
  };
  
  const validateForm = () => {
    setFormError(null);
    if (!selectedCompetencyId) {
      setFormError("Please select a competency.");
      return false;
    }
    if (!achievedDate) {
      setFormError("Please select a qualification date.");
      return false;
    }
    if (achievedDate > todayStr) {
      setFormError("Qualification date cannot be in the future.");
      return false;
    }
    if (expiryMode === 'manual' && !manualExpiryDate) {
      setFormError("A specific expiry date is required for 'manual' mode.");
      return false;
    }
    return true;
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    if (modalMode === 'assign') {
      void handleConfirmAssign();
    } else {
      setConfirmUpdateText("");
      setIsConfirmUpdateOpen(true);
    }
  };

  const handleConfirmAssign = async () => {
    if (!userId || !validateForm()) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Could not determine current user.");
      const { error } = await supabase.rpc("assign_competency", {
        p_user_id: userId, p_competency_id: selectedCompetencyId, p_achieved_date: achievedDate,
        p_expiry_mode: expiryMode, p_manual_expires_on: expiryMode === "manual" ? manualExpiryDate : null,
        p_accreditor: accreditor || null, p_notes: notes || null, p_is_achieved: isAchieved, p_created_by: user.id
      });
      if (error) throw error;
      await loadUserCompetencies();
      setIsAssignOpen(false);
      setToast({ message: "Competency successfully assigned", type: 'success' });
    } catch (err: any) {
      console.error("Error assigning competency:", err);
      setToast({ message: err.message || "Failed to assign competency.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmUpdate = async () => {
    if (!selectedEvent || !validateForm()) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Could not determine current user.");
      const { error } = await supabase.rpc("update_competency_event", {
        p_event_id: selectedEvent.event_id, p_achieved_date: achievedDate, p_expiry_mode: expiryMode,
        p_manual_expires_on: expiryMode === 'manual' ? manualExpiryDate : null,
        p_accreditor: accreditor || null, p_notes: notes || null, p_is_achieved: isAchieved, p_updated_by: user.id,
      });
      if (error) throw error;
      await loadUserCompetencies();
      setIsConfirmUpdateOpen(false);
      setIsAssignOpen(false);
      setToast({ message: "Assignment updated successfully.", type: 'success' });
    } catch(err: any) {
      console.error("Error updating competency assignment:", err);
      setToast({ message: err.message || "Could not update assignment.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const assignedNonRevokedIds = useMemo(() => 
    new Set(items.filter(item => item.event_status !== 'revoked').map(item => item.competency_id)),
  [items]);

  const filteredForAssignCompetencies = useMemo(() => 
    availableCompetencies.filter(comp => !assignedNonRevokedIds.has(comp.id)),
  [availableCompetencies, assignedNonRevokedIds]);
  
  const displayedItems = useMemo(() => {
    if (showRevoked) {
      return items;
    }
    return items.filter(item => item.event_status !== 'revoked');
  }, [items, showRevoked]);

  const userName = [selectedUser?.first_name, selectedUser?.last_name].filter(Boolean).join(' ') || selectedUser?.email || `User ID: ${userId}`;

  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <div>
        <button type="button" onClick={() => navigate("/admin/content/competencies/assign")} className="text-sm font-medium text-[#153AC7] hover:underline">&larr; Back to Assign Competencies</button>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">User Competencies</h1>
            <p className="mt-1 text-sm md:text-base text-slate-600">Competencies assigned to <span className="font-semibold">{userName}</span></p>
          </div>
          <button type="button" onClick={handleOpenAssignModal} className="inline-flex items-center justify-center rounded-full bg-[#153AC7] px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(0,0,0,0.25)] hover:bg-[#0f2da0] transition-colors">Assign Competency</button>
        </div>
      </div>

      <FavoritesSection />
      
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading && <div className="px-6 py-10 text-center text-sm text-slate-500">Loading competencies…</div>}
        {!isLoading && error && <div className="px-6 py-10 text-center text-sm text-red-600"><p>{error}</p><button type="button" onClick={loadUserCompetencies} className="mt-3 text-xs font-medium text-[#153AC7] hover:underline">Retry</button></div>}
        {!isLoading && !error && items.length === 0 && <div className="px-6 py-10 text-center text-sm text-slate-500">No competencies have been assigned to this user yet.</div>}

        {!isLoading && !error && items.length > 0 && (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Showing {displayedItems.length} of {items.length} assigned competencies
              </h3>
              <button
                type="button"
                onClick={() => setShowRevoked(prev => !prev)}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {showRevoked ? 'Hide Revoked' : 'Show Revoked'}
              </button>
            </div>

            {displayedItems.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500">
                    All revoked assignments are hidden.
                </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="py-3 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Competency Name</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Event Status</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Achieved on</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Expires on</th>
                      <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {displayedItems.map((comp) => (
                      <tr key={comp.event_id} className="hover:bg-slate-50/60">
                        <td className="py-3 pl-6 pr-3 text-sm font-medium text-slate-900">{comp.competency_title || '—'}</td>
                        <td className="px-3 py-3 text-sm">
                          {comp.event_status === "valid" && <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Valid</span>}
                          {comp.event_status === "expired" && <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Expired</span>}
                          {comp.event_status === "revoked" && <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">Revoked</span>}
                          {comp.event_status === 'not_achieved' && <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Not Achieved</span>}
                          <AuditInfoTooltip comp={comp} />
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600">{formatDateOnly(comp.achieved_date)}</td>
                        <td className="px-3 py-3 text-sm text-slate-600">{formatDateOnly(comp.expires_on)}</td>
                        <td className="px-3 py-3 text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => handleOpenEditModal(comp)} disabled={comp.event_status === 'revoked'} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">Edit</button>
                            <button type="button" onClick={() => handleOpenRevokeModal(comp)} disabled={comp.event_status === 'revoked'} className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:border-slate-300 disabled:text-slate-500 disabled:hover:bg-transparent">{comp.event_status === 'revoked' ? 'Revoked' : 'Revoke'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      
      <Modal isOpen={isRevokeModalOpen} onClose={handleCloseRevokeModal} title="Confirm Revocation">
          <div className="space-y-4 text-sm text-slate-700">
              <p>Are you sure you want to revoke the competency <span className="font-semibold">{selectedEventToRevoke?.competency_title}</span> for this user? This action cannot be undone.</p>
              {revokeError && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{revokeError}</p>}
              <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
                  <button type="button" onClick={handleCloseRevokeModal} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={isRevoking}>Cancel</button>
                  <button type="button" onClick={handleConfirmRevoke} disabled={isRevoking} className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">{isRevoking ? 'Revoking…' : 'Confirm Revoke'}</button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isAssignOpen} onClose={() => !isSaving && setIsAssignOpen(false)} title={modalMode === 'assign' ? "Assign Competency" : "Edit Competency Assignment"}>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Competency <span className="text-red-500">*</span></label>
            {modalMode === 'assign' ? (
              <>
                <select value={selectedCompetencyId} onChange={(e) => setSelectedCompetencyId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#153AC7] focus:outline-none focus:ring-1 focus:ring-[#153AC7]">
                  <option value="">Select a competency…</option>
                  {filteredForAssignCompetencies.map((c) => (<option key={c.id} value={c.id}>{c.title}{c.validity_days ? ` (${c.validity_days} days)` : ""}</option>))}
                </select>
                {isLoadingCompetencies && <p className="mt-1 text-xs text-slate-500">Loading competencies…</p>}
                {!isLoadingCompetencies && availableCompetencies.length > 0 && filteredForAssignCompetencies.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">All available competencies have already been assigned to this user.</p>
                )}
              </>
            ) : (
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{selectedEvent?.competency_title}</div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Qualification date <span className="text-red-500">*</span></label>
            <input type="date" value={achievedDate} max={todayStr} onChange={(e) => setAchievedDate(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#153AC7] focus:outline-none focus:ring-1 focus:ring-[#153AC7]" />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Expiry</label>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" value="auto" checked={expiryMode === "auto"} onChange={() => setExpiryMode("auto")} /><span>Set expiry from qualification <span className="text-xs text-slate-500">(uses competency default)</span></span></label>
              <label className="flex items-center gap-2"><input type="radio" value="manual" checked={expiryMode === "manual"} onChange={() => setExpiryMode("manual")} /><span>Set specific expiry date</span></label>
              {expiryMode === "manual" && <div className="pl-6"><input type="date" value={manualExpiryDate} onChange={(e) => setManualExpiryDate(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#153AC7] focus:outline-none focus:ring-1 focus:ring-[#153AC7]" /></div>}
              <label className="flex items-center gap-2"><input type="radio" value="none" checked={expiryMode === "none"} onChange={() => setExpiryMode("none")} /><span>No expiry</span></label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Accreditor (optional)</label>
            <input type="text" value={accreditor} onChange={(e) => setAccreditor(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#153AC7] focus:outline-none focus:ring-1 focus:ring-[#153AC7]" placeholder="e.g. RTO name or assessor" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select value={isAchieved ? "achieved" : "not_achieved"} onChange={(e) => setIsAchieved(e.target.value === "achieved")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#153AC7] focus:outline-none focus:ring-1 focus:ring-[#153AC7]">
              <option value="not_achieved">Not Achieved</option><option value="achieved">Achieved</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#153AC7] focus:outline-none focus:ring-1 focus:ring-[#153AC7]" placeholder="Any additional information..." />
          </div>

          {formError && <p className="text-sm text-red-600 md:col-span-2">{formError}</p>}

          <div className="mt-6 flex items-center justify-end gap-3 md:col-span-2">
            <button type="button" onClick={() => !isSaving && setIsAssignOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={isSaving}>Cancel</button>
            <button type="submit" className="rounded-lg bg-[#153AC7] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f2da0] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving}>{isSaving ? "Saving…" : (modalMode === 'assign' ? 'Assign Competency' : 'Update Assignment')}</button>
          </div>
        </form>
      </Modal>
      
      <Modal isOpen={isConfirmUpdateOpen} onClose={() => !isSaving && setIsConfirmUpdateOpen(false)} title="Confirm Update">
        <div className="space-y-4 text-sm text-slate-700">
            <p>You are about to update this competency assignment. This action will be recorded in the audit trail.</p>
            <p className="text-slate-600">To confirm, type <span className="font-semibold">UPDATE</span> in the box below and then click <span className="font-semibold">Confirm Update</span>.</p>
            <input type="text" value={confirmUpdateText} onChange={(e) => setConfirmUpdateText(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#153AC7] focus:outline-none focus:ring-1 focus:ring-[#153AC7]" placeholder="Type UPDATE to confirm" />
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => !isSaving && setIsConfirmUpdateOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={isSaving}>Cancel</button>
                <button type="button" onClick={handleConfirmUpdate} disabled={isSaving || confirmUpdateText !== 'UPDATE'} className="rounded-lg bg-[#153AC7] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f2da0] disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Updating…" : "Confirm Update"}</button>
            </div>
        </div>
      </Modal>

    </div>
  );
};

export default UserCompetenciesPage;