'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMXN } from '@/lib/constants'
import { toast } from 'sonner'
import { addDays, format, differenceInDays } from 'date-fns'
import type { Factura, Proveedor, Sucursal, FacturaDistribucion } from '@/lib/types'
import { ExcelImport } from '@/components/shared/excel-import'
import { ExportButton } from '@/components/shared/export-button'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { FileUpload } from '@/components/shared/file-upload'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { MoneyInput } from '@/components/shared/money-input'
import { Receipt, ChevronDown, ChevronUp, Upload, MessageSquare, UserPlus, XCircle, CalendarDays, Pencil, Plus, FileUp, AlertTriangle, Clock, CheckCircle, DollarSign, TrendingUp, Square, CheckSquare } from 'lucide-react'
import { SortableHeader } from '@/components/shared/sortable-header'
import { ProveedorCombobox } from '@/components/shared/proveedor-combobox'

// ─── CFDI XML Parser ───────────────────────────────────────────────
interface CfdiData {
  rfcEmisor: string
  nombreEmisor: string
  rfcReceptor: string
  folio: string
  serie: string
  fecha: string
  subtotal: number
  total: number
  montoIva: number
  tipoIva: '16' | '0' | 'exento'
  uuid: string
}

function parseCfdiXml(xmlText: string): CfdiData | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'text/xml')

    // Handle namespace - try both cfdi: and without namespace
    const comprobante = doc.querySelector('Comprobante') || doc.getElementsByTagName('cfdi:Comprobante')[0]
    if (!comprobante) return null

    const emisor = doc.querySelector('Emisor') || doc.getElementsByTagName('cfdi:Emisor')[0]
    const receptor = doc.querySelector('Receptor') || doc.getElementsByTagName('cfdi:Receptor')[0]

    // Get UUID from TimbreFiscalDigital
    let uuid = ''
    const timbre = doc.querySelector('TimbreFiscalDigital') || doc.getElementsByTagName('tfd:TimbreFiscalDigital')[0]
    if (timbre) uuid = timbre.getAttribute('UUID') || ''

    const subtotal = parseFloat(comprobante.getAttribute('SubTotal') || '0')
    const total = parseFloat(comprobante.getAttribute('Total') || '0')

    // Calculate IVA
    let montoIva = 0
    const impuestos = doc.querySelector('Impuestos') || doc.getElementsByTagName('cfdi:Impuestos')[0]
    if (impuestos) {
      montoIva = parseFloat(impuestos.getAttribute('TotalImpuestosTrasladados') || '0')
    }

    // Determine IVA type
    let tipoIva: '16' | '0' | 'exento' = 'exento'
    const traslados = doc.querySelectorAll('Traslado')
    const trasladosNs = doc.getElementsByTagName('cfdi:Traslado')
    const allTraslados = traslados.length > 0 ? traslados : trasladosNs
    for (let i = 0; i < allTraslados.length; i++) {
      const t = allTraslados[i]
      const tasa = t.getAttribute('TasaOCuota') || ''
      if (tasa.includes('0.16') || tasa === '0.160000') {
        tipoIva = '16'
        break
      } else if (tasa === '0.000000' || tasa === '0') {
        tipoIva = '0'
      }
    }

    const fechaStr = comprobante.getAttribute('Fecha') || ''
    const fecha = fechaStr ? fechaStr.substring(0, 10) : ''

    return {
      rfcEmisor: emisor?.getAttribute('Rfc') || '',
      nombreEmisor: emisor?.getAttribute('Nombre') || '',
      rfcReceptor: receptor?.getAttribute('Rfc') || '',
      folio: comprobante.getAttribute('Folio') || '',
      serie: comprobante.getAttribute('Serie') || '',
      fecha,
      subtotal,
      total,
      montoIva,
      tipoIva,
      uuid,
    }
  } catch {
    return null
  }
}

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  aprobada: 'bg-blue-100 text-blue-800',
  programada: 'bg-purple-100 text-purple-800',
  pagada: 'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-800',
}

const STATUSES = ['pendiente', 'aprobada', 'programada', 'pagada', 'rechazada']

