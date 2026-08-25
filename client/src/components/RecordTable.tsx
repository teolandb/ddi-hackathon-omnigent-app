/**
 * Generic record table built on AppKit-ui's Table primitives.
 *
 * Used instead of the query-driven `DataTable` wherever a row needs bespoke
 * rendering (badges, per-row action controls) or a client-side CSV export of the
 * exact rows on screen. Rows are capped by `maxRows` so a large result set never
 * renders thousands of DOM nodes — the count of hidden rows is disclosed.
 */
import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@databricks/appkit-ui/react';
import { cn } from '../lib/utils';

export interface Column<Row> {
  key: string;
  header: string;
  /** Right-align numeric columns and render them tabular for easy comparison. */
  numeric?: boolean;
  render: (row: Row) => ReactNode;
}

export function RecordTable<Row>({
  rows,
  columns,
  rowKey,
  maxRows = 200,
}: {
  rows: readonly Row[];
  columns: readonly Column<Row>[];
  rowKey: (row: Row, index: number) => string;
  maxRows?: number;
}) {
  const visible = rows.slice(0, maxRows);
  const hidden = rows.length - visible.length;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={cn(column.numeric && 'text-right')}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row, index) => (
              <TableRow key={rowKey(row, index)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(column.numeric && 'text-right tabular-nums')}
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hidden > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing the top {visible.length} of {rows.length} rows. Export to CSV for the full list.
        </p>
      )}
    </div>
  );
}
