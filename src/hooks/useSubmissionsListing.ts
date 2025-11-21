import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllSubmissions } from '../services/formSubmissions';
import type { AllSubmissionsRow, DerivedStatus } from '../services/formSubmissions';

// Helper to get error message
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export type SubmissionsSortKey = 'form' | 'learner' | 'submitted' | 'reviewed';

export function useSubmissionsListing(initialPageSize = 25) {
  const [rows, setRows] = useState<AllSubmissionsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DerivedStatus | 'All'>('All');
  const [sort, setSort] = useState<SubmissionsSortKey>('submitted');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { rows, total } = await fetchAllSubmissions({
        p_search: debouncedSearch.trim(),
        p_status: statusFilter,
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
  }, [debouncedSearch, statusFilter, sort, dir, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (page !== 0) {
      setPage(0);
    }
  }, [debouncedSearch, statusFilter, sort, dir, pageSize]);

  const setSortKey = useCallback((key: typeof sort) => {
    if (sort === key) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
        setSort(key);
        setDir('desc'); // Default to descending for new columns, esp. dates
    }
  }, [sort]);

  const pageCount = useMemo(() => Math.ceil(total / pageSize) || 1, [total, pageSize]);

  return {
    rows, total, loading, error,
    search, setSearch,
    statusFilter, setStatusFilter,
    sort, dir, setSortKey,
    page, setPage,
    pageSize, setPageSize,
    pageCount,
    load, // for retries
  };
}
