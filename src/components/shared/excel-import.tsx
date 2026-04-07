'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import {
  downloadTemplate,
  parseExcelFile,
  mapRowsToColumns,
  TEMPLATES,
} from '@/lib/excel-templates'
import { toast } from 'sonner'
import { Upload, Download, FileSpreadsheet, Check, AlertCircle } from 'lucide-react'

interface ExcelImportProps {
  templateKey: string
  onSuccess: () => void
  empresaId?: string | null
  /** Custom transform before insert — resolve lookups like RFC→proveedor_id */
  transformRows?: (rows: Record<string, unknown>[]) => Promise<Record<string, unknown>[]>
}

export function ExcelImport({ templateKey, onSuccess, empresaId, transformRows }: ExcelImportProps) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null)
  const [, setRawHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null)

  const template = TEMPLATES[templateKey]
  if (!template) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)

    parseExcelFile(file).then((rows) => {
      if (rows.length === 0) {
        toast.error('El archivo está vacío')
        return
      }
      setRawHeaders(Object.keys(rows[0]))
      const mapped = mapRowsToColumns(rows, template)
      setPreview(mapped)
    }).catch(() => {
      toast.error('Error al leer el archivo')
    })
  }

  function validateRows(rows: Record<string, unknown>[]): string[] {
    const errors: string[] = []
    const requiredKeys = template.columns.filter((c) => c.required).map((c) => c.key)

    rows.forEach((row, i) => {
      requiredKeys.forEach((key) => {
        if (!row[key] && row[key] !== 0) {
          const col = template.columns.find((c) => c.key === key)
          errors.push(`Fila ${i + 1}: "${col?.header}" es requerido`)
        }
      })
    })
    return errors
  }

  async function handleImport() {
    if (!preview) return
    setImporting(true)

    const validationErrors = validateRows(preview)
    if (validationErrors.length > 0) {
      setResult({ success: 0, errors: validationErrors.slice(0, 10) })
      setImporting(false)
      return
    }

    try {
      // Clean rows: remove lookup fields (starting with _)
      let cleanRows = preview.map((row) => {
        const clean: Record<string, unknown> = {}
        Object.entries(row).forEach(([k, v]) => {
          if (!k.startsWith('_') && v !== undefined && v !== '') {
            clean[k] = v
          }
        })
        return clean
      })

      // Apply custom transform (resolve foreign keys etc.)
      if (transformRows) {
        cleanRows = await transformRows(preview)
      }

      // Inject empresa_id if provided
      if (empresaId) {
        cleanRows = cleanRows.map((row) => ({ ...row, empresa_id: empresaId }))
      }

      // Handle special field conversions
      cleanRows = cleanRows.map((row) => {
        const converted: Record<string, unknown> = {}
        Object.entries(row).forEach(([k, v]) => {
          if (k === 'es_fijo' || k === 'requiere_concepto') {
            converted[k] = String(v).toUpperCase() === 'SI' || v === true || v === 1
          } else {
            converted[k] = v
          }
        })
        return converted
      })

      const supabase = createClient()
      const errors: string[] = []
      let success = 0

      // Insert in batches of 50
      for (let i = 0; i < cleanRows.length; i += 50) {
        const batch = cleanRows.slice(i, i + 50)
        const { error } = await supabase.from(template.tableName).insert(batch)
        if (error) {
          errors.push(`Lote ${Math.floor(i / 50) + 1}: ${error.message}`)
        } else {
          success += batch.length
        }
      }

      setResult({ success, errors })
      if (success > 0) {
        toast.success(`${success} registro(s) importados`)
        onSuccess()
      }
      if (errors.length > 0) {
        toast.error(`${errors.length} error(es) durante la importación`)
      }
    } catch {
      toast.error('Error durante la importación')
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setPreview(null)
    setRawHeaders([])
    setResult(null)
  }

  const displayColumns = template.columns.filter((c) => !c.key.startsWith('_')).slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar {template.sheetName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Download template */}
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <Badge variant="outline" className="shrink-0">1</Badge>
            <p className="text-sm flex-1">Descarga la plantilla, llénala con tus datos y súbela aquí.</p>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(templateKey)}>
              <Download className="h-4 w-4 mr-2" /> Descargar plantilla
            </Button>
          </div>

          {/* Step 2: Upload file */}
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <Badge variant="outline" className="shrink-0">2</Badge>
            <p className="text-sm flex-1">Sube tu archivo Excel (.xlsx)</p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button variant="outline" size="sm" asChild>
                <span><Upload className="h-4 w-4 mr-2" /> Subir archivo</span>
              </Button>
            </label>
          </div>

          {/* Preview */}
          {preview && (
            <>
              <div className="rounded-md border">
                <div className="p-3 bg-muted/30 border-b">
                  <p className="text-sm font-medium">{preview.length} fila(s) detectadas</p>
                </div>
                <div className="overflow-x-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        {displayColumns.map((col) => (
                          <TableHead key={col.key}>{col.header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          {displayColumns.map((col) => (
                            <TableCell key={col.key} className="text-sm">
                              {String(row[col.key] ?? '—')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {preview.length > 10 && (
                  <div className="p-2 text-center text-xs text-muted-foreground border-t">
                    ... y {preview.length - 10} fila(s) más
                  </div>
                )}
              </div>

              {/* Result */}
              {result && (
                <div className="space-y-2">
                  {result.success > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 text-green-800">
                      <Check className="h-4 w-4" />
                      <span className="text-sm">{result.success} registro(s) importados correctamente</span>
                    </div>
                  )}
                  {result.errors.length > 0 && (
                    <div className="p-3 rounded-md bg-red-50 text-red-800 space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Errores:</span>
                      </div>
                      {result.errors.map((err, i) => (
                        <p key={i} className="text-xs ml-6">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Import button */}
              {(!result || result.success === 0) && (
                <Button onClick={handleImport} disabled={importing} className="w-full">
                  {importing ? 'Importando...' : `Importar ${preview.length} registro(s)`}
                </Button>
              )}

              {result && result.success > 0 && (
                <Button variant="outline" onClick={() => { setOpen(false); reset() }} className="w-full">
                  Cerrar
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
