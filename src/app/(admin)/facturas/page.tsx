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
import type { Factura, Proveedor } from '@/lib/types'
import { ExcelImport } from '@/components/shared/excel-import'
import { ExportButton } from '@/components/shared/export-button'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { FileUpload } from '@/components/shared/file-upload'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Receipt, ChevronDown, ChevronUp, Upload, MessageSquare, UserPlus, XCircle, CalendarDays } from 'lucide-react'
import { SortableHeader } from '@/components/shared/sortable-header'

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

function getProveedorNombre(f: FacturaExtended): string {
  return (f as unknown as Record<string, Record<string, string>>).proveedores?.nombre_empresa || ''
}

function getSituacionOrder(f: FacturaExtended): number {
  const status = getVencimientoStatus(f.fecha_vencimiento, f.estatus)
  if (!status) return 99
  if (status.label.startsWith('Vencida')) return 0
  if (status.label === 'Vence hoy') return 1
  if (status.label.startsWith('Vence en')) return 2
  return 3
}

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<FacturaExtended[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('todos')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { empresaId, userRole } = useEmpresa()

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const [facturasRes, provsRes] = await Promise.all([
      supabase.from('facturas').select('*, proveedores(nombre_empresa), ordenes_compra(numero_oc)').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      supabase.from('proveedores').select('*').eq('empresa_id', empresaId).eq('activo', true).order('nombre_empresa'),
    ])
    setFacturas(facturasRes.data || [])
    setProveedores(provsRes.data || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir('asc') }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  async function updateEstatus(id: string, estatus: string) {
    const supabase = createClient()
    const updates: Record<string, unknown> = { estatus }
    if (estatus === 'programada') {
      const factura = facturas.find(f => f.id === id)
      if (factura?.fecha_vencimiento) updates.fecha_programada_pago = factura.fecha_vencimiento
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

  async function updateIva(id: string, tipoIva: '16' | '0' | 'exento') {
    const factura = facturas.find(f => f.id === id)
    if (!factura) return
    const supabase = createClient()
    const montoIva = tipoIva === '16' ? factura.subtotal * 0.16 : 0
    const total = factura.subtotal + montoIva
    const { error } = await supabase.from('facturas').update({ tipo_iva: tipoIva, monto_iva: montoIva, total }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('IVA actualizado')
    loadData()
  }

  async function updateDiasCredito(id: string, diasCredito: number) {
    const factura = facturas.find(f => f.id === id)
    if (!factura) return
    const supabase = createClient()
    const fechaVenc = diasCredito > 0 ? format(addDays(new Date(factura.fecha_factura + 'T12:00:00'), diasCredito), 'yyyy-MM-dd') : null
    const { error } = await supabase.from('facturas').update({ dias_credito: diasCredito, fecha_vencimiento: fechaVenc }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Días crédito actualizado')
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

  async function assignProveedor(facturaId: string, proveedorId: string) {
    const supabase = createClient()
    const { error } = await supabase.from('facturas').update({ proveedor_id: proveedorId }).eq('id', facturaId)
    if (error) { toast.error(error.message); return }
    toast.success('Proveedor asignado')
    loadData()
  }

  let filtered = facturas.filter((f) => {
    if (filterStatus !== 'todos' && f.estatus !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      if (!f.numero_factura.toLowerCase().includes(q) && !getProveedorNombre(f).toLowerCase().includes(q)) return false
    }
    return true
  })

  // Apply sorting
  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'numero_factura': cmp = a.numero_factura.localeCompare(b.numero_factura); break
        case 'proveedor': cmp = getProveedorNombre(a).localeCompare(getProveedorNombre(b)); break
        case 'fecha_factura': cmp = a.fecha_factura.localeCompare(b.fecha_factura); break
        case 'fecha_vencimiento': cmp = (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''); break
        case 'total': cmp = a.total - b.total; break
        case 'estatus': cmp = a.estatus.localeCompare(b.estatus); break
        case 'situacion': cmp = getSituacionOrder(a) - getSituacionOrder(b); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }

  const exportData = filtered.map(f => ({
    '# Factura': f.numero_factura,
    'Proveedor': getProveedorNombre(f),
    'Fecha': f.fecha_factura,
    'Vencimiento': f.fecha_vencimiento || '',
    'Subtotal': f.subtotal,
    'IVA': f.tipo_iva === '16' ? '16%' : f.tipo_iva === '0' ? '0%' : 'Exento',
    'Total': f.total,
    'Estatus': f.estatus,
    'Pago programado': f.fecha_programada_pago || '',
    'Observaciones': f.observaciones || '',
  }))

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6" /> Facturas</h1>
        <div className="flex gap-2">
          <ExportButton data={exportData} filename="facturas" sheetName="Facturas" />
          {userRole !== 'viewer' && (
          <ExcelImport
            templateKey="facturas"
            empresaId={empresaId}
            onSuccess={loadData}
            transformRows={async (rows) => {
              const supabase = createClient()
              const { data: provs } = await supabase.from('proveedores').select('id, id_banco, nombre_empresa').eq('empresa_id', empresaId!)
              const idBancoMap = new Map((provs || []).filter(p => p.id_banco).map((p) => [p.id_banco!.toUpperCase(), p.id]))
              const nombreMap = new Map((provs || []).map((p) => [p.nombre_empresa.toUpperCase(), p.id]))

              return rows.map((row, idx) => {
                const idBanco = String(row._id_banco || '').toUpperCase().trim()
                const nombre = String(row._proveedor_nombre || '').toUpperCase().trim()
                const proveedorId = idBancoMap.get(idBanco) || nombreMap.get(nombre) || null

                const importe = Number(row._importe) || 0

                function parseDate(val: unknown): string | null {
                  if (!val) return null
                  const s = String(val).trim()
                  if (!s) return null
                  if (/^\d{5}$/.test(s)) {
                    const d = new Date((Number(s) - 25569) * 86400 * 1000)
                    return format(d, 'yyyy-MM-dd')
                  }
                  const ddmm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
                  if (ddmm) return `${ddmm[3]}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}`
                  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
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

                const confirmacion = String(row._confirmacion || '').toUpperCase().trim()
                const importePagado = Number(row._importe_pagado) || 0
                const fechaPago = parseDate(row._fecha_pago)
                let estatus = 'pendiente'
                if (importePagado >= importe && importe > 0) estatus = 'pagada'
                else if (fechaPago) estatus = 'programada'
                else if (confirmacion === 'JUE' || confirmacion.includes('CONFIRM') || confirmacion.includes('SI')) estatus = 'aprobada'

                // If proveedor not found, save the name in observaciones
                const excelObs = String(row._observaciones || '').trim()
                let observaciones = excelObs || null
                if (!proveedorId && nombre) {
                  const provNote = `[Proveedor Excel: ${String(row._proveedor_nombre || '').trim()}]`
                  observaciones = observaciones ? `${provNote} ${observaciones}` : provNote
                }

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
                  <TableHead className="w-8"></TableHead>
                  <SortableHeader label="# Factura" column="numero_factura" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Proveedor" column="proveedor" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Fecha" column="fecha_factura" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Vencimiento" column="fecha_vencimiento" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Situación" column="situacion" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Total" column="total" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                  <SortableHeader label="Estatus" column="estatus" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <TableHead>Pago prog.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => {
                  const isExpanded = expandedId === f.id
                  const provNombre = getProveedorNombre(f)
                  return (
                    <React.Fragment key={f.id}>
                      <TableRow
                        className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? 'border-b-0 bg-muted/30' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : f.id)}
                      >
                        <TableCell className="w-8 pr-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium">{f.numero_factura}</TableCell>
                        <TableCell>
                          {provNombre ? (
                            provNombre
                          ) : (
                            <span className="text-orange-600 text-sm">Sin proveedor</span>
                          )}
                        </TableCell>
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
                          <Badge variant="outline" className={STATUS_COLORS[f.estatus]}>
                            {f.estatus.charAt(0).toUpperCase() + f.estatus.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {f.fecha_programada_pago
                            ? format(new Date(f.fecha_programada_pago + 'T12:00:00'), 'dd/MM/yy')
                            : '—'}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/30 p-4" onClick={(e) => e.stopPropagation()}>
                            <FacturaDetailPanel
                              factura={f}
                              proveedores={proveedores}
                              userRole={userRole}
                              onSaveObservaciones={saveObservaciones}
                              onSaveComprobante={saveComprobante}
                              onAssignProveedor={assignProveedor}
                              onSetPaymentDate={setPaymentDate}
                              onUpdateEstatus={updateEstatus}
                              onUpdateIva={updateIva}
                              onUpdateDiasCredito={updateDiasCredito}
                              onReload={loadData}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No hay facturas</TableCell></TableRow>
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
  proveedores,
  userRole,
  onSaveObservaciones,
  onSaveComprobante,
  onAssignProveedor,
  onSetPaymentDate,
  onUpdateEstatus,
  onUpdateIva,
  onUpdateDiasCredito,
  onReload,
}: {
  factura: FacturaExtended
  proveedores: Proveedor[]
  userRole: string | null
  onSaveObservaciones: (id: string, obs: string) => void
  onSaveComprobante: (id: string, url: string) => void
  onAssignProveedor: (facturaId: string, proveedorId: string) => void
  onSetPaymentDate: (id: string, fecha: string) => void
  onUpdateEstatus: (id: string, estatus: string) => void
  onUpdateIva: (id: string, tipoIva: '16' | '0' | 'exento') => void
  onUpdateDiasCredito: (id: string, dias: number) => void
  onReload: () => void
}) {
  const { empresaId } = useEmpresa()
  const [obs, setObs] = useState(factura.observaciones || '')
  const [showNewProv, setShowNewProv] = useState(false)
  const [newProvNombre, setNewProvNombre] = useState('')
  const [newProvRfc, setNewProvRfc] = useState('')
  const [creatingProv, setCreatingProv] = useState(false)
  const [customDate, setCustomDate] = useState(factura.fecha_programada_pago || '')

  async function handleCreateProveedor() {
    if (!newProvNombre.trim() || !newProvRfc.trim()) {
      toast.error('Nombre y RFC son requeridos')
      return
    }
    setCreatingProv(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('proveedores').insert({
      empresa_id: empresaId,
      nombre_empresa: newProvNombre.trim(),
      rfc: newProvRfc.trim().toUpperCase(),
      contacto_nombre: '',
      contacto_email: '',
      banco: '',
      clabe: '',
    }).select('id').single()
    if (error) { toast.error(error.message); setCreatingProv(false); return }
    if (data) {
      await onAssignProveedor(factura.id, data.id)
      toast.success('Proveedor creado y asignado')
      setShowNewProv(false)
      setNewProvNombre('')
      setNewProvRfc('')
      onReload()
    }
    setCreatingProv(false)
  }

  function handleScheduleDay(date: Date) {
    const fecha = format(date, 'yyyy-MM-dd')
    onSetPaymentDate(factura.id, fecha)
    setCustomDate(fecha)
    toast.success(`Pago programado para ${format(date, 'dd/MM/yyyy')}`)
  }

  // Generate today + next 10 days
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const dayBubbles = Array.from({ length: 11 }, (_, i) => {
    const d = addDays(today, i)
    return { date: d, label: i === 0 ? 'Hoy' : format(d, 'dd/MM'), dayName: format(d, 'EEE', { locale: undefined }), iso: format(d, 'yyyy-MM-dd') }
  })

  return (
    <div className="space-y-5">
      {/* Quick info bar */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">IVA:</span>
          {userRole !== 'viewer' ? (
            <Select value={factura.tipo_iva} onValueChange={(v) => onUpdateIva(factura.id, v as '16' | '0' | 'exento')}>
              <SelectTrigger className="h-7 w-[90px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16">16%</SelectItem>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="exento">Exento</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline">{factura.tipo_iva === '16' ? '16%' : factura.tipo_iva === '0' ? '0%' : 'Exento'}</Badge>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Subtotal:</span> {formatMXN(factura.subtotal)}
        </div>
        {factura.monto_iva > 0 && (
          <div><span className="text-muted-foreground">IVA:</span> {formatMXN(factura.monto_iva)}</div>
        )}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Crédito:</span>
          {userRole !== 'viewer' ? (
            <Input
              type="number"
              min={0}
              className="h-7 w-[70px] text-xs text-center"
              defaultValue={factura.dias_credito}
              onBlur={(e) => {
                const val = parseInt(e.target.value) || 0
                if (val !== factura.dias_credito) onUpdateDiasCredito(factura.id, val)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseInt((e.target as HTMLInputElement).value) || 0
                  if (val !== factura.dias_credito) onUpdateDiasCredito(factura.id, val)
                }
              }}
            />
          ) : (
            <span>{factura.dias_credito}</span>
          )}
          <span className="text-muted-foreground">días</span>
        </div>
        {factura.fecha_vencimiento && (
          <div>
            <span className="text-muted-foreground">Vencimiento:</span>{' '}
            <span className="font-medium">{format(new Date(factura.fecha_vencimiento + 'T12:00:00'), 'dd/MM/yyyy')}</span>
            {(() => {
              const status = getVencimientoStatus(factura.fecha_vencimiento, factura.estatus)
              if (!status) return null
              return <Badge variant="outline" className={`ml-1 ${status.className}`}>{status.label}</Badge>
            })()}
          </div>
        )}
        {(factura as unknown as Record<string, Record<string, string>>).ordenes_compra?.numero_oc && (
          <div>
            <span className="text-muted-foreground">OC:</span>{' '}
            {(factura as unknown as Record<string, Record<string, string>>).ordenes_compra?.numero_oc}
          </div>
        )}
        <div className="flex gap-1">
          {factura.pdf_url && (
            <a href={factura.pdf_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">PDF</Badge>
            </a>
          )}
          {factura.xml_url && (
            <a href={factura.xml_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">XML</Badge>
            </a>
          )}
          {factura.comprobante_pago_url && (
            <a href={factura.comprobante_pago_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted bg-green-50 text-green-700">Comp.</Badge>
            </a>
          )}
        </div>
        {/* Estatus changer */}
        {userRole !== 'viewer' && (
          <div className="ml-auto">
            <Select value={factura.estatus} onValueChange={(v) => onUpdateEstatus(factura.id, v)}>
              <SelectTrigger className="w-[140px] h-8">
                <Badge variant="outline" className={STATUS_COLORS[factura.estatus]}>
                  {factura.estatus.charAt(0).toUpperCase() + factura.estatus.slice(1)}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Observaciones - always visible */}
      {factura.observaciones && (
        <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
          <p className="text-sm font-medium text-blue-800 flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4" /> Observaciones
          </p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">{factura.observaciones}</p>
        </div>
      )}

      {/* Proveedor assignment */}
      {!factura.proveedor_id && userRole !== 'viewer' && (
        <div className="p-3 rounded-md border border-orange-200 bg-orange-50 space-y-3">
          <Label className="flex items-center gap-2 text-orange-800">
            <UserPlus className="h-4 w-4" /> Asignar proveedor
          </Label>
          {factura.observaciones?.includes('[Proveedor Excel:') && (
            <p className="text-sm text-orange-700">
              Del Excel: <strong>{factura.observaciones.match(/\[Proveedor Excel: (.+?)\]/)?.[1]}</strong>
            </p>
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Select onValueChange={(v) => onAssignProveedor(factura.id, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor existente..." />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre_empresa} ({p.rfc})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowNewProv(!showNewProv)}>
              <UserPlus className="h-4 w-4 mr-1" /> Crear nuevo
            </Button>
          </div>
          {showNewProv && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
              <Input placeholder="Nombre empresa *" value={newProvNombre} onChange={(e) => setNewProvNombre(e.target.value)} />
              <Input placeholder="RFC *" value={newProvRfc} onChange={(e) => setNewProvRfc(e.target.value)} className="uppercase" />
              <Button onClick={handleCreateProveedor} disabled={creatingProv}>
                {creatingProv ? 'Creando...' : 'Crear y asignar'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Payment scheduling */}
      {userRole !== 'viewer' && factura.estatus !== 'pagada' && factura.estatus !== 'rechazada' && (
        <div className="p-3 rounded-md border border-purple-200 bg-purple-50 space-y-3">
          <Label className="flex items-center gap-2 text-purple-800">
            <CalendarDays className="h-4 w-4" /> Programar pago
          </Label>
          {factura.fecha_programada_pago && (
            <p className="text-sm text-purple-700">
              Pago programado: <strong>{format(new Date(factura.fecha_programada_pago + 'T12:00:00'), 'dd/MM/yyyy')}</strong>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {dayBubbles.map(({ date, label, iso }) => (
              <button
                key={iso}
                onClick={() => handleScheduleDay(date)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                  ${factura.fecha_programada_pago === iso
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-purple-800 border-purple-300 hover:bg-purple-100'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-[180px]"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value)
                if (e.target.value) {
                  onSetPaymentDate(factura.id, e.target.value)
                  toast.success(`Pago programado para ${format(new Date(e.target.value + 'T12:00:00'), 'dd/MM/yyyy')}`)
                }
              }}
            />
            <span className="text-xs text-purple-600">o selecciona fecha personalizada</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Editable observaciones */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Editar observaciones
          </Label>
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Escribir observaciones..."
            rows={3}
            disabled={userRole === 'viewer'}
          />
          {userRole !== 'viewer' && (
            <Button size="sm" onClick={() => onSaveObservaciones(factura.id, obs)}>
              Guardar observaciones
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {/* Comprobante */}
          {userRole !== 'viewer' && (
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
          )}

          {/* Reject button */}
          {userRole !== 'viewer' && factura.estatus !== 'rechazada' && factura.estatus !== 'pagada' && (
            <div className="pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onUpdateEstatus(factura.id, 'rechazada')
                  toast.success('Factura rechazada')
                }}
                className="w-full"
              >
                <XCircle className="h-4 w-4 mr-2" /> Rechazar factura
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
