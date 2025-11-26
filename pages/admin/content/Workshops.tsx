import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FavoritesSection from "../../../components/FavoritesSection";
import {
  listWorkshops,
  createWorkshop,
  type Workshop,
  type WorkshopDeliveryMode,
} from "../../../lib/api/workshops";
import { supabase } from "../../../lib/supabaseClient";

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

const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 sm:px-6"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg transform rounded-2xl bg-white shadow-xl transition-all max-h-[85vh] overflow-hidden flex flex-col"
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

const FormInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { label: string }
> = ({ label, id, ...props }) => (
  <div>
    <label
      htmlFor={id}
      className="block text-sm font-medium text-gray-700 mb-1"
    >
      {label}
    </label>
    <input
      id={id}
      {...props}
      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm disabled:bg-gray-100 placeholder:text-gray-400"
    />
  </div>
);

const formatWorkshopDate = (dateString: string | null) => {
  if (!dateString) {
    return <span className="text-gray-400 italic">Not set</span>;
  }
  // Stored as YYYY-MM-DD in DB
  const d = new Date(`${dateString}T00:00:00`);
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatWorkshopTime = (isoString: string | null) => {
  if (!isoString) {
    return <span className="text-gray-400 italic">Not set</span>;
  }
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const AdminWorkshops: React.FC = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Session count map: { workshop_id: count }
  const [sessionCountMap, setSessionCountMap] = useState<Record<string, number>>({});

  const [toast, setToast] = useState<ToastState>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryMode, setDeliveryMode] =
    useState<WorkshopDeliveryMode>("onsite");
  const [location, setLocation] = useState("");
  const [maxSeats, setMaxSeats] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [allowSelfEnrol, setAllowSelfEnrol] = useState(true);
  const [workshopDate, setWorkshopDate] = useState(""); // YYYY-MM-DD
  const [startTime, setStartTime] = useState(""); // HH:mm (24h)
  const [endTime, setEndTime] = useState(""); // HH:mm (24h)
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadWorkshops = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await listWorkshops();
      setWorkshops(data);
    } catch (err: any) {
      console.error("Failed to load workshops", err);
      setLoadError("Failed to load workshops. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionCounts = async () => {
    try {
      // Fetch all workshop sessions to build a count map
      const { data, error } = await supabase
        .from("workshop_sessions")
        .select("workshop_id");

      if (error) {
        console.error("Failed to load session counts", error);
        return;
      }

      // Build the count map
      const countMap: Record<string, number> = {};
      (data ?? []).forEach((session: { workshop_id: string }) => {
        const wid = session.workshop_id;
        countMap[wid] = (countMap[wid] || 0) + 1;
      });
      setSessionCountMap(countMap);
    } catch (err) {
      console.error("Failed to load session counts", err);
    }
  };

  useEffect(() => {
    loadWorkshops();
    loadSessionCounts();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDeliveryMode("onsite");
    setLocation("");
    setMaxSeats("");
    setIsMandatory(false);
    setAllowSelfEnrol(true);
    setWorkshopDate("");
    setStartTime("");
    setEndTime("");
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    if (isSaving) return;
    setIsCreateModalOpen(false);
  };

  const handleCreateWorkshop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Workshop title is required.");
      return;
    }

    if (!workshopDate) {
      setFormError("Workshop date is required.");
      return;
    }

    if (!startTime) {
      setFormError("Start time is required.");
      return;
    }

    if (!endTime) {
      setFormError("End time is required.");
      return;
    }

    let maxSeatsNumber: number | null = null;
    if (maxSeats.trim() !== "") {
      const parsed = parseInt(maxSeats, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        setFormError("Max seats must be a positive number.");
        return;
      }
      maxSeatsNumber = parsed;
    }

    // Build local datetimes from date + times (24h)
    const startDateTimeLocal = new Date(`${workshopDate}T${startTime}:00`);
    const endDateTimeLocal = new Date(`${workshopDate}T${endTime}:00`);

    if (
      Number.isNaN(startDateTimeLocal.getTime()) ||
      Number.isNaN(endDateTimeLocal.getTime())
    ) {
      setFormError("Please enter a valid date and time.");
      return;
    }

    if (endDateTimeLocal <= startDateTimeLocal) {
      setFormError("End time must be after start time.");
      return;
    }

    const startIso = startDateTimeLocal.toISOString();
    const endIso = endDateTimeLocal.toISOString();

    setIsSaving(true);
    try {
      const created = await createWorkshop({
        title: trimmedTitle,
        description: description.trim() || undefined,
        deliveryMode,
        location: location.trim() || undefined,
        maxSeats: maxSeatsNumber,
        isMandatory,
        allowSelfEnrol,
        workshopDate, // YYYY-MM-DD
        startDateTime: startIso,
        endDateTime: endIso,
      });

      setWorkshops((prev) => [created, ...prev]);
      setToast({
        message: `Workshop '${created.title}' created successfully.`,
        type: "success",
      });
      setIsCreateModalOpen(false);
    } catch (err: any) {
      console.error("Error creating workshop", err);
      setFormError(
        err?.message ||
          "An unexpected error occurred while creating the workshop."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to format session count text
  const formatSessionCount = (workshopId: string) => {
    const count = sessionCountMap[workshopId] || 0;
    return count === 1 ? "1 session" : `${count} sessions`;
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
            to="/admin/content"
            className="text-blue-600 hover:underline mb-4 inline-block text-sm"
          >
            &larr; Back to Content Management
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Workshops</h1>
          <p className="mt-2 text-gray-600">
            Create and manage workshop offerings and sessions.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            New Workshop
          </button>
        </div>
      </div>

      <FavoritesSection />

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md ring-1 ring-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">All Workshops</h2>
        {isLoading ? (
          <p className="text-gray-500 text-center py-4">Loading workshops…</p>
        ) : loadError ? (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {loadError}
          </div>
        ) : workshops.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No workshops have been created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Title
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Mode
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Location
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Mandatory
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Self-enrol
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Sessions
                  </th>
                  <th className="py-2 pr-4 font-semibold text-gray-700">
                    Created
                  </th>
                  <th className="py-2 pl-4 font-semibold text-gray-700 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {workshops.map((w) => (
                  <tr key={w.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium text-gray-800">
                      {w.title}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 capitalize">
                      {w.delivery_mode}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {w.location || (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {w.is_mandatory ? "Yes" : "No"}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {w.allow_self_enrol ? "Yes" : "No"}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {formatSessionCount(w.id)}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {new Date(w.created_at).toLocaleString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2 pl-4 text-right">
                      <Link
                        to={`/admin/content/workshops/${w.id}/sessions`}
                        className="px-3 py-1 bg-secondary text-white text-xs font-semibold rounded-md hover:opacity-90 transition-opacity"
                      >
                        Manage sessions
                      </Link>
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
        onClose={handleCloseCreateModal}
        title="Create Workshop"
      >
        <form onSubmit={handleCreateWorkshop} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {formError}
            </div>
          )}

          <FormInput
            label="Workshop title"
            id="workshop-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isSaving}
            placeholder="e.g. Site Induction – New Starters"
          />

          <div>
            <label
              htmlFor="workshop-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="workshop-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              placeholder="Brief overview of the workshop."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm disabled:bg-gray-100 placeholder:text-gray-400"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="workshop-date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Workshop date
              </label>
              <input
                id="workshop-date"
                type="date"
                value={workshopDate}
                onChange={(e) => setWorkshopDate(e.target.value)}
                disabled={isSaving}
                required
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm disabled:bg-gray-100"
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
                disabled={isSaving}
                required
                step={60}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm disabled:bg-gray-100"
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
                disabled={isSaving}
                required
                step={60}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="delivery-mode"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Delivery mode
              </label>
              <select
                id="delivery-mode"
                value={deliveryMode}
                onChange={(e) =>
                  setDeliveryMode(e.target.value as WorkshopDeliveryMode)
                }
                disabled={isSaving}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm disabled:bg-gray-100"
              >
                <option value="onsite">Onsite</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>

            <FormInput
              label="Max seats (optional)"
              id="max-seats"
              type="number"
              value={maxSeats}
              onChange={(e) => setMaxSeats(e.target.value)}
              min={0}
              disabled={isSaving}
              placeholder="e.g. 20"
            />
          </div>

          <FormInput
            label="Location (optional)"
            id="workshop-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isSaving}
            placeholder="e.g. Perth Head Office or MS Teams"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isMandatory}
                onChange={(e) => setIsMandatory(e.target.checked)}
                disabled={isSaving}
                className="rounded border-gray-300 text-secondary focus:ring-secondary"
              />
              Mandatory for assigned learners
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={allowSelfEnrol}
                onChange={(e) => setAllowSelfEnrol(e.target.checked)}
                disabled={isSaving}
                className="rounded border-gray-300 text-secondary focus:ring-secondary"
              />
              Allow self-enrolment
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={handleCloseCreateModal}
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
              {isSaving ? "Creating…" : "Create workshop"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminWorkshops;
