'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMXN } from '@/lib/constants'
import { toast } from 'sonner'
import { addDays, format, differenceInDays } from 'date-fns'
import type { Factura } from '@/lib/types'
import { ExcelImport } from '@/components/shared/excel-import'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { FileUpload } from '@/components/shared/file-upload'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Receipt, ChevronDown, ChevronUp, Upload, MessageSquare } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  aprobada: 'bg-blue-100 text-blue-800',
  programada: 'bg-purple-100 text-purple-800',
  pagada: 'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-800',
}

const STATUSES = ['pendiente', 'aprobada', 'programada', 'pagada', 'rechazada']

function getVencimientoStatus(fechaVencimiento: string | null, estatus: string): { label: string; className: string } | null {
  if (!fechaVencimiento || estatus === 'pagada' || estatus === 'rechazada') return null
  const venc = new Date(fechaVencimiento + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const diff = differenceInDays(venc, today)
  if (diff < 0) return { label: `Vencida (${Math.abs(diff)}d)`, className: 'bg-red-100 text-red-800' }
  if (diff === 0) return { label: 'Vence hoy', className: 'bg-orange-100 text-orange-800' }
  if (diff <= 3) return { label: `Vence en ${diff}d`, className: 'bg-yellow-100 text-yellow-800' }
  return { label: 'Vigente', className: 'bg-green-100 text-green-800' }
}

interface FacturaExtended extends Factura {
  comprobante_pago_url?: string | null
  observaciones?: string | null
}

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<FacturaExtended[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('todos')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { empresaId, userRole } = useEmpresa()

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('facturas')
      .select('*, proveedores(nombre_empresa), ordenes_compra(numero_oc)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
    setFacturas(data || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  async function updateEstatus(id: string, estatus: string) {
    const supabase = createClient()
    const updates: Record<string, unknown> = { estatus }
    if (estatus === 'programada') {
      // Auto-set scheduled payment date to due date
      const factura = facturas.find(f => f.id === id)
      if (factura?.fecha_vencimiento) {
        updates.fecha_programada_pago = factura.fecha_vencimiento
      }
    }
    const { error } = await supabase.from('facturas').update(updates).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Estatus actualizado')
    loadData()
  }

  async function setPaymentDate(id: string, fecha: string) {
    const supabase = createClient()
    await supabase.from('facturas').update({ fecha_programada_pago: fecha }).eq('id', id)
    loadData()
  }

  async function saveObservaciones(id: string, observaciones: string) {
    const supabase = createClient()
    const { error } = await supabase.from('facturas').update({ observaciones: observaciones || null }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Observaciones guardadas')
    loadData()
  }

  async function saveComprobante(id: string, url: string) {
    const supabase = createClient()
    const { error } = await supabase.from('facturas').update({ comprobante_pago_url: url || null }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(url ? 'Comprobante subido' : 'Comprobante eliminado')
    loadData()
  }

  const filtered = facturas.filter((f) => {
    if (filterStatus !== 'todos' && f.estatus !== filterStatus) return false
    if (search && !f.numero_factura.toLowerCase().includes(search.toLowerCase()) &&
        !(f as unknown as Record<string, Record<string, string>>).proveedores?.nombre_empresa?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6" /> Facturas</h1>
        {userRole !== 'viewer' && (
          <ExcelImport
            templateKey="facturas"
            empresaId={empresaId}
            onSuccess={loadData}
            transformRows={async (rows) => {
              const supabase = createClient()
              const { data: provs } = await supabase.from('proveedores').select('id, id_banco, nombre_empresa').eq('empresa_id', empresaId!)
              // Map by id_banco and by nombre
              const idBancoMap = new Map((provs || []).filter(p => p.id_banco).map((p) => [p.id_banco!.toUpperCase(), p.id]))
              const nombreMap = new Map((provs || []).map((p) => [p.nombre_empresa.toUpperCase(), p.id]))

              return rows.map((row, idx) => {
                // Resolve proveedor by id_banco first, then by nombre
                const idBanco = String(row._id_banco || '').toUpperCase().trim()
                const nombre = String(row._proveedor_nombre || '').toUpperCase().trim()
                const proveedorId = idBancoMap.get(idBanco) || nombreMap.get(nombre) || null

                const importe = Number(row._importe) || 0

                // Parse dates - handle DD/MM/YYYY, YYYY-MM-DD, or Excel serial numbers
                function parseDate(val: unknown): string | null {
                  if (!val) return null
                  const s = String(val).trim()
                  if (!s) return null
                  // Excel serial number
                  if (/^\d{5}$/.test(s)) {
                    const d = new Date((Number(s) - 25569) * 86400 * 1000)
                    return format(d, 'yyyy-MM-dd')
                  }
                  // DD/MM/YYYY
                  const ddmm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
                  if (ddmm) return `${ddmm[3]}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}`
                  // YYYY-MM-DD already
                  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
                  // Try native parse
                  const d = new Date(s)
                  if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd')
                  return null
                }

                const fechaFactura = parseDate(row._fecha_recibida) || format(new Date(), 'yyyy-MM-dd')
                const diasCredito = Number(row._dias_credito) || 0
                let fechaVenc = parseDate(row._fecha_vencimiento)
                if (!fechaVenc && diasCredito > 0) {
                  fechaVenc = format(addDays(new Date(fechaFactura), diasCredito), 'yyyy-MM-dd')
                }

                // Determine estatus from confirmacion/importe_pagado
                const confirmacion = String(row._confirmacion || '').toUpperCase().trim()
                const importePagado = Number(row._importe_pagado) || 0
                const fechaPago = parseDate(row._fecha_pago)
                let estatus = 'pendiente'
                if (importePagado >= importe && importe > 0) estatus = 'pagada'
                else if (fechaPago) estatus = 'programada'
                else if (confirmacion === 'JUE' || confirmacion.includes('CONFIRM') || confirmacion.includes('SI')) estatus = 'aprobada'

                const observaciones = String(row._observaciones || '').trim() || null

                return {
                  empresa_id: empresaId,
                  numero_factura: row.numero_factura || `IMP-${idx + 1}`,
                  proveedor_id: proveedorId,
                  fecha_factura: fechaFactura,
                  dias_credito: diasCredito,
                  fecha_vencimiento: fechaVenc,
                  subtotal: importe,
                  tipo_iva: '0',
                  monto_iva: 0,
                  total: importe,
                  estatus,
                  fecha_programada_pago: fechaPago,
                  observaciones,
                  notas: null,
                }
              })
            }}
          />
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Buscar por # factura o proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar estatus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead># Factura</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>OC</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Situación</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>IVA</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead>Pago prog.</TableHead>
                  <TableHead>Docs</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => {
                  const isExpanded = expandedId === f.id
                  return (
                    <React.Fragment key={f.id}>
                      <TableRow className={isExpanded ? 'border-b-0' : ''}>
                        <TableCell className="font-medium">{f.numero_factura}</TableCell>
                        <TableCell>{(f as unknown as Record<string, Record<string, string>>).proveedores?.nombre_empresa || '—'}</TableCell>
                        <TableCell>{(f as unknown as Record<string, Record<string, string>>).ordenes_compra?.numero_oc || '—'}</TableCell>
                        <TableCell>{format(new Date(f.fecha_factura + 'T12:00:00'), 'dd/MM/yy')}</TableCell>
                        <TableCell>
                          {f.fecha_vencimiento ? format(new Date(f.fecha_vencimiento + 'T12:00:00'), 'dd/MM/yy') : '—'}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const status = getVencimientoStatus(f.fecha_vencimiento, f.estatus)
                            if (!status) return '—'
                            return <Badge variant="outline" className={status.className}>{status.label}</Badge>
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatMXN(f.total)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{f.tipo_iva === '16' ? '16%' : f.tipo_iva === '0' ? '0%' : 'Exento'}</Badge>
                        </TableCell>
                        <TableCell>
                          {userRole === 'viewer' ? (
                            <Badge variant="outline" className={STATUS_COLORS[f.estatus]}>
                              {f.estatus.charAt(0).toUpperCase() + f.estatus.slice(1)}
                            </Badge>
                          ) : (
                            <Select value={f.estatus} onValueChange={(v) => updateEstatus(f.id, v)}>
                              <SelectTrigger className="w-[130px] h-8">
                                <Badge variant="outline" className={STATUS_COLORS[f.estatus]}>
                                  {f.estatus.charAt(0).toUpperCase() + f.estatus.slice(1)}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          {f.estatus === 'programada' || f.estatus === 'aprobada' ? (
                            <Input
                              type="date"
                              className="w-[140px] h-8"
                              value={f.fecha_programada_pago || ''}
                              onChange={(e) => setPaymentDate(f.id, e.target.value)}
                              disabled={userRole === 'viewer'}
                            />
                          ) : f.fecha_programada_pago ? (
                            format(new Date(f.fecha_programada_pago + 'T12:00:00'), 'dd/MM/yy')
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {f.pdf_url && (
                              <a href={f.pdf_url} target="_blank" rel="noopener noreferrer">
                                <Badge variant="outline" className="cursor-pointer hover:bg-muted">PDF</Badge>
                              </a>
                            )}
                            {f.xml_url && (
                              <a href={f.xml_url} target="_blank" rel="noopener noreferrer">
                                <Badge variant="outline" className="cursor-pointer hover:bg-muted">XML</Badge>
                              </a>
                            )}
                            {f.comprobante_pago_url && (
                              <a href={f.comprobante_pago_url} target="_blank" rel="noopener noreferrer">
                                <Badge variant="outline" className="cursor-pointer hover:bg-muted bg-green-50 text-green-700">Comp.</Badge>
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {userRole !== 'viewer' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedId(isExpanded ? null : f.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && userRole !== 'viewer' && (
                        <TableRow>
                          <TableCell colSpan={12} className="bg-muted/30 p-4">
                            <FacturaDetailPanel factura={f} onSaveObservaciones={saveObservaciones} onSaveComprobante={saveComprobante} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No hay facturas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FacturaDetailPanel({
  factura,
  onSaveObservaciones,
  onSaveComprobante,
}: {
  factura: FacturaExtended
  onSaveObservaciones: (id: string, obs: string) => void
  onSaveComprobante: (id: string, url: string) => void
}) {
  const [obs, setObs] = useState(factura.observaciones || '')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Observaciones para el proveedor
        </Label>
        <Textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Escribir observaciones visibles para el proveedor..."
          rows={3}
        />
        <Button size="sm" onClick={() => onSaveObservaciones(factura.id, obs)}>
          Guardar observaciones
        </Button>
      </div>
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> Comprobante de pago
        </Label>
        <FileUpload
          bucket="comprobantes-pago"
          folder={factura.proveedor_id}
          accept=".pdf,.png,.jpg,.jpeg"
          label="Subir comprobante de pago"
          value={factura.comprobante_pago_url}
          onUpload={(url) => onSaveComprobante(factura.id, url)}
        />
      </div>
    </div>
  )
}
