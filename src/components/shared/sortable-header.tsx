'use client'

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'

interface SortableHeaderProps {
  label: string
  column: string
  sortKey: string | null
  sortDir: 'asc' | 'desc'
  onSort: (key: string) => void
  className?: string
}

export function SortableHeader({ label, column, sortKey, sortDir, onSort, className }: SortableHeaderProps) {
  return (
    <TableHead className={`cursor-pointer select-none hover:bg-muted/50 ${className || ''}`} onClick={() => onSort(column)}>
      <div className="flex items-center gap-1">
        {label}
        {sortKey !== column && <ArrowUpDown className="h-3 w-3 opacity-40" />}
        {sortKey === column && sortDir === 'asc' && <ArrowUp className="h-3 w-3" />}
        {sortKey === column && sortDir === 'desc' && <ArrowDown className="h-3 w-3" />}
      </div>
    </TableHead>
  )
}
