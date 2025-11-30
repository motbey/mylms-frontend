import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import FavoritesSection from "../../components/FavoritesSection";
import MultiSelectFilter from "../../src/components/MultiSelectFilter";
import {
  getGroup,
  updateGroup,
  getGroupFilters,
  saveGroupFilters,
  getGroupMemberProfiles,
  assignGroupMembers,
  type Group,
  type GroupMemberProfile,
} from "../../lib/api/groups";
import { listCompanies } from "../../lib/api/companies";
import { listJobTitles } from "../../lib/api/jobTitles";
import { listLocations } from "../../lib/api/locations";
import { listStates } from "../../lib/api/states";

type ToastState = { message: string; type: "success" | "error" } | null;

type SelectOption = {
  value: string;
  label: string;
};

const getOptionLabel = (
  options: SelectOption[],
  value?: string | null
): string => {
  if (!value) return "—";
  const match = options.find((opt) => opt.value === value);
  return match?.label ?? value;
};

const ROLE_OPTIONS: SelectOption[] = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
  { value: "sub_admin", label: "Sub Admin" },
  { value: "security", label: "Security" },
];

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

type GroupFilterFormState = {
  role: string[] | null;
  company_id: string[] | null;
  job_title_id: string[] | null;
  state_code: string[] | null;
  location_id: string[] | null;
};

const emptyFilterState: GroupFilterFormState = {
  role: null,
  company_id: null,
  job_title_id: null,
  state_code: null,
  location_id: null,
};

const ManageGroupPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Group data
  const [group, setGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Filters
  const [filterForm, setFilterForm] =
    useState<GroupFilterFormState>(emptyFilterState);
  const [isSavingFilters, setIsSavingFilters] = useState(false);

  // Member preview
  const [memberPreview, setMemberPreview] = useState<GroupMemberProfile[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Collapse state for cards
  const [showDetails, setShowDetails] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Assign modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignConfirmText, setAssignConfirmText] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Dropdown options
  const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([]);
  const [jobTitleOptions, setJobTitleOptions] = useState<SelectOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<SelectOption[]>([]);
  const [stateOptions, setStateOptions] = useState<SelectOption[]>([]);

  // Load lookup data on mount
  useEffect(() => {
    let isMounted = true;

    async function loadLookups() {
      try {
        const [companies, jobTitles, locations, states] = await Promise.all([
          listCompanies(),
          listJobTitles(),
          listLocations(),
          listStates(),
        ]);

        if (!isMounted) return;

        setCompanyOptions([
          { value: "", label: "Any company" },
          ...companies.map((c) => ({ value: c.id, label: c.name })),
        ]);

        setJobTitleOptions([
          { value: "", label: "Any job title" },
          ...jobTitles.map((jt) => ({ value: jt.id, label: jt.name })),
        ]);

        setLocationOptions([
          { value: "", label: "Any location" },
          ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
        ]);

        setStateOptions([
          { value: "", label: "Any state" },
          ...states.map((s) => ({ value: s.code, label: s.name })),
        ]);
      } catch (error) {
        console.error("Failed to load group filters lookups", error);
      }
    }

    loadLookups();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load group and filters on mount
  useEffect(() => {
    const loadData = async () => {
      if (!groupId) {
        setLoadError("No group ID provided.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        // Load group details
        const groupData = await getGroup(groupId);
        if (!groupData) {
          setLoadError("Group not found.");
          setIsLoading(false);
          return;
        }
        setGroup(groupData);
        setGroupName(groupData.name);
        setGroupType(groupData.type || "");

        // Load filters
        const filters = await getGroupFilters(groupId);
        if (filters.length > 0) {
          const f = filters[0];
          setFilterForm({
            role: f.role ?? null,
            company_id: f.company_id ?? null,
            job_title_id: f.job_title_id ?? null,
            state_code: f.state_code ?? null,
            location_id: f.location_id ?? null,
          });
        } else {
          setFilterForm(emptyFilterState);
        }
      } catch (err: any) {
        console.error("Failed to load group", err);
        setLoadError(err?.message || "Failed to load group. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [groupId]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupId) return;

    const name = groupName.trim();
    if (!name) {
      setToast({ message: "Group name is required.", type: "error" });
      return;
    }

    setIsSavingDetails(true);
    try {
      const updated = await updateGroup(groupId, {
        name,
        type: groupType.trim() || null,
      });
      setGroup(updated);
      setToast({
        message: "Group details saved successfully.",
        type: "success",
      });
    } catch (err: any) {
      console.error("Failed to update group", err);
      setToast({
        message:
          err?.message || "Failed to save group details. Please try again.",
        type: "error",
      });
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSaveFilters = async () => {
    if (!groupId) return;

    const filtersToSave =
      !filterForm.role &&
      !filterForm.company_id &&
      !filterForm.job_title_id &&
      !filterForm.state_code &&
      !filterForm.location_id
        ? []
        : [
            {
              role: filterForm.role,
              company_id: filterForm.company_id,
              job_title_id: filterForm.job_title_id,
              state_code: filterForm.state_code,
              location_id: filterForm.location_id,
            },
          ];

    setIsSavingFilters(true);
    try {
      await saveGroupFilters(groupId, filtersToSave);
      setToast({
        message: "Group filters saved successfully.",
        type: "success",
      });
    } catch (err: any) {
      console.error("Failed to save filters", err);
      setToast({
        message: err?.message || "Failed to save filters. Please try again.",
        type: "error",
      });
    } finally {
      setIsSavingFilters(false);
    }
  };

  const handleRefreshPreview = async () => {
    if (!groupId) return;

    setLoadingPreview(true);
    try {
      const members = await getGroupMemberProfiles(groupId);
      setMemberPreview(members);
    } catch (err: any) {
      console.error("Failed to load member preview", err);
      setToast({
        message:
          err?.message || "Failed to load matching users. Please try again.",
        type: "error",
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleOpenAssignModal = () => {
    setAssignConfirmText("");
    setShowAssignModal(true);
  };

  const handleConfirmAssign = async () => {
    if (!groupId) return;
    if (assignConfirmText !== "ASSIGN") return;

    setIsAssigning(true);
    try {
      await assignGroupMembers(groupId);
      setShowAssignModal(false);
      setToast({
        message:
          "Learners have been assigned to this group based on the current rules.",
        type: "success",
      });
      // Optionally refresh the preview so the table reflects latest data
      await handleRefreshPreview();
    } catch (err: any) {
      console.error("Failed to assign learners", err);
      setToast({
        message: err?.message || "Failed to assign learners. Please try again.",
        type: "error",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-16">
        <p className="text-gray-500">Loading group...</p>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="animate-fade-in space-y-6">
        <Link
          to="/admin/groups"
          className="text-sm text-secondary hover:underline"
        >
          &larr; Back to User Groups
        </Link>
        <div className="bg-white p-6 rounded-2xl shadow-md ring-1 ring-gray-100">
          <div className="p-4 bg-red-50 text-red-700 rounded-md">
            {loadError}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div>
        <Link
          to="/admin/groups"
          className="text-sm text-secondary hover:underline"
        >
          &larr; Back to User Groups
        </Link>
        <h1 className="text-3xl font-bold text-primary mt-2">Manage Group</h1>
        {group && <p className="mt-1 text-gray-600">{group.name}</p>}
      </div>

      <FavoritesSection />

      {/* Group Details Card */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md ring-1 ring-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-800">Group Details</h2>
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-sm text-secondary hover:underline"
          >
            {showDetails ? "Hide" : "Show"}
          </button>
        </div>

        {showDetails && (
          <form onSubmit={handleSaveDetails} className="space-y-4 mt-2">
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
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. NSW Managers"
                className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
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
                value={groupType}
                onChange={(e) => setGroupType(e.target.value)}
                placeholder="e.g. department, region, team"
                className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                A label to categorize this group (for your reference only).
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingDetails}
                className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-wait"
              >
                {isSavingDetails ? "Saving..." : "Save Details"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filters Card */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md ring-1 ring-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Group Rules</h2>
            <p className="text-sm text-gray-600">
              Use these fields to define which users belong to this group. All
              non-empty fields are combined with AND.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRules((prev) => !prev)}
            className="ml-4 text-sm text-secondary hover:underline whitespace-nowrap"
          >
            {showRules ? "Hide" : "Show"}
          </button>
        </div>

        {showRules && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 mt-4">
              <MultiSelectFilter
                label="Role"
                placeholder="Search roles..."
                options={ROLE_OPTIONS}
                selectedValues={filterForm.role}
                onChange={(values) =>
                  setFilterForm((prev) => ({ ...prev, role: values }))
                }
              />

              <MultiSelectFilter
                label="Company"
                placeholder="Search companies..."
                options={companyOptions.filter((opt) => opt.value !== "")}
                selectedValues={filterForm.company_id}
                onChange={(values) =>
                  setFilterForm((prev) => ({ ...prev, company_id: values }))
                }
              />

              <MultiSelectFilter
                label="Job Title"
                placeholder="Search job titles..."
                options={jobTitleOptions.filter((opt) => opt.value !== "")}
                selectedValues={filterForm.job_title_id}
                onChange={(values) =>
                  setFilterForm((prev) => ({ ...prev, job_title_id: values }))
                }
              />

              <MultiSelectFilter
                label="State"
                placeholder="Search states..."
                options={stateOptions.filter((opt) => opt.value !== "")}
                selectedValues={filterForm.state_code}
                onChange={(values) =>
                  setFilterForm((prev) => ({ ...prev, state_code: values }))
                }
              />

              <MultiSelectFilter
                label="Location"
                placeholder="Search locations..."
                options={locationOptions.filter((opt) => opt.value !== "")}
                selectedValues={filterForm.location_id}
                onChange={(values) =>
                  setFilterForm((prev) => ({ ...prev, location_id: values }))
                }
              />
            </div>

            <button
              type="button"
              onClick={handleSaveFilters}
              disabled={isSavingFilters}
              className="px-6 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-wait"
            >
              {isSavingFilters ? "Saving..." : "Save Filters"}
            </button>
          </>
        )}
      </div>

      {/* Members Preview Card */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md ring-1 ring-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Matching Users</h2>
            <p className="text-sm text-gray-600">
              This shows users who currently match the group rules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenAssignModal}
              className="px-4 py-2 bg-secondary text-white font-semibold rounded-md hover:opacity-90 transition-colors disabled:opacity-50 whitespace-nowrap"
              disabled={loadingPreview || isAssigning}
            >
              Assign learners
            </button>
            <button
              type="button"
              onClick={handleRefreshPreview}
              disabled={loadingPreview}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {loadingPreview ? "Loading..." : "Refresh Preview"}
            </button>
          </div>
        </div>

        {loadingPreview ? (
          <p className="text-gray-500 text-center py-4">
            Loading matching users...
          </p>
        ) : memberPreview.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No users currently match this group's filters. Click "Refresh
            Preview" to check again after saving your filters.
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
                    Email
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-700">
                    Role
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-700">
                    Company
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-700">
                    Job Title
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-700">
                    State
                  </th>
                  <th className="py-3 px-4 font-semibold text-gray-700">
                    Location
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {memberPreview.map((member) => {
                  const name =
                    [member.first_name, member.last_name]
                      .filter(Boolean)
                      .join(" ") || "—";
                  return (
                    <tr
                      key={member.user_id}
                      className="hover:bg-neutral/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-800 font-medium">
                        {name}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {member.email || "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {member.role || "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {getOptionLabel(companyOptions, member.company_id)}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {getOptionLabel(jobTitleOptions, member.job_title_id)}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {getOptionLabel(stateOptions, member.state_code)}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {getOptionLabel(locationOptions, member.location_id)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Learners Confirmation Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Assign learners to this group
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              This action will assign all users who currently match the{" "}
              <span className="font-semibold">Group Rules</span> to this group.
              Existing members will not be duplicated.
            </p>
            <p className="text-sm text-gray-700 mb-2">
              To confirm, please type{" "}
              <span className="font-mono font-semibold">ASSIGN</span> in the box
              below and click{" "}
              <span className="font-semibold">Assign learners</span>.
            </p>
            <input
              type="text"
              value={assignConfirmText}
              onChange={(e) => setAssignConfirmText(e.target.value)}
              placeholder="Type ASSIGN to confirm"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-secondary focus:ring-secondary"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!isAssigning) {
                    setShowAssignModal(false);
                  }
                }}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={isAssigning}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={assignConfirmText !== "ASSIGN" || isAssigning}
                className="px-4 py-2 rounded-md bg-secondary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {isAssigning ? "Assigning..." : "Assign learners"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageGroupPage;
