'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatMXN } from '@/lib/constants'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { ExportButton } from '@/components/shared/export-button'
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  DollarSign,
  CalendarClock,
  CreditCard,
  TrendingDown,
} from 'lucide-react'

// --- Interfaces ---

interface Credito {
  id: string
  empresa_id: string
  nombre: string
  tipo: string
  institucion: string | null
  monto_original: number
  saldo_actual: number
  tasa_interes: number | null
  fecha_inicio: string | null
  fecha_vencimiento: string | null
  pago_mensual: number | null
  dia_pago: number | null
  estatus: string
  notas: string | null
  created_at: string
}

interface CreditoPago {
  id: string
  credito_id: string
  fecha: string
  monto_capital: number
  monto_interes: number
  monto_total: number
  notas: string | null
  created_at: string
}

// --- Constants ---

const TIPOS_CREDITO = [
  { value: 'credito', label: 'Crédito' },
  { value: 'linea_credito', label: 'Línea de crédito' },
  { value: 'prestamo', label: 'Préstamo' },
]

const ESTATUS_CREDITO = [
  { value: 'activo', label: 'Activo', color: 'bg-green-100 text-green-800' },
  { value: 'liquidado', label: 'Liquidado', color: 'bg-blue-100 text-blue-800' },
  { value: 'vencido', label: 'Vencido', color: 'bg-red-100 text-red-800' },
]

// --- Page component ---

