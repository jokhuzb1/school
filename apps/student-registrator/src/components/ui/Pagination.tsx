import { Icons } from './Icons';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <div className="pagination-info">
        <b>{startIdx}-{endIdx}</b> / {total} tadan
      </div>
      <div className="pagination-actions">
        <button
          className="button button-secondary button-compact"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Oldingi sahifa"
        >
          <Icons.ChevronLeft />
        </button>
        
        <span className="pagination-page">
          {page} / {totalPages}
        </span>

        <button
          className="button button-secondary button-compact"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Keyingi sahifa"
        >
          <Icons.ChevronRight />
        </button>
      </div>
    </div>
  );
}
