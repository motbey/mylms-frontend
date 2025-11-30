import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import FavoritesSection from "../../components/FavoritesSection";
import {
  getGroup,
  getGroupMemberProfilesWithStatus,
  excludeUserFromGroup,
  includeUserInGroup,
  type Group,
  type GroupMemberProfileWithStatus,
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

const AssignedGroupUsersPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);

  const [members, setMembers] = useState<GroupMemberProfileWithStatus[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "included" | "excluded"
  >("all");

  const loadGroup = async () => {
    if (!groupId) return;
    setIsLoading(true);
    try {
      const g = await getGroup(groupId);
      setGroup(g);
    } catch (err: any) {
      console.error("Failed to load group", err);
      setToast({
        message: err?.message || "Failed to load group details.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMembers = async () => {
    if (!groupId) return;
    setLoadingMembers(true);
    try {
      const data = await getGroupMemberProfilesWithStatus(groupId);
      setMembers(data);
    } catch (err: any) {
      console.error("Failed to load assigned users", err);
      setToast({
        message: err?.message || "Failed to load assigned users.",
        type: "error",
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadGroup();
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const handleRefresh = () => {
    loadMembers();
  };

  const handleExclude = async (member: GroupMemberProfileWithStatus) => {
    if (!groupId) return;

    const name =
      [member.first_name, member.last_name].filter(Boolean).join(" ") ||
      member.email ||
      "this user";

    const typed = window.prompt(
      `Are you sure you want to EXCLUDE ${name} from this group?\n\nThey will no longer receive training assigned via this learner group.\n\nType EXCLUDE in all caps to confirm.`
    );

    if (typed !== "EXCLUDE") {
      return;
    }

    try {
      await excludeUserFromGroup(groupId, member.user_id);
      await loadMembers();
      setToast({
        message: `${name} has been excluded from this group.`,
        type: "success",
      });
    } catch (err: any) {
      console.error("Failed to exclude user", err);
      setToast({
        message: err?.message || "Failed to exclude user.",
        type: "error",
      });
    }
  };

  const handleInclude = async (member: GroupMemberProfileWithStatus) => {
    if (!groupId) return;

    const name =
      [member.first_name, member.last_name].filter(Boolean).join(" ") ||
      member.email ||
      "this user";

    const ok = window.confirm(
      `Include ${name} back in this group?\n\nThey will again receive training assigned via this learner group.`
    );
    if (!ok) return;

    try {
      await includeUserInGroup(groupId, member.user_id);
      await loadMembers();
      setToast({
        message: `${name} has been included in this group.`,
        type: "success",
      });
    } catch (err: any) {
      console.error("Failed to include user", err);
      setToast({
        message: err?.message || "Failed to include user.",
        type: "error",
      });
    }
  };

  // ---------- FILTERED MEMBERS ----------
  const filteredMembers = members.filter((m) => {
    const term = searchTerm.trim().toLowerCase();

    // status filter
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "included"
        ? !m.is_excluded
        : m.is_excluded;

    if (!matchesStatus) return false;

    if (!term) return true;

    const haystack = `${m.first_name ?? ""} ${m.last_name ?? ""} ${
      m.email ?? ""
    }`.toLowerCase();

    return haystack.includes(term);
  });
  // --------------------------------------

  const title = group ? `Users currently assigned to ${group.name}` : "";

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      <Link
        to="/admin/groups"
        className="text-sm text-secondary hover:underline"
      >
        &larr; Back to User Groups
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-primary">Assigned Users</h1>
        {title && <p className="mt-1 text-gray-600">{title}</p>}
      </div>

      <FavoritesSection />

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md ring-1 ring-gray-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Assigned Users</h2>
            <p className="text-sm text-gray-600">
              This list shows all users who are currently members of this group.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loadingMembers}
            className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loadingMembers ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* FILTERS ROW */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Filter by name or email
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Start typing a name or email…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:ring-secondary"
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "included" | "excluded"
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:ring-secondary"
            >
              <option value="all">All statuses</option>
              <option value="included">Included</option>
              <option value="excluded">Excluded</option>
            </select>
          </div>
        </div>
        {/* END FILTERS ROW */}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="py-3 px-4 font-semibold text-gray-700">Name</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Email</th>
                <th className="py-3 px-4 font-semibold text-gray-700">Role</th>
                <th className="py-3 px-4 font-semibold text-gray-700">
                  Company
                </th>
                <th className="py-3 px-4 font-semibold text-gray-700">
                  Job Title
                </th>
                <th className="py-3 px-4 font-semibold text-gray-700">State</th>
                <th className="py-3 px-4 font-semibold text-gray-700">
                  Location
                </th>
                <th className="py-3 px-4 font-semibold text-gray-700">
                  Status
                </th>
                <th className="py-3 px-4 font-semibold text-gray-700 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-4 px-4 text-center text-gray-500"
                  >
                    {loadingMembers
                      ? "Loading users..."
                      : "No users match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const name =
                    [member.first_name, member.last_name]
                      .filter(Boolean)
                      .join(" ") || "—";

                  const rowClasses = member.is_excluded
                    ? "bg-gray-50 text-gray-500"
                    : "hover:bg-neutral/50";

                  return (
                    <tr key={member.user_id} className={rowClasses}>
                      <td className="py-3 px-4 font-medium">{name}</td>
                      <td className="py-3 px-4">{member.email || "—"}</td>
                      <td className="py-3 px-4">{member.role || "—"}</td>
                      <td className="py-3 px-4">
                        {(member as any).company || member.company_id || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {(member as any).job_title ||
                          member.job_title_id ||
                          "—"}
                      </td>
                      <td className="py-3 px-4">{member.state_code || "—"}</td>
                      <td className="py-3 px-4">
                        {(member as any).location || member.location_id || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {member.is_excluded ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                            Excluded
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                            Included
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {member.is_excluded ? (
                          <button
                            type="button"
                            onClick={() => handleInclude(member)}
                            className="text-sm font-semibold text-secondary hover:underline"
                          >
                            Include
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleExclude(member)}
                            className="text-sm font-semibold text-red-600 hover:underline"
                          >
                            Exclude
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AssignedGroupUsersPage;
