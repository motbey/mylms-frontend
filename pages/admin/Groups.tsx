import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FavoritesSection from "../../components/FavoritesSection";
import {
  getGroupsWithMemberCounts,
  createGroup,
  deleteGroup,
  type GroupWithMemberCount,
} from "../../lib/api/groups";

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

const AdminGroups: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupWithMemberCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadGroups = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getGroupsWithMemberCounts();
      setGroups(data);
    } catch (err: any) {
      console.error("Failed to load groups", err);
      setLoadError(err?.message || "Failed to load groups. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const openCreateModal = () => {
    setNewGroupName("");
    setNewGroupType("");
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isSaving) return;
    setIsCreateModalOpen(false);
    setNewGroupName("");
    setNewGroupType("");
    setFormError(null);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = newGroupName.trim();
    if (!name) {
      setFormError("Group name is required.");
      return;
    }

    setIsSaving(true);
    try {
      await createGroup({
        name,
        type: newGroupType.trim() || null,
      });

      setToast({
        message: "Group created successfully.",
        type: "success",
      });
      closeCreateModal();
      await loadGroups();
    } catch (err: any) {
      console.error("Failed to create group", err);
      setFormError(err?.message || "Failed to create group. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async (group: GroupWithMemberCount) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteGroup(group.id);
      setToast({
        message: "Group deleted successfully.",
        type: "success",
      });
      await loadGroups();
    } catch (err: any) {
      console.error("Failed to delete group", err);
      setToast({
        message: err?.message || "Failed to delete group. Please try again.",
        type: "error",
      });
    }
  };

  const handleManageGroup = (group: GroupWithMemberCount) => {
    navigate(`/admin/groups/${group.id}`);
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
            to="/admin"
            className="text-sm text-secondary hover:underline"
          >
            &larr; Back to Admin Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-primary mt-2">User Groups</h1>
          <p className="mt-2 text-gray-600">
            Create and manage dynamic user groups based on profile fields.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          New Group
        </button>
      </div>

      <FavoritesSection />

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md ring-1 ring-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">All Groups</h2>

        {isLoading ? (
          <p className="text-gray-500 text-center py-4">Loading groups…</p>
        ) : loadError ? (
          <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {loadError}
          </div>
        ) : groups.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No groups have been created yet. Click &quot;New Group&quot; to create one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="py-3 px-4 font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-700">
                    Members
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-700">
                    Created At
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-700 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groups.map((group) => (
                  <tr key={group.id} className="hover:bg-neutral/50 transition-colors">
                    <td className="py-3 px-4 text-gray-800 font-medium">
                      {group.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {group.type || (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {group.member_count ?? 0}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatDate(group.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Link
                        to={`/admin/groups/${group.id}/assigned-users`}
                        className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Assigned Users
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleManageGroup(group)}
                        className="px-3 py-1 text-xs font-semibold rounded-md border border-secondary text-secondary hover:bg-secondary hover:text-white transition-colors"
                      >
                        Manage
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group)}
                        className="px-3 py-1 text-xs font-semibold rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Delete
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
        title="New Group"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {formError}
            </div>
          )}

          <div>
            <label
              htmlFor="group-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              id="group-name"
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. NSW Managers"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
              required
            />
          </div>

          <div>
            <label
              htmlFor="group-type"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Type (optional)
            </label>
            <input
              id="group-type"
              type="text"
              value={newGroupType}
              onChange={(e) => setNewGroupType(e.target.value)}
              placeholder="e.g. department, region, team"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              A label to categorize this group (for your reference only).
            </p>
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
              {isSaving ? "Creating…" : "Create Group"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminGroups;