export default function CreditosPage() {
  const { empresaId, userRole } = useEmpresa()
  const [creditos, setCreditos] = useState<Credito[]>([])
  const [pagos, setPagos] = useState<Record<string, CreditoPago[]>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pagoFormId, setPagoFormId] = useState<string | null>(null)

  // New credit form state
  const [formNombre, setFormNombre] = useState('')
  const [formTipo, setFormTipo] = useState('credito')
  const [formInstitucion, setFormInstitucion] = useState('')
  const [formMontoOriginal, setFormMontoOriginal] = useState('')
  const [formSaldoActual, setFormSaldoActual] = useState('')
  const [formTasaInteres, setFormTasaInteres] = useState('')
  const [formPagoMensual, setFormPagoMensual] = useState('')
  const [formDiaPago, setFormDiaPago] = useState('')
  const [formFechaInicio, setFormFechaInicio] = useState('')
  const [formFechaVencimiento, setFormFechaVencimiento] = useState('')
  const [formNotas, setFormNotas] = useState('')

  // Edit credit state
  const [editData, setEditData] = useState<{
    nombre: string
    tipo: string
    institucion: string
    monto_original: string
    saldo_actual: string
    tasa_interes: string
    pago_mensual: string
    dia_pago: string
    fecha_inicio: string
    fecha_vencimiento: string
    estatus: string
    notas: string
  }>({
    nombre: '', tipo: 'credito', institucion: '', monto_original: '', saldo_actual: '',
    tasa_interes: '', pago_mensual: '', dia_pago: '', fecha_inicio: '', fecha_vencimiento: '',
    estatus: 'activo', notas: '',
  })

  // Pago form state
  const [pagoFecha, setPagoFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [pagoCapital, setPagoCapital] = useState('')
  const [pagoInteres, setPagoInteres] = useState('')
  const [pagoNotas, setPagoNotas] = useState('')

  // --- Data loading ---

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const { data: creditosData, error: creditosErr } = await supabase
      .from('creditos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })

    if (creditosErr) {
      toast.error('Error cargando créditos: ' + creditosErr.message)
      setLoading(false)
      return
    }

    const creditosList: Credito[] = creditosData || []
    setCreditos(creditosList)

    // Load pagos for all credits
    if (creditosList.length > 0) {
      const creditoIds = creditosList.map(c => c.id)
      const { data: pagosData } = await supabase
        .from('credito_pagos')
        .select('*')
        .in('credito_id', creditoIds)
        .order('fecha', { ascending: false })

      const pagosMap: Record<string, CreditoPago[]> = {}
      for (const p of (pagosData || []) as CreditoPago[]) {
        if (!pagosMap[p.credito_id]) pagosMap[p.credito_id] = []
        pagosMap[p.credito_id].push(p)
      }
      setPagos(pagosMap)
    } else {
      setPagos({})
    }

    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  // --- CRUD: Credits ---

  function resetForm() {
    setFormNombre('')
    setFormTipo('credito')
    setFormInstitucion('')
    setFormMontoOriginal('')
    setFormSaldoActual('')
    setFormTasaInteres('')
    setFormPagoMensual('')
    setFormDiaPago('')
    setFormFechaInicio('')
    setFormFechaVencimiento('')
    setFormNotas('')
  }

  async function addCredito(e: React.FormEvent) {
    e.preventDefault()
    if (!formNombre.trim() || !formMontoOriginal) {
      toast.error('Nombre y monto original son requeridos')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('creditos').insert({
      empresa_id: empresaId,
      nombre: formNombre.trim(),
      tipo: formTipo,
      institucion: formInstitucion.trim() || null,
      monto_original: Number(formMontoOriginal),
      saldo_actual: formSaldoActual ? Number(formSaldoActual) : Number(formMontoOriginal),
      tasa_interes: formTasaInteres ? Number(formTasaInteres) / 100 : null,
      pago_mensual: formPagoMensual ? Number(formPagoMensual) : null,
      dia_pago: formDiaPago ? Number(formDiaPago) : null,
      fecha_inicio: formFechaInicio || null,
      fecha_vencimiento: formFechaVencimiento || null,
      notas: formNotas.trim() || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Crédito registrado')
    resetForm()
    setShowForm(false)
    loadData()
  }

  function startEdit(c: Credito) {
    setEditingId(c.id)
    setEditData({
      nombre: c.nombre,
      tipo: c.tipo,
      institucion: c.institucion || '',
      monto_original: String(c.monto_original),
      saldo_actual: String(c.saldo_actual),
      tasa_interes: c.tasa_interes != null ? String(c.tasa_interes * 100) : '',
      pago_mensual: c.pago_mensual != null ? String(c.pago_mensual) : '',
      dia_pago: c.dia_pago != null ? String(c.dia_pago) : '',
      fecha_inicio: c.fecha_inicio || '',
      fecha_vencimiento: c.fecha_vencimiento || '',
      estatus: c.estatus,
      notas: c.notas || '',
    })
  }

  async function saveEdit() {
    if (!editingId) return
    const supabase = createClient()
    const { error } = await supabase.from('creditos').update({
      nombre: editData.nombre.trim(),
      tipo: editData.tipo,
      institucion: editData.institucion.trim() || null,
      monto_original: Number(editData.monto_original),
      saldo_actual: Number(editData.saldo_actual),
      tasa_interes: editData.tasa_interes ? Number(editData.tasa_interes) / 100 : null,
      pago_mensual: editData.pago_mensual ? Number(editData.pago_mensual) : null,
      dia_pago: editData.dia_pago ? Number(editData.dia_pago) : null,
      fecha_inicio: editData.fecha_inicio || null,
      fecha_vencimiento: editData.fecha_vencimiento || null,
      estatus: editData.estatus,
      notas: editData.notas.trim() || null,
    }).eq('id', editingId)
    if (error) { toast.error(error.message); return }
    toast.success('Crédito actualizado')
    setEditingId(null)
    loadData()
  }

  async function deleteCredito(id: string) {
    if (!confirm('¿Eliminar este crédito y todos sus pagos?')) return
    const supabase = createClient()
    const { error } = await supabase.from('creditos').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Crédito eliminado')
    loadData()
  }

  // --- CRUD: Pagos ---

  function openPagoForm(creditoId: string) {
    setPagoFormId(creditoId)
    setPagoFecha(format(new Date(), 'yyyy-MM-dd'))
    setPagoCapital('')
    setPagoInteres('')
    setPagoNotas('')
    // Expand the credit to show the form
    setExpandedId(creditoId)
  }

  async function addPago(e: React.FormEvent) {
    e.preventDefault()
    if (!pagoFormId) return
    const capital = Number(pagoCapital) || 0
    const interes = Number(pagoInteres) || 0
    const total = capital + interes
    if (total <= 0) {
      toast.error('El monto total del pago debe ser mayor a 0')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('credito_pagos').insert({
      credito_id: pagoFormId,
      fecha: pagoFecha,
      monto_capital: capital,
      monto_interes: interes,
      monto_total: total,
      notas: pagoNotas.trim() || null,
    })
    if (error) { toast.error(error.message); return }

    // Update saldo_actual on the credit
    const credito = creditos.find(c => c.id === pagoFormId)
    if (credito) {
      const nuevoSaldo = Math.max(0, credito.saldo_actual - capital)
      const updateData: Record<string, unknown> = { saldo_actual: nuevoSaldo }
      if (nuevoSaldo === 0) updateData.estatus = 'liquidado'
      await supabase.from('creditos').update(updateData).eq('id', pagoFormId)
    }

    toast.success('Pago registrado')
    setPagoFormId(null)
    loadData()
  }

  async function deletePago(pagoId: string, creditoId: string, montoCapital: number) {
    if (!confirm('¿Eliminar este pago?')) return
    const supabase = createClient()
    const { error } = await supabase.from('credito_pagos').delete().eq('id', pagoId)
    if (error) { toast.error(error.message); return }

    // Restore the capital back to saldo_actual
    const credito = creditos.find(c => c.id === creditoId)
    if (credito) {
      const nuevoSaldo = credito.saldo_actual + montoCapital
      const updateData: Record<string, unknown> = { saldo_actual: nuevoSaldo }
      if (credito.estatus === 'liquidado' && nuevoSaldo > 0) updateData.estatus = 'activo'
      await supabase.from('creditos').update(updateData).eq('id', creditoId)
    }

    toast.success('Pago eliminado')
    loadData()
  }

  // --- Computed values ---

  const creditosActivos = creditos.filter(c => c.estatus === 'activo')
  const totalDeuda = creditosActivos.reduce((s, c) => s + c.saldo_actual, 0)
  const totalPagoMensual = creditosActivos.reduce((s, c) => s + (c.pago_mensual || 0), 0)

  // Find the next upcoming payment date
  const hoy = new Date()
  const diaHoy = hoy.getDate()
  const proximoPago = (() => {
    const diasPago = creditosActivos
      .filter(c => c.dia_pago != null)
      .map(c => c.dia_pago as number)
    if (diasPago.length === 0) return null
    // Find the next payment day in the current or next month
    const futurosEsteMes = diasPago.filter(d => d >= diaHoy)
    if (futurosEsteMes.length > 0) {
      const dia = Math.min(...futurosEsteMes)
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), dia)
      return fecha
    }
    // Next month
    const dia = Math.min(...diasPago)
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia)
    return fecha
  })()

  // Export data
  const exportData = creditos.map(c => ({
    'Nombre': c.nombre,
    'Tipo': TIPOS_CREDITO.find(t => t.value === c.tipo)?.label || c.tipo,
    'Institución': c.institucion || '',
    'Monto Original': c.monto_original,
    'Saldo Actual': c.saldo_actual,
    'Tasa Interés (%)': c.tasa_interes != null ? (c.tasa_interes * 100).toFixed(2) : '',
    'Pago Mensual': c.pago_mensual || '',
    'Día Pago': c.dia_pago || '',
    'Fecha Inicio': c.fecha_inicio || '',
    'Fecha Vencimiento': c.fecha_vencimiento || '',
    'Estatus': c.estatus,
    'Notas': c.notas || '',
  }))

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Landmark className="h-6 w-6" /> Créditos
        </h1>
        <div className="flex gap-2">
          <ExportButton data={exportData} filename="creditos" sheetName="Créditos" />
          {userRole !== 'viewer' && (
            <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null) }}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo crédito
            </Button>
          )}
        </div>
      </div>

      {/* Add credit form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nuevo crédito</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addCredito} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Nombre *</Label>
                  <Input
                    placeholder='Ej. "Crédito BBVA", "Línea Konfío"'
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Tipo *</Label>
                  <Select value={formTipo} onValueChange={setFormTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_CREDITO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Institución</Label>
                  <Input
                    placeholder="Banco o institución"
                    value={formInstitucion}
                    onChange={e => setFormInstitucion(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Monto original *</Label>
                  <Input
                    type="number"
                    placeholder="$0.00"
                    value={formMontoOriginal}
                    onChange={e => setFormMontoOriginal(e.target.value)}
                    step="0.01"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Saldo actual</Label>
                  <Input
                    type="number"
                    placeholder="Igual al monto original si es nuevo"
                    value={formSaldoActual}
                    onChange={e => setFormSaldoActual(e.target.value)}
                    step="0.01"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Tasa interés anual (%)</Label>
                  <Input
                    type="number"
                    placeholder="Ej. 12.00"
                    value={formTasaInteres}
                    onChange={e => setFormTasaInteres(e.target.value)}
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Pago mensual</Label>
                  <Input
                    type="number"
                    placeholder="$0.00"
                    value={formPagoMensual}
                    onChange={e => setFormPagoMensual(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Día de pago (1-31)</Label>
                  <Input
                    type="number"
                    placeholder="Ej. 15"
                    value={formDiaPago}
                    onChange={e => setFormDiaPago(e.target.value)}
                    min="1"
                    max="31"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Fecha inicio</Label>
                  <Input type="date" value={formFechaInicio} onChange={e => setFormFechaInicio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Fecha vencimiento</Label>
                  <Input type="date" value={formFechaVencimiento} onChange={e => setFormFechaVencimiento(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Notas</Label>
                <Textarea
                  placeholder="Observaciones adicionales..."
                  value={formNotas}
                  onChange={e => setFormNotas(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Registrar crédito</Button>
                <Button type="button" variant="ghost" onClick={() => { setShowForm(false); resetForm() }}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Dashboard summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Total deuda</p>
            </div>
            <p className="text-2xl font-bold text-red-700">{formatMXN(totalDeuda)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Pago mensual total</p>
            </div>
            <p className="text-2xl font-bold text-orange-700">{formatMXN(totalPagoMensual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Créditos activos</p>
            </div>
            <p className="text-2xl font-bold">{creditosActivos.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Próximo pago</p>
            </div>
            <p className="text-2xl font-bold">
              {proximoPago ? format(proximoPago, 'dd/MM/yyyy') : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress per credit */}
      {creditosActivos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progreso de pagos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {creditosActivos.map(c => {
              const pagado = c.monto_original - c.saldo_actual
              const porcentaje = c.monto_original > 0 ? (pagado / c.monto_original) * 100 : 0
              return (
                <div key={c.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.nombre}</span>
                    <div className="flex gap-3 text-muted-foreground">
                      <span>Pagado: {formatMXN(pagado)}</span>
                      <span>Saldo: {formatMXN(c.saldo_actual)}</span>
                      <span className="font-semibold text-foreground">{porcentaje.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all bg-green-500"
                      style={{ width: `${Math.min(porcentaje, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Credits list */}
      {creditos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Landmark className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay créditos registrados.</p>
            {userRole !== 'viewer' && (
              <Button variant="outline" className="mt-3" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Agregar crédito
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {creditos.map(c => {
            const isExpanded = expandedId === c.id
            const isEditing = editingId === c.id
            const creditoPagos = pagos[c.id] || []
            const tipoInfo = TIPOS_CREDITO.find(t => t.value === c.tipo)
            const estatusInfo = ESTATUS_CREDITO.find(e => e.value === c.estatus)
            const pagado = c.monto_original - c.saldo_actual
            const porcentaje = c.monto_original > 0 ? (pagado / c.monto_original) * 100 : 0

            return (
              <Card key={c.id} className={c.estatus === 'vencido' ? 'border-red-200' : ''}>
                {isEditing ? (
                  /* Editing mode */
                  <>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Editando crédito</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-sm">Nombre</Label>
                          <Input value={editData.nombre} onChange={e => setEditData(d => ({ ...d, nombre: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Tipo</Label>
                          <Select value={editData.tipo} onValueChange={v => setEditData(d => ({ ...d, tipo: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TIPOS_CREDITO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Institución</Label>
                          <Input value={editData.institucion} onChange={e => setEditData(d => ({ ...d, institucion: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-sm">Monto original</Label>
                          <Input type="number" value={editData.monto_original} onChange={e => setEditData(d => ({ ...d, monto_original: e.target.value }))} step="0.01" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Saldo actual</Label>
                          <Input type="number" value={editData.saldo_actual} onChange={e => setEditData(d => ({ ...d, saldo_actual: e.target.value }))} step="0.01" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Tasa interés (%)</Label>
                          <Input type="number" value={editData.tasa_interes} onChange={e => setEditData(d => ({ ...d, tasa_interes: e.target.value }))} step="0.01" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Pago mensual</Label>
                          <Input type="number" value={editData.pago_mensual} onChange={e => setEditData(d => ({ ...d, pago_mensual: e.target.value }))} step="0.01" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-sm">Día de pago</Label>
                          <Input type="number" value={editData.dia_pago} onChange={e => setEditData(d => ({ ...d, dia_pago: e.target.value }))} min="1" max="31" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Fecha inicio</Label>
                          <Input type="date" value={editData.fecha_inicio} onChange={e => setEditData(d => ({ ...d, fecha_inicio: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Fecha vencimiento</Label>
                          <Input type="date" value={editData.fecha_vencimiento} onChange={e => setEditData(d => ({ ...d, fecha_vencimiento: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Estatus</Label>
                          <Select value={editData.estatus} onValueChange={v => setEditData(d => ({ ...d, estatus: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ESTATUS_CREDITO.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Notas</Label>
                        <Textarea value={editData.notas} onChange={e => setEditData(d => ({ ...d, notas: e.target.value }))} rows={2} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="h-4 w-4 mr-1" /> Guardar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 mr-1" /> Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  /* View mode */
                  <>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base">{c.nombre}</CardTitle>
                          <Badge variant="outline" className={estatusInfo?.color || ''}>
                            {estatusInfo?.label || c.estatus}
                          </Badge>
                          <Badge variant="outline">
                            {tipoInfo?.label || c.tipo}
                          </Badge>
                        </div>
                        {userRole !== 'viewer' && (
                          <div className="flex gap-1">
                            {c.estatus === 'activo' && (
                              <Button variant="outline" size="sm" onClick={() => openPagoForm(c.id)}>
                                <DollarSign className="h-4 w-4 mr-1" /> Registrar pago
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => startEdit(c)} title="Editar">
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteCredito(c.id)} title="Eliminar">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                        {c.institucion && (
                          <div>
                            <p className="text-muted-foreground text-xs">Institución</p>
                            <p className="font-medium">{c.institucion}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground text-xs">Monto original</p>
                          <p className="font-medium">{formatMXN(c.monto_original)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Saldo actual</p>
                          <p className="font-bold text-red-700">{formatMXN(c.saldo_actual)}</p>
                        </div>
                        {c.tasa_interes != null && (
                          <div>
                            <p className="text-muted-foreground text-xs">Tasa interés</p>
                            <p className="font-medium">{(c.tasa_interes * 100).toFixed(2)}%</p>
                          </div>
                        )}
                        {c.pago_mensual != null && (
                          <div>
                            <p className="text-muted-foreground text-xs">Pago mensual</p>
                            <p className="font-medium">{formatMXN(c.pago_mensual)}</p>
                          </div>
                        )}
                        {c.dia_pago != null && (
                          <div>
                            <p className="text-muted-foreground text-xs">Día de pago</p>
                            <p className="font-medium">Día {c.dia_pago}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        {c.fecha_inicio && (
                          <div>
                            <span className="text-muted-foreground text-xs">Inicio: </span>
                            <span className="font-medium">{format(new Date(c.fecha_inicio + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                          </div>
                        )}
                        {c.fecha_vencimiento && (
                          <div>
                            <span className="text-muted-foreground text-xs">Vencimiento: </span>
                            <span className={`font-medium ${c.estatus === 'activo' && new Date(c.fecha_vencimiento + 'T12:00:00') < new Date() ? 'text-red-600' : ''}`}>
                              {format(new Date(c.fecha_vencimiento + 'T12:00:00'), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        )}
                        {c.notas && (
                          <div>
                            <span className="text-muted-foreground text-xs">Notas: </span>
                            <span className="text-muted-foreground">{c.notas}</span>
                          </div>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Pagado: {formatMXN(pagado)}</span>
                          <span>{porcentaje.toFixed(1)}% del total</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all bg-green-500"
                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Pago form (inline) */}
                      {pagoFormId === c.id && (
                        <Card className="border-blue-200 bg-blue-50/30">
                          <CardContent className="pt-4 pb-3">
                            <form onSubmit={addPago} className="space-y-3">
                              <p className="text-sm font-medium">Registrar pago</p>
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-sm">Fecha *</Label>
                                  <Input type="date" value={pagoFecha} onChange={e => setPagoFecha(e.target.value)} required />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-sm">Capital</Label>
                                  <Input type="number" placeholder="$0.00" value={pagoCapital} onChange={e => setPagoCapital(e.target.value)} step="0.01" min="0" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-sm">Interés</Label>
                                  <Input type="number" placeholder="$0.00" value={pagoInteres} onChange={e => setPagoInteres(e.target.value)} step="0.01" min="0" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-sm">Total</Label>
                                  <p className="text-lg font-bold pt-1">{formatMXN((Number(pagoCapital) || 0) + (Number(pagoInteres) || 0))}</p>
                                </div>
                              </div>
                              <Input placeholder="Notas del pago (opcional)" value={pagoNotas} onChange={e => setPagoNotas(e.target.value)} />
                              <div className="flex gap-2">
                                <Button type="submit" size="sm"><Plus className="h-4 w-4 mr-1" /> Registrar pago</Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setPagoFormId(null)}>Cancelar</Button>
                              </div>
                            </form>
                          </CardContent>
                        </Card>
                      )}

                      {/* Expand/Collapse payments */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                        Historial de pagos ({creditoPagos.length})
                      </Button>

                      {/* Payment history */}
                      {isExpanded && (
                        <div className="border rounded-lg overflow-hidden">
                          {creditoPagos.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Sin pagos registrados</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Fecha</TableHead>
                                  <TableHead className="text-right">Capital</TableHead>
                                  <TableHead className="text-right">Interés</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead>Notas</TableHead>
                                  {userRole !== 'viewer' && <TableHead className="w-10"></TableHead>}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {creditoPagos.map(p => (
                                  <TableRow key={p.id}>
                                    <TableCell className="text-sm">{format(new Date(p.fecha + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="text-right text-sm">{formatMXN(p.monto_capital)}</TableCell>
                                    <TableCell className="text-right text-sm">{formatMXN(p.monto_interes)}</TableCell>
                                    <TableCell className="text-right text-sm font-medium">{formatMXN(p.monto_total)}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.notas || '—'}</TableCell>
                                    {userRole !== 'viewer' && (
                                      <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => deletePago(p.id, c.id, p.monto_capital)} title="Eliminar pago">
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                                {/* Totals row */}
                                <TableRow className="bg-muted/30 font-medium">
                                  <TableCell className="text-sm">Total</TableCell>
                                  <TableCell className="text-right text-sm">{formatMXN(creditoPagos.reduce((s, p) => s + p.monto_capital, 0))}</TableCell>
                                  <TableCell className="text-right text-sm">{formatMXN(creditoPagos.reduce((s, p) => s + p.monto_interes, 0))}</TableCell>
                                  <TableCell className="text-right text-sm">{formatMXN(creditoPagos.reduce((s, p) => s + p.monto_total, 0))}</TableCell>
                                  <TableCell></TableCell>
                                  {userRole !== 'viewer' && <TableCell></TableCell>}
                                </TableRow>
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
