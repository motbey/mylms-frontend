import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FavoritesSection from '../../../components/FavoritesSection';
import { supabase } from '../../../lib/supabaseClient';

// A generic modal component, consistent with others in the application.
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 sm:px-6" aria-modal="true" role="dialog">
      <div className="w-full max-w-md transform rounded-2xl bg-white shadow-xl transition-all max-h-[85vh] overflow-hidden flex flex-col">
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

const AdminCompetencies: React.FC = () => {
  const navigate = useNavigate();

  // Modal and form state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [validityDays, setValidityDays] = useState("");
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameStatus, setNameStatus] = useState<"idle" | "available" | "taken">("idle");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New state for edit/archive functionality
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingCompetencyId, setEditingCompetencyId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isArchived, setIsArchived] = useState(false);
  const [updatingArchiveId, setUpdatingArchiveId] = useState<string | null>(null);

  // Competency list state
  type CompetencyRow = {
    id: string;
    title: string;
    description: string | null;
    validity_days: number | null;
    is_active: boolean;
    is_archived: boolean;
  };
  const [competencies, setCompetencies] = useState<CompetencyRow[]>([]);
  const [isLoadingCompetencies, setIsLoadingCompetencies] = useState(false);
  const [competenciesError, setCompetenciesError] = useState<string | null>(null);

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  // State for confirmation popup
  const [isConfirmUpdateOpen, setIsConfirmUpdateOpen] = useState(false);
  const [confirmUpdateText, setConfirmUpdateText] = useState("");

  // --- Data Fetching ---
  const fetchCompetencies = async () => {
    setIsLoadingCompetencies(true);
    setCompetenciesError(null);

    const { data, error } = await supabase
      .from("competencies")
      .select("id, title, description, validity_days, is_active, is_archived")
      .order("title", { ascending: true });

    if (error) {
      console.error("Error loading competencies", error);
      setCompetenciesError("Could not load competencies. Please try again.");
      setIsLoadingCompetencies(false);
      return;
    }

    setCompetencies(data ?? []);
    setCurrentPage(1); // Reset to first page on fetch/re-fetch
    setIsLoadingCompetencies(false);
  };

  useEffect(() => {
    fetchCompetencies();
  }, []);

  // --- Logic for saving/updating a competency ---
  const saveCompetency = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const parsedValidityDays =
      validityDays.trim() === "" ? null : Number(validityDays);
  
    if (!trimmedName) {
      setNameError("Competency name is required.");
      return;
    }
    if (nameStatus === "taken") {
      setNameError("A competency with this name already exists.");
      return;
    }
  
    setIsSaving(true);
    setNameError(null);
  
    try {
      if (modalMode === "create") {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
  
        if (userError) {
          console.error("Error getting user", userError);
          setNameError("Could not determine current user.");
          setIsSaving(false);
          return;
        }
  
        const { error } = await supabase.rpc("create_competency", {
          p_title: trimmedName,
          p_description: trimmedDescription || null,
          p_validity_days: parsedValidityDays,
          p_created_by: user?.id ?? null,
        });
  
        if (error) {
          console.error("Error creating competency", error);
          setNameError("Could not create competency. Please try again.");
          setIsSaving(false);
          return;
        }
      } else {
        if (!editingCompetencyId) {
          setNameError("No competency selected for editing.");
          setIsSaving(false);
          return;
        }
  
        const { error } = await supabase.rpc("update_competency", {
          p_id: editingCompetencyId,
          p_title: trimmedName,
          p_description: trimmedDescription || null,
          p_validity_days: parsedValidityDays,
          p_is_active: isActive,
          p_is_archived: isArchived,
        });
  
        if (error) {
          console.error("Error updating competency", error);
          setNameError("Could not update competency. Please try again.");
          setIsSaving(false);
          return;
        }
      }
  
      await fetchCompetencies();
      setIsSaving(false);
      setIsCreateModalOpen(false);
      setIsConfirmUpdateOpen(false);
    } catch (err) {
      console.error("Unexpected error saving competency", err);
      setNameError("Unexpected error. Please try again.");
      setIsSaving(false);
    }
  };

  // --- Modal Handlers ---
  const handleCreateCompetencyClick = () => {
    setModalMode("create");
    setEditingCompetencyId(null);
    setIsActive(true);
    setIsArchived(false);
    setIsCreateModalOpen(true);
    // Reset form each time we open
    setName("");
    setDescription("");
    setValidityDays("");
    setNameStatus("idle");
    setNameError(null);
  };

  const handleAssignCompetenciesClick = () => {
    navigate('/admin/content/competencies/assign');
  };
  
  const handleCloseCreateModal = () => {
    if (isSaving || isCheckingName) return;
    setIsCreateModalOpen(false);
  };

  const handleEditCompetencyClick = (comp: CompetencyRow) => {
    setModalMode("edit");
    setEditingCompetencyId(comp.id);
    setIsActive(comp.is_active);
    setIsArchived(comp.is_archived);

    setName(comp.title ?? "");
    setDescription(comp.description ?? "");
    setValidityDays(
      comp.validity_days != null ? String(comp.validity_days) : ""
    );

    setNameStatus("idle");
    setNameError(null);
    setIsCreateModalOpen(true);
  };

  const handleToggleArchive = async (comp: CompetencyRow) => {
    if (!comp.is_archived && comp.is_active) {
      // This check prevents the action, but the UI tooltip explains why.
      return;
    }

    setUpdatingArchiveId(comp.id);
    setCompetenciesError(null);

    const { error } = await supabase.rpc("update_competency", {
      p_id: comp.id,
      p_title: comp.title,
      p_description: comp.description,
      p_validity_days: comp.validity_days,
      p_is_active: comp.is_active,
      p_is_archived: !comp.is_archived,
    });

    if (error) {
      console.error("Error updating competency archive status", error);
      setCompetenciesError(
        error.message || "Could not update competency status. Please try again."
      );
      setUpdatingArchiveId(null);
      return;
    }

    await fetchCompetencies();
    setUpdatingArchiveId(null);
  };

  const checkNameAvailability = async (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      setNameStatus("idle");
      setNameError("Competency name is required.");
      return;
    }

    setIsCheckingName(true);
    setNameError(null);

    const { data, error } = await supabase.rpc("check_competency_title_available", {
      p_title: trimmed,
    });

    setIsCheckingName(false);

    if (error) {
      console.error("Error checking competency name", error);
      setNameStatus("idle");
      setNameError("Could not check name. Please try again.");
      return;
    }

    if (data === true) {
      setNameStatus("available");
      setNameError(null);
    } else {
      setNameStatus("taken");
      setNameError("A competency with this name already exists.");
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setNameStatus("idle");
    setNameError(null);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // --- Derived Data for Rendering ---
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCompetencies = competencies.filter((comp) =>
    normalizedQuery === ""
      ? true
      : comp.title.toLowerCase().includes(normalizedQuery)
  );

  const totalResults = filteredCompetencies.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));

  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = pageStartIndex + PAGE_SIZE;

  const pagedCompetencies = filteredCompetencies.slice(
    pageStartIndex,
    pageEndIndex
  );

  const showingFrom = totalResults === 0 ? 0 : pageStartIndex + 1;
  const showingTo = Math.min(pageEndIndex, totalResults);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Link to="/admin/content" className="text-blue-600 hover:underline text-sm">&larr; Back to Content Management</Link>
      </div>

      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Manage Competencies
          </h1>
          <p className="mt-1 text-sm md:text-base text-slate-600">
            Define and track skill competencies.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleAssignCompetenciesClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#153AC7] shadow-[0_4px_15px_rgba(0,0,0,0.06)] ring-1 ring-inset ring-slate-200 transition-all duration-200 hover:-translate-y-px hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#153AC7]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 00-1 1v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1a1 1 0 00-1-1z" /></svg>
            <span>Assign Competencies</span>
          </button>
          <button
            type="button"
            onClick={handleCreateCompetencyClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#153AC7] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(21,58,199,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0f2da0] hover:shadow-[0_14px_36px_rgba(21,58,199,0.25)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#153AC7]"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg bg-white/15"><span className="text-lg leading-none">＋</span></span>
            <span>Create Competency</span>
          </button>
        </div>
      </div>
      
      <FavoritesSection />

      <section className="mt-8">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Competencies
          </h2>

          <div className="flex items-center gap-3">
            {isLoadingCompetencies ? (
              <span className="hidden text-xs text-slate-500 md:inline">
                Loading…
              </span>
            ) : competenciesError ? (
              <button
                type="button"
                onClick={fetchCompetencies}
                className="hidden text-xs font-medium text-[#153AC7] hover:underline md:inline"
              >
                Retry
              </button>
            ) : null}

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by competency name…"
                className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#153AC7] focus:outline-none focus:ring-1 focus:ring-[#153AC7]"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                🔍
              </span>
            </div>
          </div>
        </div>
        
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {isLoadingCompetencies && (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Loading competencies…
            </div>
          )}

          {!isLoadingCompetencies && competenciesError && (
            <div className="px-6 py-10 text-center text-sm text-red-600">
              {competenciesError}
            </div>
          )}

          {!isLoadingCompetencies &&
            !competenciesError &&
            totalResults === 0 && (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                {searchQuery ? (
                  <>No competencies found for "{searchQuery}".</>
                ) : (
                  <>
                    No competencies have been created yet.
                    <br />
                    Use the <span className="font-semibold">Create Competency</span> button above to add your first one.
                  </>
                )}
              </div>
            )}

          {!isLoadingCompetencies &&
            !competenciesError &&
            totalResults > 0 && (
              <>
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th
                        scope="col"
                        className="py-3 pl-6 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        Competency Name
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        Description
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        Valid for
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Status
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pagedCompetencies.map((comp) => (
                      <tr key={comp.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap py-3 pl-6 pr-3 text-sm font-medium text-slate-900">
                          {comp.title}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600">
                          {comp.description || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600">
                          {comp.validity_days
                            ? `${comp.validity_days} day${comp.validity_days === 1 ? "" : "s"}`
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {comp.is_archived ? (
                            <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                              Archived
                            </span>
                          ) : comp.is_active ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="relative px-3 py-3 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditCompetencyClick(comp)}
                              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <div className="relative group">
                              <button
                                type="button"
                                onClick={() => handleToggleArchive(comp)}
                                disabled={
                                  updatingArchiveId === comp.id ||
                                  (!comp.is_archived && comp.is_active)
                                }
                                className={`rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed ${
                                  comp.is_archived
                                    ? "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    : "border border-amber-300 text-amber-700 hover:bg-amber-50"
                                }`}
                              >
                                {updatingArchiveId === comp.id
                                  ? "Updating..."
                                  : comp.is_archived
                                  ? "Restore"
                                  : "Archive"}
                              </button>
                              {comp.is_active && !comp.is_archived && (
                                <span
                                  className="pointer-events-none absolute right-0 top-full mt-2 w-max max-w-[260px]
                                             rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white
                                             shadow-lg ring-1 ring-black/10 opacity-0 translate-y-1
                                             group-hover:opacity-100 group-hover:translate-y-0
                                             transition-all duration-200 z-20"
                                >
                                  This competency is currently active. Please mark it Inactive before archiving.
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!isLoadingCompetencies && !competenciesError && totalResults > 0 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                    <span>
                      Showing {showingFrom}–{showingTo} of {totalResults} competencies
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                      >
                        Previous
                      </button>
                      <span>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
        </div>
      </section>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title={modalMode === "create" ? "Create Competency" : "Edit Competency"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmedName = name.trim();
            if (!trimmedName) {
              setNameError("Competency name is required.");
              return;
            }
            if (nameStatus === "taken") {
              setNameError("A competency with this name already exists.");
              return;
            }
            if (modalMode === "create") {
              void saveCompetency();
              return;
            }
            setConfirmUpdateText("");
            setIsConfirmUpdateOpen(true);
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Competency Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              onBlur={() => checkNameAvailability(name)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#153AC7] focus:ring-2 focus:ring-[#153AC7]"
              placeholder="e.g. Working at Heights"
              disabled={isSaving}
            />
            <div className="mt-1 text-xs h-4">
              {isCheckingName && (
                <span className="text-slate-500">Checking name…</span>
              )}
              {!isCheckingName && nameStatus === "available" && (
                <span className="text-emerald-600">Name is available.</span>
              )}
              {nameError && (
                <span className="block text-red-600">{nameError}</span>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description 
              <span className="ml-1 text-sm font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#153AC7] focus:ring-2 focus:ring-[#153AC7]"
              placeholder="Short description of this competency…"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Valid for (days)
              <span className="ml-1 text-sm font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="number"
              min={1}
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#153AC7] focus:ring-2 focus:ring-[#153AC7]"
              placeholder="e.g. 365"
              disabled={isSaving}
            />
            <p className="mt-1 text-xs text-slate-500">
              If provided, this will be used as the default expiry period for this competency.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-slate-700">Active</span>
            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCloseCreateModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={isSaving || isCheckingName}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSaving ||
                isCheckingName ||
                !name.trim() ||
                nameStatus === "taken"
              }
              className="inline-flex items-center justify-center rounded-lg bg-[#0084FF] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0073e6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save Competency"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isConfirmUpdateOpen}
        onClose={() => {
          if (!isSaving) {
            setIsConfirmUpdateOpen(false);
          }
        }}
        title="Confirm competency update"
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            You are about to update this competency. These changes may affect
            users, training records, and reporting wherever this competency is used.
          </p>
          <p className="text-slate-600">
            To confirm, type <span className="font-semibold">UPDATE</span> in the box below
            and then click <span className="font-semibold">Confirm</span>.
          </p>
      
          <input
            type="text"
            value={confirmUpdateText}
            onChange={(e) => setConfirmUpdateText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#153AC7] focus:outline-none focus:ring-1 focus:ring-[#153AC7]"
            placeholder="Type UPDATE to confirm"
          />
      
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (!isSaving) setIsConfirmUpdateOpen(false);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveCompetency()}
              disabled={isSaving || confirmUpdateText.trim() !== "UPDATE"}
              className="rounded-lg bg-[#153AC7] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f2da0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AdminCompetencies;