function getVencimientoStatus(fechaVencimiento: string | null | undefined, estatus: string, fechaFactura?: string): { label: string; className: string } | null {
  const fecha = fechaVencimiento || fechaFactura || null
  if (!fecha || estatus === 'pagada' || estatus === 'rechazada') return null
  const venc = new Date(fecha + 'T12:00:00')
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
  const status = getVencimientoStatus(f.fecha_vencimiento, f.estatus, f.fecha_factura)
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
  const [filterStatus, setFilterStatus] = useState('por_pagar')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { empresaId, userRole } = useEmpresa()
  const [showForm, setShowForm] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkCuentaId, setBulkCuentaId] = useState('')
  const [bulkFechaPago, setBulkFechaPago] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [cuentas, setCuentas] = useState<{ id: string; nombre: string; banco: string }[]>([])

  // New factura form state
  const [formNumero, setFormNumero] = useState('')
  const [formProveedorId, setFormProveedorId] = useState('')
  const [formFecha, setFormFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formDiasCredito, setFormDiasCredito] = useState(0)
  const [formTotal, setFormTotal] = useState(0)
  const [formTipoIva, setFormTipoIva] = useState<'16' | '0' | 'exento'>('16')
  const [formNotas, setFormNotas] = useState('')
  const [formPdfUrl, setFormPdfUrl] = useState('')
  const [formXmlUrl, setFormXmlUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [importMode, setImportMode] = useState<'manual' | 'xml' | null>(null)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [formSucursalId, setFormSucursalId] = useState('')

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const [facturasRes, provsRes, sucRes, cuentasRes] = await Promise.all([
      supabase.from('facturas').select('*, proveedores(nombre_empresa), ordenes_compra(numero_oc), sucursales(id, nombre)').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      supabase.from('proveedores').select('*').eq('empresa_id', empresaId).eq('activo', true).order('nombre_empresa'),
      supabase.from('sucursales').select('*').eq('empresa_id', empresaId).eq('activa', true).order('nombre'),
      supabase.from('cuentas_bancarias').select('id, nombre, banco').eq('empresa_id', empresaId).eq('activa', true).order('nombre'),
    ])
    setFacturas(facturasRes.data || [])
    setProveedores(provsRes.data || [])
    setSucursales(sucRes.data || [])
    setCuentas(cuentasRes.data || [])
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

  function resetForm() {
    setFormNumero(''); setFormProveedorId(''); setFormFecha(format(new Date(), 'yyyy-MM-dd'))
    setFormDiasCredito(0); setFormTotal(0); setFormTipoIva('16'); setFormNotas('')
    setFormPdfUrl(''); setFormXmlUrl(''); setImportMode(null); setFormSucursalId('')
  }

  async function handleNewFactura(e: React.FormEvent) {
    e.preventDefault()
    if (!formNumero.trim()) { toast.error('El número de factura es requerido'); return }
    if (!formProveedorId) { toast.error('Selecciona un proveedor'); return }
    if (formTotal <= 0) { toast.error('El monto debe ser mayor a 0'); return }

    setSubmitting(true)
    const supabase = createClient()

    let subtotal: number, montoIva: number
    if (formTipoIva === '16') {
      subtotal = Math.round((formTotal / 1.16) * 100) / 100
      montoIva = Math.round((formTotal - subtotal) * 100) / 100
    } else {
      subtotal = formTotal
      montoIva = 0
    }

    const fechaVenc = formDiasCredito > 0
      ? format(addDays(new Date(formFecha + 'T12:00:00'), formDiasCredito), 'yyyy-MM-dd')
      : formFecha

    const { error } = await supabase.from('facturas').insert({
      empresa_id: empresaId,
      proveedor_id: formProveedorId,
      sucursal_id: formSucursalId || null,
      numero_factura: formNumero.trim(),
      fecha_factura: formFecha,
      dias_credito: formDiasCredito,
      fecha_vencimiento: fechaVenc,
      subtotal,
      tipo_iva: formTipoIva,
      monto_iva: montoIva,
      total: formTotal,
      estatus: 'pendiente',
      pdf_url: formPdfUrl || null,
      xml_url: formXmlUrl || null,
      notas: formNotas || null,
    })

    setSubmitting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Factura creada exitosamente')
    resetForm()
    setShowForm(false)
    loadData()
  }

  async function handleXmlImport(file: File) {
    const text = await file.text()
    const cfdi = parseCfdiXml(text)
    if (!cfdi) {
      toast.error('No se pudo leer el XML. Verifica que sea un CFDI válido.')
      return
    }

    // Try to match proveedor by RFC
    const matchedProv = proveedores.find(p => p.rfc.toUpperCase() === cfdi.rfcEmisor.toUpperCase())

    // Auto-fill form
    const folio = cfdi.serie ? `${cfdi.serie}-${cfdi.folio}` : cfdi.folio
    setFormNumero(folio || cfdi.uuid.substring(0, 8).toUpperCase())
    setFormFecha(cfdi.fecha || format(new Date(), 'yyyy-MM-dd'))
    setFormTotal(cfdi.total)
    setFormTipoIva(cfdi.tipoIva)
    if (matchedProv) {
      setFormProveedorId(matchedProv.id)
    } else {
      setFormNotas(`Emisor XML: ${cfdi.nombreEmisor} (RFC: ${cfdi.rfcEmisor})`)
    }

    // Upload XML file to storage
    const supabase = createClient()
    const path = `xml/${empresaId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('facturas').upload(path, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('facturas').getPublicUrl(path)
      setFormXmlUrl(urlData.publicUrl)
    }

    setImportMode('xml')
    setShowForm(true)

    if (matchedProv) {
      toast.success(`XML procesado: ${cfdi.nombreEmisor} - ${formatMXN(cfdi.total)}`)
    } else {
      toast.info(`XML procesado. Emisor "${cfdi.nombreEmisor}" (${cfdi.rfcEmisor}) no encontrado en proveedores. Selecciona uno manualmente.`)
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
    // Auto-change status to 'programada' when scheduling a payment date
    await supabase.from('facturas').update({ fecha_programada_pago: fecha, estatus: 'programada' }).eq('id', id)
    loadData()
  }

  async function updateNumeroFactura(id: string, numero: string) {
    if (!numero.trim()) { toast.error('El número de factura no puede estar vacío'); return }
    const supabase = createClient()
    const { error } = await supabase.from('facturas').update({ numero_factura: numero.trim() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Número de factura actualizado')
    loadData()
  }

  async function updateFechaFactura(id: string, fecha: string) {
    if (!fecha) return
    const factura = facturas.find(f => f.id === id)
    if (!factura) return
    const supabase = createClient()
    const updates: Record<string, unknown> = { fecha_factura: fecha }
    updates.fecha_vencimiento = format(addDays(new Date(fecha + 'T12:00:00'), factura.dias_credito || 0), 'yyyy-MM-dd')
    const { error } = await supabase.from('facturas').update(updates).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Fecha de factura actualizada')
    loadData()
  }

  async function updateTotal(id: string, newTotal: number) {
    if (newTotal <= 0) { toast.error('El monto debe ser mayor a 0'); return }
    const factura = facturas.find(f => f.id === id)
    if (!factura) return
    const supabase = createClient()
    let subtotal: number, montoIva: number
    if (factura.tipo_iva === '16') {
      subtotal = Math.round((newTotal / 1.16) * 100) / 100
      montoIva = Math.round((newTotal - subtotal) * 100) / 100
    } else {
      subtotal = newTotal
      montoIva = 0
    }
    const { error } = await supabase.from('facturas').update({ total: newTotal, subtotal, monto_iva: montoIva }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Monto actualizado')
    loadData()
  }

  async function updateIva(id: string, tipoIva: '16' | '0' | 'exento') {
    const factura = facturas.find(f => f.id === id)
    if (!factura) return
    const supabase = createClient()
    // Use current total as the base: if switching to 16%, reverse-calculate subtotal from total
    // (total already includes IVA when the factura was loaded)
    const currentTotal = factura.total
    let subtotal: number
    let montoIva: number
    let total: number
    if (tipoIva === '16') {
      subtotal = Math.round((currentTotal / 1.16) * 100) / 100
      montoIva = Math.round((currentTotal - subtotal) * 100) / 100
      total = currentTotal
    } else {
      // 0% or exento: subtotal = total, no IVA
      subtotal = currentTotal
      montoIva = 0
      total = currentTotal
    }
    const { error } = await supabase.from('facturas').update({ tipo_iva: tipoIva, monto_iva: montoIva, subtotal, total }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('IVA actualizado')
    loadData()
  }

  async function updateDiasCredito(id: string, diasCredito: number) {
    const factura = facturas.find(f => f.id === id)
    if (!factura) return
    const supabase = createClient()
    const fechaVenc = format(addDays(new Date(factura.fecha_factura + 'T12:00:00'), diasCredito), 'yyyy-MM-dd')
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
    if (filterStatus === 'por_pagar') {
      if (f.estatus === 'pagada' || f.estatus === 'rechazada') return false
    } else if (filterStatus === 'vencidas') {
      if (f.estatus === 'pagada' || f.estatus === 'rechazada') return false
      const fecha = f.fecha_vencimiento || f.fecha_factura
      if (!fecha) return false
      if (new Date(fecha + 'T12:00:00') >= new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00')) return false
    } else if (filterStatus !== 'todos' && f.estatus !== filterStatus) {
      return false
    }
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

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(f => f.id)))
    }
  }

  async function bulkMarkPagada() {
    if (selectedIds.size === 0) return
    const supabase = createClient()
    const updates: Record<string, unknown> = {
      estatus: 'pagada',
      fecha_programada_pago: bulkFechaPago,
    }
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('facturas').update(updates).in('id', ids)
    if (error) { toast.error(error.message); return }
    toast.success(`${ids.length} factura(s) marcadas como pagadas`)
    setSelectedIds(new Set())
    setShowBulkModal(false)
    loadData()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6" /> Facturas</h1>
        <div className="flex gap-2">
          <ExportButton data={exportData} filename="facturas" sheetName="Facturas" />
          {userRole !== 'viewer' && (
            <>
              {/* XML/PDF Import zone */}
              <div className="relative">
                <input
                  type="file"
                  accept=".xml"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleXmlImport(file)
                      e.target.value = ''
                    }
                  }}
                />
                <Button variant="outline">
                  <FileUp className="h-4 w-4 mr-2" /> Importar XML
                </Button>
              </div>
              <Button onClick={() => { resetForm(); setShowForm(!showForm) }}>
                <Plus className="h-4 w-4 mr-2" /> Nueva factura
              </Button>
            </>
          )}
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

      {/* ─── Dashboard Summary ──────────────────────────── */}
      {(() => {
        const pendientes = facturas.filter(f => f.estatus === 'pendiente')
        const aprobadas = facturas.filter(f => f.estatus === 'aprobada')
        const programadas = facturas.filter(f => f.estatus === 'programada')
        const pagadas = facturas.filter(f => f.estatus === 'pagada')
        const vencidas = facturas.filter(f => {
          if (f.estatus === 'pagada' || f.estatus === 'rechazada') return false
          const fecha = f.fecha_vencimiento || f.fecha_factura
          if (!fecha) return false
          return new Date(fecha + 'T12:00:00') < new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00')
        })
        const porPagar = facturas.filter(f => f.estatus !== 'pagada' && f.estatus !== 'rechazada')

        const totalPendiente = pendientes.reduce((s, f) => s + f.total, 0)
        const totalProgramada = programadas.reduce((s, f) => s + f.total, 0)
        const totalPagada = pagadas.reduce((s, f) => s + f.total, 0)
        const totalVencida = vencidas.reduce((s, f) => s + f.total, 0)
        const totalPorPagar = porPagar.reduce((s, f) => s + f.total, 0)

        // Top proveedores by pending amount
        const provPending = new Map<string, { nombre: string; total: number; count: number }>()
        porPagar.forEach(f => {
          const nombre = getProveedorNombre(f) || 'Sin proveedor'
          const prev = provPending.get(nombre) || { nombre, total: 0, count: 0 }
          prev.total += f.total
          prev.count += 1
          provPending.set(nombre, prev)
        })
        const topProveedores = Array.from(provPending.values()).sort((a, b) => b.total - a.total).slice(0, 5)

        // Bubble filter config
        const bubbles = [
          { key: 'por_pagar', label: 'Por pagar', count: porPagar.length, amount: totalPorPagar, icon: <DollarSign className="h-3.5 w-3.5" />, colors: 'border-blue-300 bg-blue-50 text-blue-800', active: 'bg-blue-600 text-white border-blue-600' },
          { key: 'vencidas', label: 'Vencidas', count: vencidas.length, amount: totalVencida, icon: <AlertTriangle className="h-3.5 w-3.5" />, colors: 'border-red-300 bg-red-50 text-red-800', active: 'bg-red-600 text-white border-red-600' },
          { key: 'pendiente', label: 'Pendientes', count: pendientes.length, amount: totalPendiente, icon: <Clock className="h-3.5 w-3.5" />, colors: 'border-yellow-300 bg-yellow-50 text-yellow-800', active: 'bg-yellow-600 text-white border-yellow-600' },
          { key: 'aprobada', label: 'Aprobadas', count: aprobadas.length, amount: aprobadas.reduce((s, f) => s + f.total, 0), icon: <CheckCircle className="h-3.5 w-3.5" />, colors: 'border-blue-300 bg-blue-50 text-blue-700', active: 'bg-blue-500 text-white border-blue-500' },
          { key: 'programada', label: 'Programadas', count: programadas.length, amount: totalProgramada, icon: <CalendarDays className="h-3.5 w-3.5" />, colors: 'border-purple-300 bg-purple-50 text-purple-800', active: 'bg-purple-600 text-white border-purple-600' },
          { key: 'pagada', label: 'Pagadas', count: pagadas.length, amount: totalPagada, icon: <CheckCircle className="h-3.5 w-3.5" />, colors: 'border-green-300 bg-green-50 text-green-800', active: 'bg-green-600 text-white border-green-600' },
          { key: 'todos', label: 'Todas', count: facturas.length, amount: facturas.reduce((s, f) => s + f.total, 0), icon: <Receipt className="h-3.5 w-3.5" />, colors: 'border-gray-300 bg-gray-50 text-gray-700', active: 'bg-gray-700 text-white border-gray-700' },
        ]

        return (
          <>
            {/* Bubble filters */}
            <div className="flex flex-wrap gap-2">
              {bubbles.map(b => (
                <button
                  key={b.key}
                  onClick={() => { setFilterStatus(b.key); setSelectedIds(new Set()) }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    filterStatus === b.key ? b.active : b.colors + ' hover:shadow-sm'
                  }`}
                >
                  {b.icon}
                  <span>{b.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterStatus === b.key ? 'bg-white/20' : 'bg-white/80'}`}>
                    {b.count}
                  </span>
                  <span className={`text-xs font-normal ${filterStatus === b.key ? 'text-white/80' : 'opacity-70'}`}>
                    {formatMXN(b.amount)}
                  </span>
                </button>
              ))}
            </div>

            {/* Summary row + Top proveedores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status distribution bar */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Distribución por estatus</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const total = facturas.length
                    if (total === 0) return <p className="text-sm text-muted-foreground">Sin facturas</p>
                    const segments = [
                      { label: 'Pendiente', count: pendientes.length, color: 'bg-yellow-400', key: 'pendiente' },
                      { label: 'Aprobada', count: aprobadas.length, color: 'bg-blue-400', key: 'aprobada' },
                      { label: 'Programada', count: programadas.length, color: 'bg-purple-400', key: 'programada' },
                      { label: 'Pagada', count: pagadas.length, color: 'bg-green-400', key: 'pagada' },
                      { label: 'Rechazada', count: facturas.filter(f => f.estatus === 'rechazada').length, color: 'bg-red-400', key: 'rechazada' },
                    ].filter(s => s.count > 0)
                    return (
                      <div className="space-y-2">
                        <div className="flex w-full h-4 rounded-full overflow-hidden">
                          {segments.map(s => (
                            <div key={s.label} className={`${s.color} transition-all cursor-pointer hover:opacity-80`} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} onClick={() => setFilterStatus(s.key)} />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {segments.map(s => (
                            <button key={s.label} className="flex items-center gap-1.5 hover:underline" onClick={() => setFilterStatus(s.key)}>
                              <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                              <span>{s.label}: {s.count} ({Math.round((s.count / total) * 100)}%)</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>

              {/* Top proveedores */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Top proveedores (por pagar)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topProveedores.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay facturas pendientes</p>
                  ) : (
                    <div className="space-y-2">
                      {topProveedores.map((p, i) => {
                        const maxTotal = topProveedores[0].total
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="truncate max-w-[200px]">{p.nombre}</span>
                              <span className="font-medium text-right">{formatMXN(p.total)} <span className="text-muted-foreground text-xs">({p.count})</span></span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(p.total / maxTotal) * 100}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )
      })()}

      {/* Search + bulk actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar por # factura o proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {selectedIds.size > 0 && userRole !== 'viewer' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedIds.size} seleccionada(s)</span>
            <span className="text-sm font-medium">
              {formatMXN(filtered.filter(f => selectedIds.has(f.id)).reduce((s, f) => s + f.total, 0))}
            </span>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setShowBulkModal(true)}>
              <CheckCircle className="h-4 w-4 mr-1" /> Marcar pagada(s)
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
              Deseleccionar
            </Button>
          </div>
        )}
      </div>

      {/* Bulk payment modal */}
      {showBulkModal && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Marcar {selectedIds.size} factura(s) como pagada(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground mb-2">
              Total: <span className="font-bold text-green-800">{formatMXN(filtered.filter(f => selectedIds.has(f.id)).reduce((s, f) => s + f.total, 0))}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Fecha de pago</Label>
                <Input type="date" value={bulkFechaPago} onChange={e => setBulkFechaPago(e.target.value)} />
              </div>
              {cuentas.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-sm">Cuenta de pago (opcional)</Label>
                  <Select value={bulkCuentaId} onValueChange={setBulkCuentaId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin especificar</SelectItem>
                      {cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} — {c.banco}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {/* List selected facturas */}
            <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-md p-2 bg-white">
              {filtered.filter(f => selectedIds.has(f.id)).map(f => (
                <div key={f.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                  <span>{f.numero_factura} — {getProveedorNombre(f) || 'Sin proveedor'}</span>
                  <span className="font-medium">{formatMXN(f.total)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowBulkModal(false)}>Cancelar</Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={bulkMarkPagada}>
                <CheckCircle className="h-4 w-4 mr-1" /> Confirmar pago
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── New Factura Form ──────────────────────────────── */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importMode === 'xml' ? <FileUp className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {importMode === 'xml' ? 'Factura desde XML' : 'Nueva factura manual'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNewFactura} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label># Factura *</Label>
                  <Input value={formNumero} onChange={(e) => setFormNumero(e.target.value)} placeholder="Ej: A-001" required />
                </div>
                <div className="space-y-2">
                  <Label>Proveedor *</Label>
                  <ProveedorCombobox
                    proveedores={proveedores}
                    value={formProveedorId}
                    onValueChange={setFormProveedorId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sucursal</Label>
                  <Select value={formSucursalId} onValueChange={setFormSucursalId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar sucursal..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin sucursal</SelectItem>
                      {sucursales.map(s => (<SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha factura *</Label>
                  <Input type="date" value={formFecha} onChange={(e) => setFormFecha(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Total (con IVA) *</Label>
                  <MoneyInput value={formTotal} onChange={setFormTotal} />
                </div>
                <div className="space-y-2">
                  <Label>IVA</Label>
                  <Select value={formTipoIva} onValueChange={(v) => setFormTipoIva(v as '16' | '0' | 'exento')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16">16%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="exento">Exento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Días crédito</Label>
                  <Input type="number" min={0} value={formDiasCredito} onChange={(e) => setFormDiasCredito(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Vencimiento</Label>
                  <Input
                    type="date"
                    value={formDiasCredito > 0 ? format(addDays(new Date(formFecha + 'T12:00:00'), formDiasCredito), 'yyyy-MM-dd') : formFecha}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              {/* Desglose IVA automático */}
              {formTotal > 0 && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  {formTipoIva === '16' ? (
                    <>Subtotal: {formatMXN(Math.round((formTotal / 1.16) * 100) / 100)} | IVA 16%: {formatMXN(Math.round((formTotal - formTotal / 1.16) * 100) / 100)} | Total: {formatMXN(formTotal)}</>
                  ) : (
                    <>Subtotal: {formatMXN(formTotal)} | IVA: $0.00 | Total: {formatMXN(formTotal)}</>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PDF de factura</Label>
                  <FileUpload
                    bucket="facturas"
                    folder={`pdf/${empresaId}`}
                    accept=".pdf"
                    label="Subir PDF de factura"
                    value={formPdfUrl || undefined}
                    onUpload={(url) => setFormPdfUrl(url)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>XML de factura</Label>
                  {formXmlUrl ? (
                    <div className="flex items-center gap-2 rounded-md border p-2 bg-muted/50">
                      <FileUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate flex-1">XML cargado</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setFormXmlUrl('')}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <FileUpload
                      bucket="facturas"
                      folder={`xml/${empresaId}`}
                      accept=".xml"
                      label="Subir XML de factura"
                      onUpload={(url) => setFormXmlUrl(url)}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={formNotas} onChange={(e) => setFormNotas(e.target.value)} placeholder="Notas o comentarios..." rows={2} />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Guardando...' : 'Guardar factura'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false) }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {userRole !== 'viewer' && (
                    <TableHead className="w-8 pr-0">
                      <button onClick={(e) => { e.stopPropagation(); toggleSelectAll() }} className="p-1">
                        {selectedIds.size === filtered.length && filtered.length > 0
                          ? <CheckSquare className="h-4 w-4 text-blue-600" />
                          : <Square className="h-4 w-4 text-muted-foreground" />
                        }
                      </button>
                    </TableHead>
                  )}
                  <TableHead className="w-8"></TableHead>
                  <SortableHeader label="# Factura" column="numero_factura" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Proveedor" column="proveedor" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <TableHead>Sucursal</TableHead>
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
                        className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? 'border-b-0 bg-muted/30' : ''} ${selectedIds.has(f.id) ? 'bg-blue-50' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : f.id)}
                      >
                        {userRole !== 'viewer' && (
                          <TableCell className="w-8 pr-0" onClick={e => e.stopPropagation()}>
                            <button onClick={() => toggleSelect(f.id)} className="p-1">
                              {selectedIds.has(f.id)
                                ? <CheckSquare className="h-4 w-4 text-blue-600" />
                                : <Square className="h-4 w-4 text-muted-foreground" />
                              }
                            </button>
                          </TableCell>
                        )}
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
                        <TableCell className="text-xs">
                          {(f as unknown as Record<string, Record<string, string>>).sucursales?.nombre || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{format(new Date(f.fecha_factura + 'T12:00:00'), 'dd/MM/yy')}</TableCell>
                        <TableCell>
                          {(f.fecha_vencimiento || f.fecha_factura) ? format(new Date((f.fecha_vencimiento || f.fecha_factura) + 'T12:00:00'), 'dd/MM/yy') : '—'}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const status = getVencimientoStatus(f.fecha_vencimiento, f.estatus, f.fecha_factura)
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
                          <TableCell colSpan={11} className="bg-muted/30 p-4" onClick={(e) => e.stopPropagation()}>
                            <FacturaDetailPanel
                              factura={f}
                              proveedores={proveedores}
                              sucursales={sucursales}
                              userRole={userRole}
                              onSaveObservaciones={saveObservaciones}
                              onSaveComprobante={saveComprobante}
                              onAssignProveedor={assignProveedor}
                              onSetPaymentDate={setPaymentDate}
                              onUpdateEstatus={updateEstatus}
                              onUpdateIva={updateIva}
                              onUpdateDiasCredito={updateDiasCredito}
                              onUpdateNumeroFactura={updateNumeroFactura}
                              onUpdateFechaFactura={updateFechaFactura}
                              onUpdateTotal={updateTotal}
                              onReload={loadData}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No hay facturas con este filtro</TableCell></TableRow>
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
  sucursales,
  userRole,
  onSaveObservaciones,
  onSaveComprobante,
  onAssignProveedor,
  onSetPaymentDate,
  onUpdateEstatus,
  onUpdateIva,
  onUpdateDiasCredito,
  onUpdateNumeroFactura,
  onUpdateFechaFactura,
  onUpdateTotal,
  onReload,
}: {
  factura: FacturaExtended
  proveedores: Proveedor[]
  sucursales: Sucursal[]
  userRole: string | null
  onSaveObservaciones: (id: string, obs: string) => void
  onSaveComprobante: (id: string, url: string) => void
  onAssignProveedor: (facturaId: string, proveedorId: string) => void
  onSetPaymentDate: (id: string, fecha: string) => void
  onUpdateEstatus: (id: string, estatus: string) => void
  onUpdateIva: (id: string, tipoIva: '16' | '0' | 'exento') => void
  onUpdateDiasCredito: (id: string, dias: number) => void
  onUpdateNumeroFactura: (id: string, numero: string) => void
  onUpdateFechaFactura: (id: string, fecha: string) => void
  onUpdateTotal: (id: string, total: number) => void
  onReload: () => void
}) {
  const { empresaId } = useEmpresa()
  const [obs, setObs] = useState(factura.observaciones || '')
  const [showNewProv, setShowNewProv] = useState(false)
  const [newProvNombre, setNewProvNombre] = useState('')
  const [newProvRfc, setNewProvRfc] = useState('')
  const [creatingProv, setCreatingProv] = useState(false)
  const [customDate, setCustomDate] = useState(factura.fecha_programada_pago || '')
  const [distribuciones, setDistribuciones] = useState<FacturaDistribucion[]>([])
  const [showSplit, setShowSplit] = useState(false)
  const [splitRows, setSplitRows] = useState<{ sucursal_id: string; monto: number }[]>([])

  // Load distribuciones
  useEffect(() => {
    const supabase = createClient()
    supabase.from('factura_distribuciones')
      .select('*, sucursales(id, nombre)')
      .eq('factura_id', factura.id)
      .then(({ data }) => {
        setDistribuciones(data || [])
      })
  }, [factura.id])

  async function updateSucursal(sucursalId: string) {
    const supabase = createClient()
    await supabase.from('facturas').update({ sucursal_id: sucursalId === 'none' ? null : sucursalId }).eq('id', factura.id)
    toast.success('Sucursal actualizada')
    onReload()
  }

  function initSplit() {
    if (distribuciones.length > 0) {
      setSplitRows(distribuciones.map(d => ({ sucursal_id: d.sucursal_id, monto: d.monto })))
    } else if (sucursales.length > 0) {
      const montoEach = Math.round((factura.total / sucursales.length) * 100) / 100
      setSplitRows(sucursales.map(s => ({ sucursal_id: s.id, monto: montoEach })))
    }
    setShowSplit(true)
  }

  async function saveSplit() {
    const totalSplit = splitRows.reduce((s, r) => s + r.monto, 0)
    const diff = Math.abs(totalSplit - factura.total)
    if (diff > 0.02) {
      toast.error(`La suma (${formatMXN(totalSplit)}) no coincide con el total (${formatMXN(factura.total)})`)
      return
    }
    const supabase = createClient()
    // Delete existing
    await supabase.from('factura_distribuciones').delete().eq('factura_id', factura.id)
    // Insert new
    const rows = splitRows.filter(r => r.monto > 0).map(r => ({
      factura_id: factura.id,
      sucursal_id: r.sucursal_id,
      monto: r.monto,
      porcentaje: Math.round((r.monto / factura.total) * 10000) / 100,
    }))
    if (rows.length > 0) {
      await supabase.from('factura_distribuciones').insert(rows)
    }
    // Clear single sucursal_id since it's now split
    await supabase.from('facturas').update({ sucursal_id: null }).eq('id', factura.id)
    toast.success('Distribución guardada')
    setShowSplit(false)
    onReload()
    // Reload distribuciones
    const { data } = await supabase.from('factura_distribuciones').select('*, sucursales(id, nombre)').eq('factura_id', factura.id)
    setDistribuciones(data || [])
  }

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
          {userRole !== 'viewer' && <Pencil className="h-3 w-3 text-muted-foreground mr-0.5" />}
          <span className="text-muted-foreground"># Factura:</span>
          {userRole !== 'viewer' ? (
            <Input
              className="h-7 w-[120px] text-xs"
              defaultValue={factura.numero_factura}
              onBlur={(e) => {
                const val = e.target.value.trim()
                if (val && val !== factura.numero_factura) onUpdateNumeroFactura(factura.id, val)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val && val !== factura.numero_factura) onUpdateNumeroFactura(factura.id, val)
                }
              }}
            />
          ) : (
            <span className="font-medium">{factura.numero_factura}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Fecha:</span>
          {userRole !== 'viewer' ? (
            <Input
              type="date"
              className="h-7 w-[140px] text-xs"
              defaultValue={factura.fecha_factura}
              onChange={(e) => {
                if (e.target.value && e.target.value !== factura.fecha_factura) {
                  onUpdateFechaFactura(factura.id, e.target.value)
                }
              }}
            />
          ) : (
            <span>{format(new Date(factura.fecha_factura + 'T12:00:00'), 'dd/MM/yyyy')}</span>
          )}
        </div>
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
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Total:</span>
          {userRole !== 'viewer' ? (
            <Input
              type="number"
              className="h-7 w-[130px] text-xs"
              defaultValue={factura.total}
              step="0.01"
              min="0"
              onBlur={(e) => {
                const val = Number(e.target.value)
                if (val > 0 && val !== factura.total) onUpdateTotal(factura.id, val)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = Number((e.target as HTMLInputElement).value)
                  if (val > 0 && val !== factura.total) onUpdateTotal(factura.id, val)
                }
              }}
            />
          ) : (
            <span className="font-medium">{formatMXN(factura.total)}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Subtotal: {formatMXN(factura.subtotal)}
          {factura.monto_iva > 0 && <> | IVA: {formatMXN(factura.monto_iva)}</>}
        </div>
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
        {(factura.fecha_vencimiento || factura.fecha_factura) && (
          <div>
            <span className="text-muted-foreground">Vencimiento:</span>{' '}
            <span className="font-medium">{format(new Date((factura.fecha_vencimiento || factura.fecha_factura) + 'T12:00:00'), 'dd/MM/yyyy')}</span>
            {(() => {
              const status = getVencimientoStatus(factura.fecha_vencimiento, factura.estatus, factura.fecha_factura)
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

      {/* Sucursal assignment and split */}
      {userRole !== 'viewer' && sucursales.length > 0 && (
        <div className="p-3 rounded-md border border-indigo-200 bg-indigo-50 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-indigo-800 font-medium">Sucursal</Label>
            <div className="flex gap-2">
              {distribuciones.length === 0 && (
                <Select
                  value={factura.sucursal_id || 'none'}
                  onValueChange={updateSucursal}
                >
                  <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin sucursal</SelectItem>
                    {sucursales.map(s => (<SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
              {sucursales.length > 1 && (
                <Button variant="outline" size="sm" onClick={initSplit} className="text-indigo-700 border-indigo-300">
                  Dividir gasto
                </Button>
              )}
            </div>
          </div>

          {/* Show existing distribuciones */}
          {distribuciones.length > 0 && !showSplit && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-indigo-700">Distribución actual:</p>
              {distribuciones.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span>{(d as unknown as Record<string, Record<string, string>>).sucursales?.nombre}</span>
                  <span className="font-medium">{formatMXN(d.monto)} ({d.porcentaje}%)</span>
                </div>
              ))}
            </div>
          )}

          {/* Split editor */}
          {showSplit && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-indigo-700">
                Dividir {formatMXN(factura.total)} entre sucursales:
              </p>
              {splitRows.map((row, idx) => {
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={row.sucursal_id} onValueChange={(v) => {
                      const newRows = [...splitRows]
                      newRows[idx].sucursal_id = v
                      setSplitRows(newRows)
                    }}>
                      <SelectTrigger className="h-8 w-[160px] text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sucursales.map(s => (<SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 w-[120px] text-sm"
                      value={row.monto}
                      onChange={(e) => {
                        const newRows = [...splitRows]
                        newRows[idx].monto = Number(e.target.value) || 0
                        setSplitRows(newRows)
                      }}
                    />
                    <span className="text-xs text-indigo-600">
                      {factura.total > 0 ? `${Math.round((row.monto / factura.total) * 100)}%` : '0%'}
                    </span>
                    <button
                      onClick={() => setSplitRows(splitRows.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSplitRows([...splitRows, { sucursal_id: sucursales[0]?.id || '', monto: 0 }])}>
                    <Plus className="h-3 w-3 mr-1" /> Agregar fila
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    // Dividir equitativamente
                    const montoEach = Math.round((factura.total / splitRows.length) * 100) / 100
                    setSplitRows(splitRows.map(r => ({ ...r, monto: montoEach })))
                  }}>
                    Dividir partes iguales
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${Math.abs(splitRows.reduce((s, r) => s + r.monto, 0) - factura.total) < 0.02 ? 'text-green-700' : 'text-red-600'}`}>
                    Suma: {formatMXN(splitRows.reduce((s, r) => s + r.monto, 0))}
                  </span>
                  <Button size="sm" onClick={saveSplit} className="bg-indigo-600 hover:bg-indigo-700">Guardar</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowSplit(false)}>Cancelar</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
              <ProveedorCombobox
                proveedores={proveedores}
                value=""
                onValueChange={(v) => onAssignProveedor(factura.id, v)}
                placeholder="Seleccionar proveedor existente..."
              />
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
