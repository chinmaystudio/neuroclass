import React from 'react';
import { cn } from '../../lib/utils';
import { IconChevronLeft, IconChevronRight } from './icons';

/* Low-level table parts for custom layouts. */
export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement> & { caption?: string }> = ({ className, caption, children, ...rest }) => (
  <div data-ui="table" className="w-full overflow-x-auto">
    <table className={cn('w-full border-collapse text-left text-body', className)} {...rest}>
      {caption && <caption className="sr-only">{caption}</caption>}
      {children}
    </table>
  </div>
);
export const THead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...rest }) => <thead className={cn('bg-surface-2/60', className)} {...rest} />;
export const TBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, ...rest }) => <tbody className={cn('divide-y divide-line-2', className)} {...rest} />;
export const TR: React.FC<React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }> = ({ className, interactive = true, ...rest }) => <tr className={cn(interactive && 'transition-colors hover:bg-primary-light/50', className)} {...rest} />;
export const TH: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, scope = 'col', ...rest }) => <th scope={scope} className={cn('h-11 whitespace-nowrap border-b border-line px-4 text-support font-medium text-ink-2', className)} {...rest} />;
export const TD: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, ...rest }) => <td className={cn('h-14 px-4 py-2 align-middle text-ink', className)} {...rest} />;

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Hidden in the stacked mobile layout (e.g. secondary columns). */
  hideOnMobile?: boolean;
  className?: string;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** The column shown as the title of each stacked card on small screens. */
  primaryColumn?: string;
  className?: string;
};

/**
 * Data table that becomes a stacked list below 640px instead of scrolling
 * sideways, so no horizontal overflow on phones.
 */
export function DataTable<T>({ columns, rows, rowKey, caption, empty, onRowClick, primaryColumn, className }: DataTableProps<T>) {
  const primary = columns.find((c) => c.key === primaryColumn) ?? columns[0];
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);
  const alignCls = (a?: Column<T>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  if (rows.length === 0) return <div className={className}>{empty ?? <p className="px-4 py-8 text-center text-support text-ink-2">Nothing to show yet.</p>}</div>;

  return (
    <div className={className}>
      <div className="hidden sm:block">
        <Table caption={caption}>
          <THead>
            <tr>{columns.map((c) => <TH key={c.key} className={cn(alignCls(c.align), c.className)}>{c.header}</TH>)}</tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer')}
              >
                {columns.map((c) => <TD key={c.key} className={cn(alignCls(c.align), c.className)}>{c.cell(row)}</TD>)}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <ul className="divide-y divide-line-2 sm:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-3" onClick={onRowClick ? () => onRowClick(row) : undefined}>
            <div className="text-body font-medium text-ink">{primary.cell(row)}</div>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {rest.map((c) => (
                <React.Fragment key={c.key}>
                  <dt className="text-meta text-ink-2">{c.header}</dt>
                  <dd className="min-w-0 text-support text-ink">{c.cell(row)}</dd>
                </React.Fragment>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const Pagination: React.FC<{ page: number; pageCount: number; onChange: (page: number) => void; className?: string }> = ({ page, pageCount, onChange, className }) => {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  const btn = 'focus-ring inline-flex h-9 min-w-9 items-center justify-center rounded-button px-2 text-button transition-colors disabled:pointer-events-none disabled:text-ink-3';
  return (
    <nav data-ui="pagination" aria-label="Pagination" className={cn('flex items-center gap-1', className)}>
      <button type="button" data-ui="button" className={cn(btn, 'text-ink-2 hover:bg-surface-2')} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><IconChevronLeft size={18} /></button>
      {pages.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-ink-3" aria-hidden>…</span>}
          <button type="button" data-ui="button" onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined} className={cn(btn, p === page ? 'bg-primary-light font-semibold text-primary-dark' : 'text-ink-2 hover:bg-surface-2')}>{p}</button>
        </React.Fragment>
      ))}
      <button type="button" data-ui="button" className={cn(btn, 'text-ink-2 hover:bg-surface-2')} disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Next page"><IconChevronRight size={18} /></button>
    </nav>
  );
};
