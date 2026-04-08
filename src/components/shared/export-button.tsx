'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

interface ExportButtonProps {
  data: Record<string, unknown>[]
  filename: string
  sheetName?: string
}

export function ExportButton({ data, filename, sheetName = 'Datos' }: ExportButtonProps) {
  function exportExcel() {
    if (data.length === 0) { toast.error('No hay datos para exportar'); return }
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    // Auto column widths
    const cols = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length).slice(0, 50)) + 2
    }))
    ws['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `${filename}.xlsx`)
    toast.success('Excel exportado')
  }

  function exportCSV() {
    if (data.length === 0) { toast.error('No hay datos para exportar'); return }
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' })
    toast.success('CSV exportado')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportCSV}>
          <FileText className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
