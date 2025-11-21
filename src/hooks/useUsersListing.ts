import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchUsers } from '../services/users';
import type { UsersListRow } from '../types/users';

// Helper to extract a descriptive message from any thrown value
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string') {
        return (error as any).message;
    }
    return String(error);
}

// Custom hook to debounce a value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function useUsersListing(initialPageSize = 25) {
  const [rows, setRows] = useState<UsersListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'name'|'email'|'job_title'|'company'|'location'|'state'|'created'>('name');
  const [dir, setDir] = useState<'asc'|'desc'>('asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const debouncedSearch = useDebounce(search, 400);

  // The core data fetching function
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { rows, total } = await fetchUsers({
        p_search: debouncedSearch.trim(),
        p_sort: sort,
        p_dir: dir,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });
      setRows(rows);
      setTotal(total);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort, dir, page, pageSize]);
  
  // Trigger fetch when any dependency changes
  useEffect(() => {
    load();
  }, [load]);

  // Reset page to 0 when search term or sort order changes
  useEffect(() => {
    if (page !== 0) {
      setPage(0);
    }
  }, [debouncedSearch, sort, dir, pageSize]);

  // Handler for changing the sort column
  const setSortKey = useCallback((key: typeof sort) => {
    if (sort === key) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
        setSort(key);
        setDir('asc');
    }
  }, [sort]);

  const pageCount = useMemo(() => Math.ceil(total / pageSize) || 1, [total, pageSize]);

  return {
    rows, total, loading, error,
    search, setSearch,
    sort, dir, setSortKey,
    page, setPage,
    pageSize, setPageSize,
    pageCount,
    // FIX: Expose the `load` function to allow for manual retries.
    load,
  };
}