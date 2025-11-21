import React from 'react';
import type { DerivedStatus } from '../services/formSubmissions';

const statusStyles: Record<DerivedStatus, string> = {
  'Completed': 'bg-emerald-50 text-emerald-700',
  'Rejected': 'bg-rose-50 text-rose-700',
  'Submitted': 'bg-blue-50 text-blue-700',
  'Started': 'bg-amber-50 text-amber-700',
  'Not Started': 'bg-slate-100 text-slate-600',
};

const SubmissionStatusBadge: React.FC<{ status: DerivedStatus | null }> = ({ status }) => {
  if (!status) {
    return null;
  }
  
  const style = statusStyles[status] || 'bg-gray-100 text-gray-600';
  const baseClasses = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium";

  return (
    <span className={`${baseClasses} ${style}`}>
      {status}
    </span>
  );
};

export default SubmissionStatusBadge;
