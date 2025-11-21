import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FavoritesSection from '../../../components/FavoritesSection';
import { useUsersListing } from '../../../src/hooks/useUsersListing';
import type { UsersListRow } from '../../../src/types/users';

// --- Helper Functions (replicated for consistency) ---
const clsx = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

// --- Main Page Component ---
const AssignCompetencies: React.FC = () => {
  const navigate = useNavigate();
  const {
      rows, total, loading, error,
      search, setSearch,
      sort, dir, setSortKey,
      page, setPage,
      pageSize, setPageSize,
      pageCount,
      load: retryFetch,
  } = useUsersListing(15); // Use 15 rows per page as requested

  const handleViewCompetenciesClick = (user: UsersListRow) => {
    navigate(`/admin/content/competencies/assign/${user.user_id}`, {
      state: { user },
    });
  };

  // Sortable Header Component
  const SortHeader: React.FC<{label: string; keyName: ReturnType<typeof useUsersListing>['sort']; className?: string}> = ({ label, keyName, className }) => (
      <th
        scope="col"
        className={clsx('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 select-none cursor-pointer hover:bg-slate-100 transition-colors', className)}
        onClick={() => setSortKey(keyName)}
        title={`Sort by ${label}`}
      >
        <span className="inline-flex items-center gap-1.5">
          {label}
          <span className={clsx('text-slate-400', sort === keyName && 'text-slate-800')}>
              {sort === keyName ? (dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </span>
      </th>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/admin/content/competencies" className="text-sm text-secondary hover:underline">&larr; Back to Manage Competencies</Link>
        <h1 className="text-3xl font-bold text-primary mt-2">Assign Competencies</h1>
        <p className="mt-1 text-slate-600">
          Assign competencies to users and groups to track and manage compliance.
        </p>
      </div>

      <FavoritesSection />

      {/* Main content card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-md ring-1 ring-gray-100 space-y-4">
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-[420px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, job title, company..."
                    className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-secondary"
                />
            </div>
            <div className="text-sm text-gray-500">
                Showing {rows.length > 0 ? (page * pageSize) + 1 : 0}–{Math.min((page + 1) * pageSize, total)} of {total}
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <SortHeader label="Name" keyName="name" />
                <SortHeader label="Job Title" keyName="job_title" />
                <SortHeader label="Company" keyName="company" />
                <SortHeader label="Location" keyName="location" />
                <SortHeader label="State" keyName="state" />
                <th scope="col" className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !error && (
                <tr><td className="px-4 py-6 text-sm text-gray-500 text-center" colSpan={6}>Loading users...</td></tr>
              )}
              {error && !loading && (
                <tr>
                  <td className="px-4 py-6 text-sm text-red-600 text-center" colSpan={6}>
                    <p>{error}</p>
                    <button onClick={() => retryFetch()} className="mt-2 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Retry
                    </button>
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr><td className="px-4 py-6 text-sm text-gray-500 text-center" colSpan={6}>No users found.</td></tr>
              )}
              {!loading && !error && rows.map((user) => {
                const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';
                return (
                  <tr key={user.user_id} className="hover:bg-neutral/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{user.job_title ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{user.company ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{user.location ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{user.state ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-sm">
                      <button
                        type="button"
                        onClick={() => handleViewCompetenciesClick(user)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View Competencies
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > pageSize && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div/>
              <div className="flex items-center gap-3 text-sm">
                <button
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <span>Page {page + 1} of {pageCount}</span>
                <button
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={page + 1 >= pageCount || loading}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  Next
                </button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignCompetencies;
