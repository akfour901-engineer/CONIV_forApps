
'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TableHead } from '@/components/ui/table';

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  onSort: () => void;
  sortConfig: { key: keyof TData; direction: 'asc' | 'desc' } | null;
  sortKey: keyof TData;
}

export function DataTableColumnHeader<TData, TValue>({
  title,
  onSort,
  sortConfig,
  sortKey,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  return (
    <TableHead className={cn(className)}>
      <Button variant="ghost" onClick={onSort}>
        {title}
        {sortConfig?.key === sortKey ? (
          sortConfig.direction === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : (
            <ArrowDown className="ml-2 h-4 w-4" />
          )
        ) : (
          <ChevronsUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    </TableHead>
  );
}
