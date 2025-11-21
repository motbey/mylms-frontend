import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FavoritesSection from '../../components/FavoritesSection';
import { useUsersListing } from '../../src/hooks/useUsersListing';

// --- Helper Functions ---

// Simple clsx replacement for conditional class names
const clsx = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

// Consistent date formatter
function formatDate(isoString: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch (e) {
    return 'Invalid Date';
  }
}

// --- Main Page Component ---
const AdminUsers: React.FC = () => {
    const {
        rows, total, loading, error,
        search, setSearch,
        sort, dir, setSortKey,
        page, setPage,
        pageSize, setPageSize,
        pageCount,
    } = useUsersListing(25);

    // Sortable Header Component
    const SortHeader: React.FC<{label: string; keyName: ReturnType<typeof useUsersListing>['sort']; className?: string}> = ({ label, keyName, className }) => (
        <th
          className={clsx('px-4 py-3 text-left text-sm font-semibold text-gray-600 select-none cursor-pointer hover:bg-gray-100 transition-colors', className)}
          onClick={() => setSortKey(keyName)}
          title={`Sort by ${label}`}
        >
          <span className="inline-flex items-center gap-1.5">
            {label}
            <span className={clsx('text-gray-400', sort === keyName && 'text-gray-800')}>
                {sort === keyName ? (dir === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </span>
        </th>
    );

    // --- Permission Check ---
    const [loadingProfile, setLoadingProfile] = React.useState(true);
    const navigate = useNavigate();
    
    React.useEffect(() => {
        const checkPermissions = async () => {
          setLoadingProfile(true);
          const { getMyProfile } = await import('../../src/lib/profiles');
          const userProfile = await getMyProfile();
          if (!userProfile || !['admin', 'sub_admin'].includes(userProfile.role)) {
            navigate('/admin', { replace: true });
            return;
          }
          setLoadingProfile(false);
        };
        checkPermissions();
    }, [navigate]);

    if (loadingProfile) {
        return <div className="text-center p-8">Checking permissions...</div>;
    }
    
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link to="/admin" className="text-sm text-secondary hover:underline">&larr; Back to Admin Dashboard</Link>
        <h1 className="text-3xl font-bold text-primary mt-2">Manage Users</h1>
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
            <thead className="bg-gray-50">
              <tr>
                <SortHeader label="Name" keyName="name" />
                <SortHeader label="Email" keyName="email" />
                <SortHeader label="Job Title" keyName="job_title" />
                <SortHeader label="Company" keyName="company" />
                <SortHeader label="Location" keyName="location" />
                <SortHeader label="State" keyName="state" />
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Role(s)</th>
                <SortHeader label="Created On" keyName="created" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !error && (
                <tr><td className="px-4 py-6 text-sm text-gray-500 text-center" colSpan={8}>Loading users...</td></tr>
              )}
              {error && !loading && (
                <tr><td className="px-4 py-6 text-sm text-red-600 text-center" colSpan={8}>{error}</td></tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr><td className="px-4 py-6 text-sm text-gray-500 text-center" colSpan={8}>No users found.</td></tr>
              )}
              {!loading && !error && rows.map((r) => {
                const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || '—';
                const created = formatDate(r.created_at);
                const roles = r.roles ?? [];
                return (
                  <tr key={r.user_id} className="hover:bg-neutral/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.email ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.job_title ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.company ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.location ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{r.state ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {roles.map((role) => (
                           <span
                           key={role}
                           className={clsx(
                             'rounded-full px-2.5 py-1 text-xs font-semibold leading-none shadow-sm border border-black/5',
                             role.toLowerCase() === 'admin' || role.toLowerCase() === 'sub_admin'
                               ? 'bg-secondary/10 text-secondary'
                               : 'bg-neutral text-gray-700'
                           )}
                         >
                           {role.replace(/_/g, ' ').toUpperCase()}
                         </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{created}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > pageSize && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <span>Rows per page</span>
              <select
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm focus:ring-1 focus:ring-secondary focus:border-secondary"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                disabled={loading}
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

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

export default AdminUsers;