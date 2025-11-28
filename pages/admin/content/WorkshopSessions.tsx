import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import FavoritesSection from "../../../components/FavoritesSection";
import {
  listSessionsForWorkshop,
  type WorkshopSession,
  createWorkshopSession,
  updateWorkshopSession,
} from "../../../lib/api/workshopSessions";
import {
  searchActiveProfiles,
  type ProfileSummary,
} from "../../../lib/api/profiles";
import { listCompanies, type Company } from "../../../lib/api/companies";
import {
  enrolCompanyInSession,
  enrolUserInWorkshopSession,
  listEnrolmentsForSession,
  deleteWorkshopEnrolment,
  type WorkshopEnrolment,
} from "../../../lib/api/workshopEnrolments";

type ToastState = { message: string; type: "success" | "error" } | null;

const Toast: React.FC<{
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}> = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const baseClasses =
    "fixed top-20 right-5 z-50 px-4 py-3 rounded-md shadow-lg text-white animate-fade-in-down";
  const typeClasses = type === "error" ? "bg-red-600" : "bg-green-600";

  return <div className={`${baseClasses} ${typeClasses}`}>{message}</div>;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const Modal: React.FC<{
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, title, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 sm:px-6"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl transform rounded-2xl bg-white shadow-xl transition-all max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-3xl font-light"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

const WorkshopSessionsPage: React.FC = () => {
  const { workshopId } = useParams<{ workshopId: string }>();
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Modal + form state for creating a session
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [locationOverride, setLocationOverride] = useState("");
  const [maxSeatsOverride, setMaxSeatsOverride] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Editing state
  const [editingSession, setEditingSession] = useState<WorkshopSession | null>(
    null
  );

  // Cancel modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [sessionBeingCancelled, setSessionBeingCancelled] =
    useState<WorkshopSession | null>(null);
  const [cancelConfirmText, setCancelConfirmText] = useState("");

  // When editing a cancelled session, we show a warning first
  const [cancelledEditSession, setCancelledEditSession] =
    useState<WorkshopSession | null>(null);

  // Enrol users modal state
  const [isEnrolModalOpen, setIsEnrolModalOpen] = useState(false);
  const [enrolSession, setEnrolSession] = useState<WorkshopSession | null>(null);

  // Search + selection state for enrol modal
  const [userSearch, setUserSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<ProfileSummary[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<ProfileSummary[]>([]);
  const [enrolFormError, setEnrolFormError] = useState<string | null>(null);

  // Company-wide enrolment state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [isEnrollingCompany, setIsEnrollingCompany] = useState(false);

  // Individual user enrolment loading state
  const [isEnrollingUsers, setIsEnrollingUsers] = useState(false);

  // View enrolments modal state
  const [isEnrolmentsModalOpen, setIsEnrolmentsModalOpen] = useState(false);
  const [enrolmentsLoading, setEnrolmentsLoading] = useState(false);
  const [enrolmentsError, setEnrolmentsError] = useState<string | null>(null);
  const [enrolments, setEnrolments] = useState<WorkshopEnrolment[]>([]);
  const [enrolmentsSession, setEnrolmentsSession] = useState<WorkshopSession | null>(null);

  const loadSessions = async () => {
    if (!workshopId) {
      setLoadError("No workshop selected.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await listSessionsForWorkshop(workshopId);
      setSessions(data);
    } catch (err: any) {
      console.error("Failed to load workshop sessions", err);
      setLoadError("Failed to load workshop sessions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  const resetForm = () => {
    setSessionDate("");
    setStartTime("");
    setEndTime("");
    setLocationOverride("");
    setMaxSeatsOverride("");
    setFacilitator("");
    setFormError(null);
    setEditingSession(null);
  };

  const openCreateModal = () => {
    if (isSaving) return;
    setEditingSession(null);
    resetForm();
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isSaving) return;
    setIsCreateModalOpen(false);
    resetForm();
    setEditingSession(null);
  };

  const combineToIso = (date: string, time: string) => {
    // date from <input type="date"> is yyyy-mm-dd
    // time from <input type="time"> is HH:MM (24-hour)
    return new Date(`${date}T${time}:00`).toISOString();
  };

  const isoToDateInput = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isoToTimeInput = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const beginEditingSession = (session: WorkshopSession) => {
    setEditingSession(session);
    setSessionDate(isoToDateInput(session.start_at));
    setStartTime(isoToTimeInput(session.start_at));
    setEndTime(isoToTimeInput(session.end_at));
    setLocationOverride(session.location_override ?? "");
    setMaxSeatsOverride(
      session.max_seats_override !== null
        ? String(session.max_seats_override)
        : ""
    );
    setFacilitator(session.facilitator ?? "");
    setFormError(null);
  };

  const handleEditClick = (session: WorkshopSession) => {
    if (session.is_cancelled) {
      // Show the warning modal instead of jumping straight to edit
      setCancelledEditSession(session);
    } else {
      beginEditingSession(session);
      setIsCreateModalOpen(true);
    }
  };

  const confirmEditCancelledSession = () => {
    if (!cancelledEditSession) return;

    // Actually open the edit modal with pre-filled fields
    beginEditingSession(cancelledEditSession);
    setIsCreateModalOpen(true);
    setCancelledEditSession(null);
  };

  const closeCancelledEditModal = () => {
    setCancelledEditSession(null);
  };

  const loadCompanies = async () => {
    setIsLoadingCompanies(true);
    setCompaniesError(null);
    try {
      const data = await listCompanies();
      setCompanies(data);
    } catch (err) {
      console.error("Failed to load companies", err);
      setCompaniesError("Failed to load companies. Please try again.");
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const handleOpenEnrolModal = (session: WorkshopSession) => {
    setEnrolSession(session);
    setUserSearch("");
    setUserSearchResults([]);
    setSelectedUsers([]);
    setEnrolFormError(null);
    setSelectedCompanyId("");
    setIsEnrolModalOpen(true);

    // Load companies if not already loaded
    if (companies.length === 0) {
      loadCompanies();
    }
  };

  const handleCloseEnrolModal = () => {
    setIsEnrolModalOpen(false);
    setEnrolSession(null);
    setUserSearch("");
    setUserSearchResults([]);
    setSelectedUsers([]);
    setEnrolFormError(null);
    setSelectedCompanyId("");
  };

  const handleEnrolCompany = async () => {
    if (!enrolSession || !selectedCompanyId) return;

    setIsEnrollingCompany(true);
    try {
      const result = await enrolCompanyInSession({
        sessionId: enrolSession.id,
        companyId: selectedCompanyId,
        enrolmentType: "company",
        isMandatory: true,
      });

      const { createdCount, skippedCount, totalTargets } = result;

      // Build user-friendly toast message based on the result
      let message: string;
      if (totalTargets === 0) {
        message = "No eligible users found for this company.";
      } else if (skippedCount === 0) {
        message = `Enrolled ${createdCount} user(s) into this session.`;
      } else {
        message = `Enrolled ${createdCount} user(s). ${skippedCount} user(s) were already enrolled in this workshop.`;
      }

      setToast({
        message,
        type: "success",
      });

      // Reset selection after successful enrolment
      setSelectedCompanyId("");
      // TODO: Reload session enrolments if this page displays them
    } catch (err) {
      console.error("Failed to enrol company", err);
      setToast({
        message: "Failed to enrol company. Please try again.",
        type: "error",
      });
    } finally {
      setIsEnrollingCompany(false);
    }
  };

  const handleEnrolSelectedUsers = async () => {
    if (!enrolSession) return;
    if (!selectedUsers.length) {
      setToast({
        message: "Please select at least one user to enrol.",
        type: "error",
      });
      return;
    }

    setIsEnrollingUsers(true);
    try {
      const sessionId = enrolSession.id;
      const userIds = selectedUsers.map((u) => u.user_id);

      const results = await Promise.allSettled(
        userIds.map((userId) =>
          enrolUserInWorkshopSession({
            sessionId,
            userId,
            enrolmentType: "manual",
            isMandatory: false,
          })
        )
      );

      let hadDuplicate = false;
      let hadOtherError = false;

      results.forEach((result) => {
        if (result.status === "rejected") {
          const err: any = result.reason;
          const msg = err?.message || "";

          if (
            typeof msg === "string" &&
            msg.toLowerCase().includes("learner_already_enrolled_in_workshop")
          ) {
            hadDuplicate = true;
          } else {
            hadOtherError = true;
            console.error("Failed to enrol user", err);
          }
        }
      });

      if (hadOtherError) {
        setToast({
          message: "Failed to enrol one or more learners. Please try again.",
          type: "error",
        });
      } else {
        setToast({
          message: "Learner(s) enrolled successfully.",
          type: "success",
        });
      }

      if (hadDuplicate) {
        // Show a second toast for the duplicate case
        // Use setTimeout to ensure both toasts can be seen
        setTimeout(() => {
          setToast({
            message: "Learner already enrolled in this workshop.",
            type: "error",
          });
        }, 100);
      }

      // Clear selection and close modal
      setSelectedUsers([]);
      setIsEnrolModalOpen(false);
      // TODO: Reload session enrolments if this page displays them
    } finally {
      setIsEnrollingUsers(false);
    }
  };

  // Search handler with simple debounce
  useEffect(() => {
    let isCancelled = false;

    const runSearch = async () => {
      const q = userSearch.trim();
      if (!q) {
        setUserSearchResults([]);
        return;
      }

      setIsSearchingUsers(true);
      try {
        const results = await searchActiveProfiles(q, 10);
        if (!isCancelled) {
          // Exclude already selected users
          const selectedIds = new Set(selectedUsers.map((u) => u.user_id));
          setUserSearchResults(results.filter((r) => !selectedIds.has(r.user_id)));
        }
      } catch (err) {
        console.error("searchActiveProfiles failed", err);
        if (!isCancelled) {
          setEnrolFormError("Failed to search users. Please try again.");
        }
      } finally {
        if (!isCancelled) {
          setIsSearchingUsers(false);
        }
      }
    };

    // simple debounce: 300ms
    if (userSearch.trim()) {
      const handle = setTimeout(runSearch, 300);
      return () => {
        isCancelled = true;
        clearTimeout(handle);
      };
    } else {
      setUserSearchResults([]);
    }
  }, [userSearch, selectedUsers]);

  const handleAddUser = (profile: ProfileSummary) => {
    setSelectedUsers((prev) => {
      if (prev.some((p) => p.user_id === profile.user_id)) return prev;
      return [...prev, profile];
    });
    setUserSearch("");
    setUserSearchResults([]);
    setEnrolFormError(null);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((p) => p.user_id !== userId));
  };

  const handleViewEnrolments = async (session: WorkshopSession) => {
    setEnrolmentsSession(session);
    setIsEnrolmentsModalOpen(true);
    setEnrolments([]);
    setEnrolmentsError(null);
    setEnrolmentsLoading(true);
    try {
      const data = await listEnrolmentsForSession(session.id);
      setEnrolments(data);
    } catch (err: any) {
      console.error("Failed to load enrolments", err);
      setEnrolmentsError("Failed to load enrolments. Please try again.");
    } finally {
      setEnrolmentsLoading(false);
    }
  };

  const handleRemoveEnrolment = async (enrolmentId: string) => {
    if (!enrolmentId) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this learner from this session?"
    );
    if (!confirmed) return;

    try {
      await deleteWorkshopEnrolment(enrolmentId);

      // Update local state to remove the enrolment from the list
      setEnrolments((prev) => prev.filter((e) => e.id !== enrolmentId));

      setToast({
        message: "Removed learner from this session.",
        type: "success",
      });
    } catch (error) {
      console.error("handleRemoveEnrolment error", error);
      setToast({
        message: "Failed to remove learner from this session. Please try again.",
        type: "error",
      });
    }
  };

  const openCancelModal = (session: WorkshopSession) => {
    setSessionBeingCancelled(session);
    setCancelConfirmText("");
    setIsCancelModalOpen(true);
  };

  const closeCancelModal = () => {
    if (isSaving) return;
    setIsCancelModalOpen(false);
    setSessionBeingCancelled(null);
    setCancelConfirmText("");
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!workshopId) {
      setFormError("No workshop selected.");
      return;
    }
    if (!sessionDate || !startTime || !endTime) {
      setFormError("Date, start time and end time are required.");
      return;
    }

    try {
      const startIso = combineToIso(sessionDate, startTime);
      const endIso = combineToIso(sessionDate, endTime);

      if (new Date(endIso) <= new Date(startIso)) {
        setFormError("End time must be after start time.");
        return;
      }

      const maxSeats =
        maxSeatsOverride.trim() === ""
          ? null
          : Number.isNaN(Number(maxSeatsOverride))
          ? null
          : Number(maxSeatsOverride);

      setIsSaving(true);
      await createWorkshopSession({
        workshopId,
        startDateTime: startIso,
        endDateTime: endIso,
        locationOverride: locationOverride.trim() || undefined,
        maxSeatsOverride: maxSeats,
        facilitator: facilitator.trim() || undefined,
      });

      setToast({
        message: "Session created successfully.",
        type: "success",
      });
      closeCreateModal();
      await loadSessions();
    } catch (err: any) {
      console.error("Failed to create workshop session", err);
      setFormError(
        err?.message || "An unexpected error occurred while creating session."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!workshopId || !editingSession) {
      setFormError("No session selected for editing.");
      return;
    }
    if (!sessionDate || !startTime || !endTime) {
      setFormError("Date, start time and end time are required.");
      return;
    }

    const startIso = combineToIso(sessionDate, startTime);
    const endIso = combineToIso(sessionDate, endTime);

    if (new Date(endIso) <= new Date(startIso)) {
      setFormError("End time must be after start time.");
      return;
    }

    const maxSeats =
      maxSeatsOverride.trim() === ""
        ? null
        : Number.isNaN(Number(maxSeatsOverride))
        ? null
        : Number(maxSeatsOverride);

    try {
      setIsSaving(true);

      await updateWorkshopSession({
        sessionId: editingSession.id,
        startDateTime: startIso,
        endDateTime: endIso,
        locationOverride: locationOverride.trim(),
        maxSeatsOverride: maxSeats,
        facilitator: facilitator.trim(),
        // If it was cancelled, mark it as not cancelled after editing
        isCancelled: editingSession.is_cancelled ? false : undefined,
      });

      setToast({
        message: "Session updated successfully.",
        type: "success",
      });
      closeCreateModal();
      await loadSessions();
    } catch (err: any) {
      console.error("Failed to update workshop session", err);
      setFormError(
        err?.message || "An unexpected error occurred while updating session."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmCancelSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!sessionBeingCancelled) {
      setFormError("No session selected for cancellation.");
      return;
    }

    if (cancelConfirmText !== "CANCEL") {
      setFormError("You must type CANCEL to confirm.");
      return;
    }

    try {
      setIsSaving(true);

      await updateWorkshopSession({
        sessionId: sessionBeingCancelled.id,
        startDateTime: sessionBeingCancelled.start_at,
        endDateTime: sessionBeingCancelled.end_at,
        locationOverride: sessionBeingCancelled.location_override ?? "",
        maxSeatsOverride: sessionBeingCancelled.max_seats_override,
        facilitator: sessionBeingCancelled.facilitator ?? "",
        isCancelled: true,
      });

      setToast({
        message: "Session cancelled.",
        type: "success",
      });

      closeCancelModal();
      await loadSessions();
    } catch (err: any) {
      console.error("Failed to cancel workshop session", err);
      setFormError(
        err?.message || "An unexpected error occurred while cancelling session."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link
            to="/admin/content/workshops"
            className="text-blue-600 hover:underline mb-4 inline-block text-sm"
          >
            &larr; Back to Workshops
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            Workshop Sessions
          </h1>
          <p className="mt-2 text-gray-600">
            View and manage individual session times for this workshop.
          </p>
        </div>
        {workshopId && (
          <button
            type="button"
            onClick={openCreateModal}
            className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Add session
          </button>
        )}
      </div>

      <FavoritesSection />

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md ring-1 ring-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Sessions for this workshop
        </h2>
        {!workshopId ? (
          <p className="text-red-600 text-sm">
            No workshop ID provided in the URL.
          </p>
        ) : isLoading ? (
          <p className="text-gray-500 text-center py-4">Loading sessions…</p>
        ) : loadError ? (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {loadError}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No sessions have been created for this workshop yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Time
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Location
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Facilitator
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Max seats
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 text-gray-800">
                      {formatDate(s.start_at)}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {formatTime(s.start_at)}{" "}
                      <span className="text-gray-400">–</span>{" "}
                      {formatTime(s.end_at)}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {s.location_override || (
                        <span className="text-gray-400 italic">
                          Workshop default
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {s.facilitator || (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {s.max_seats_override ?? (
                        <span className="text-gray-400 italic">
                          Workshop default
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {s.is_cancelled ? "Cancelled" : "Scheduled"}
                    </td>
                    <td className="py-2 pr-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(s)}
                        className="px-3 py-1 text-xs font-semibold rounded-md border border-secondary text-secondary hover:bg-secondary hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!s.is_cancelled) openCancelModal(s);
                        }}
                        disabled={s.is_cancelled}
                        className={
                          s.is_cancelled
                            ? "px-3 py-1 text-xs font-semibold rounded-md border border-gray-300 text-gray-400 bg-gray-100 cursor-not-allowed"
                            : "px-3 py-1 text-xs font-semibold rounded-md border border-red-500 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                        }
                      >
                        {s.is_cancelled ? "Cancelled" : "Cancel"}
                      </button>
                      {!s.is_cancelled && (
                        <button
                          type="button"
                          onClick={() => handleOpenEnrolModal(s)}
                          className="px-3 py-1 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Enrol users
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleViewEnrolments(s)}
                        className="px-3 py-1 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        View enrolments
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title={editingSession ? "Edit session" : "Add session"}
      >
        <form
          onSubmit={editingSession ? handleUpdateSession : handleCreateSession}
          className="space-y-4"
        >
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label
                htmlFor="session-date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Session date
              </label>
              <input
                id="session-date"
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
                required
              />
            </div>
            <div>
              <label
                htmlFor="start-time"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Start time
              </label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
                required
              />
            </div>
            <div>
              <label
                htmlFor="end-time"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                End time
              </label>
              <input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="location-override"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Location (optional)
            </label>
            <input
              id="location-override"
              type="text"
              value={locationOverride}
              onChange={(e) => setLocationOverride(e.target.value)}
              placeholder="Leave blank to use workshop location"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="max-seats-override"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Max seats (optional)
              </label>
              <input
                id="max-seats-override"
                type="number"
                min="1"
                value={maxSeatsOverride}
                onChange={(e) => setMaxSeatsOverride(e.target.value)}
                placeholder="Leave blank to use workshop max seats"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="facilitator"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Facilitator (optional)
              </label>
              <input
                id="facilitator"
                type="text"
                value={facilitator}
                onChange={(e) => setFacilitator(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={isSaving}
              className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-wait"
            >
              {isSaving
                ? "Saving…"
                : editingSession
                ? "Save changes"
                : "Create session"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!cancelledEditSession}
        onClose={closeCancelledEditModal}
        title="Edit cancelled session?"
      >
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            This session is currently marked as <strong>Cancelled</strong>.
          </p>
          <p>
            You can still update its details (time, location, max seats, etc.).
            Editing it <strong>will automatically uncancel the session</strong>.
          </p>

          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={closeCancelledEditModal}
              className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md hover:bg-gray-200 transition-colors"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={confirmEditCancelledSession}
              className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-opacity"
            >
              Continue to edit
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isEnrolModalOpen}
        onClose={handleCloseEnrolModal}
        title="Enrol users"
      >
        {enrolSession === null ? (
          <p className="text-sm text-gray-500">No session selected.</p>
        ) : (
          <div className="space-y-6">
            {/* Session summary */}
            <div className="text-sm text-gray-700 bg-gray-50 rounded-md p-3">
              <p>
                <span className="font-medium">Date:</span>{" "}
                {formatDate(enrolSession.start_at)}
              </p>
              <p>
                <span className="font-medium">Time:</span>{" "}
                {formatTime(enrolSession.start_at)} –{" "}
                {formatTime(enrolSession.end_at)}
              </p>
            </div>

            {/* Error message */}
            {enrolFormError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {enrolFormError}
              </div>
            )}

            {/* Add individual users */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Add individual users
              </h3>

              {/* Selected users chips */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedUsers.map((u) => {
                    const name =
                      [u.first_name, u.last_name].filter(Boolean).join(" ") ||
                      u.email;
                    return (
                      <span
                        key={u.user_id}
                        className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-800"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => handleRemoveUser(u.user_id)}
                          className="text-gray-500 hover:text-gray-800"
                          aria-label={`Remove ${name}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => {
                    setEnrolFormError(null);
                    setUserSearch(e.target.value);
                  }}
                  placeholder="Search by name or email"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
                />
                {isSearchingUsers && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <span className="text-xs text-gray-400">Searching…</span>
                  </div>
                )}
              </div>

              {/* Search results dropdown */}
              {userSearchResults.length > 0 && (
                <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                  {userSearchResults.map((u) => {
                    const name =
                      [u.first_name, u.last_name].filter(Boolean).join(" ") ||
                      u.email;
                    return (
                      <button
                        key={u.user_id}
                        type="button"
                        onClick={() => handleAddUser(u)}
                        className="flex w-full items-start justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        <div>
                          <div className="font-medium text-gray-800">{name}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tiny helper text */}
              <p className="mt-1 text-xs text-gray-500">
                Start typing a name or email to add users. Only active users are shown.
              </p>
            </section>

            {/* Add groups */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Add groups
              </h3>
              <select
                disabled
                className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-gray-100 cursor-not-allowed"
              >
                <option>Group selection coming soon</option>
              </select>
            </div>

            {/* Company-wide enrolments */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Company-wide enrolments
              </h3>

              {companiesError && (
                <p className="text-xs text-red-600">{companiesError}</p>
              )}

              {isLoadingCompanies ? (
                <p className="text-xs text-gray-500">Loading companies…</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
                    disabled={isEnrollingCompany}
                  >
                    <option value="">Select a company…</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleEnrolCompany}
                    disabled={!enrolSession || !selectedCompanyId || isEnrollingCompany}
                    className="px-4 py-2 bg-secondary text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isEnrollingCompany ? "Enrolling…" : "Enrol company"}
                  </button>
                </div>
              )}

              <p className="text-xs text-gray-500">
                Select a company to enrol all its active users into this session.
              </p>
            </section>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={handleCloseEnrolModal}
                disabled={isEnrollingUsers}
                className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEnrolSelectedUsers}
                disabled={isEnrollingUsers || selectedUsers.length === 0}
                className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-opacity disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isEnrollingUsers ? "Enrolling…" : "Enrol users"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isCancelModalOpen}
        onClose={closeCancelModal}
        title="Cancel session"
      >
        <form onSubmit={handleConfirmCancelSession} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {formError}
            </div>
          )}

          <p className="text-sm text-gray-700">
            This will mark the session as{" "}
            <span className="font-semibold">Cancelled</span>. Learners will no
            longer be able to book or attend this session.
          </p>
          <p className="text-sm text-gray-700">
            To confirm, please type{" "}
            <span className="font-mono font-semibold">CANCEL</span> in the box
            below.
          </p>

          <input
            type="text"
            value={cancelConfirmText}
            onChange={(e) => setCancelConfirmText(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
            placeholder="Type CANCEL to confirm"
          />

          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={closeCancelModal}
              disabled={isSaving}
              className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving || cancelConfirmText !== "CANCEL"}
              className="px-6 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-opacity disabled:bg-red-300 disabled:cursor-not-allowed"
            >
              {isSaving ? "Cancelling…" : "Confirm cancel"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEnrolmentsModalOpen}
        onClose={() => {
          if (enrolmentsLoading) return;
          setIsEnrolmentsModalOpen(false);
          setEnrolmentsSession(null);
          setEnrolments([]);
          setEnrolmentsError(null);
        }}
        title={
          enrolmentsSession
            ? `Enrolments – ${formatDate(enrolmentsSession.start_at)} ${formatTime(enrolmentsSession.start_at)}`
            : "Enrolments"
        }
      >
        {enrolmentsLoading ? (
          <p className="text-gray-500 text-center py-4">Loading enrolments…</p>
        ) : enrolmentsError ? (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {enrolmentsError}
          </div>
        ) : enrolments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No learners are enrolled in this session yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Learner
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Enrolment type
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Mandatory?
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Attended?
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Attendance marked at
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {enrolments.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 text-gray-800">
                      <div className="font-medium">
                        {e.learner_name || "Unknown"}
                      </div>
                      {e.learner_email && (
                        <div className="text-xs text-gray-500">
                          {e.learner_email}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {e.enrolment_type ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {e.is_mandatory ? "Yes" : "No"}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{e.status}</td>
                    <td className="py-2 pr-4 text-gray-600">
                      {e.attended ? "Yes" : "No"}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {e.attended_at ? formatDate(e.attended_at) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveEnrolment(e.id)}
                        className="px-2 py-1 text-xs font-semibold rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WorkshopSessionsPage;
