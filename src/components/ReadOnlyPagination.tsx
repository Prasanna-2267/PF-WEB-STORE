import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ReadOnlyPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  noun?: string;
  compact?: boolean;
}

export const ReadOnlyPagination: React.FC<ReadOnlyPaginationProps> = ({
  page,
  totalPages,
  total,
  onPageChange,
  pageSize = total || 1,
  noun = 'records',
  compact = false,
}) => {
  const firstRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRecord = Math.min(page * pageSize, total);

  return (
  <footer className={`pf-admin-pagination${compact ? ' pf-admin-pagination--compact' : ''}`} aria-label="Pagination">
    <p>
      {compact ? (
        <>Showing <strong>{firstRecord.toLocaleString('en-IN')}</strong> to <strong>{lastRecord.toLocaleString('en-IN')}</strong> of <strong>{total.toLocaleString('en-IN')}</strong> {noun}</>
      ) : (
        <><strong>{total.toLocaleString('en-IN')}</strong> {noun}</>
      )}
    </p>
    <div>
      <button
        className="pf-admin-button pf-admin-button--secondary"
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={15} aria-hidden="true" />
        {compact ? null : 'Previous'}
      </button>
      <span className="pf-admin-pagination__page" aria-current="page">
        {compact ? page : `Page ${page} of ${Math.max(totalPages, 1)}`}
      </span>
      <button
        className="pf-admin-button pf-admin-button--secondary"
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        {compact ? null : 'Next'}
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    </div>
  </footer>
  );
};
