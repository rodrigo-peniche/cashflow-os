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
import { formatMXN } from '@/lib/constants'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { Socio, Aportacion, CuentaBancaria } from '@/lib/types'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { ExportButton } from '@/components/shared/export-button'
import { ExcelImport } from '@/components/shared/excel-import'
import { SortableHeader } from '@/components/shared/sortable-header'
import { HandCoins, Plus, UserPlus, ChevronDown, ChevronUp, Check, X, AlertTriangle, Calculator, Send } from 'lucide-react'

const TIPOS_APORTACION = [
  { value: 'a_cuenta', label: 'A cuenta bancaria', color: 'bg-blue-100 text-blue-800' },
  { value: 'efectivo', label: 'Efectivo', color: 'bg-green-100 text-green-800' },
]

const STATUS_COLORS: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  recibida: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800',
}

export default function AportacionesPage() {
  const { empresaId, userRole } = useEmpresa()
  const [socios, setSocios] = useState<Socio[]>([])
  const [aportaciones, setAportaciones] = useState<Aportacion[]>([])
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [totalFacturasPendientes, setTotalFacturasPendientes] = useState(0)
  const [totalSaldosBancarios, setTotalSaldosBancarios] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showSocioForm, setShowSocioForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterSocio, setFilterSocio] = useState('todos')
  const [filterEstatus, setFilterEstatus] = useState('todos')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Form state
  const [formSocio, setFormSocio] = useState('')
  const [formMonto, setFormMonto] = useState('')
  const [formFecha, setFormFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formTipo, setFormTipo] = useState('a_cuenta')
  const [formCuenta, setFormCuenta] = useState('')
  const [formConcepto, setFormConcepto] = useState('')
  const [formMetodo, setFormMetodo] = useState('')
  const [formNotas, setFormNotas] = useState('')
  const [formFechaCompromiso, setFormFechaCompromiso] = useState('')

  // Socio form
  const [newSocioNombre, setNewSocioNombre] = useState('')
  const [newSocioEmail, setNewSocioEmail] = useState('')
  const [newSocioPorcentaje, setNewSocioPorcentaje] = useState('')

  // Solicitud de aportación - multi-line
  interface SolicitudLine {
    concepto: string
    monto: string
    fechaCompromiso: string
  }
  const [solicitudLines, setSolicitudLines] = useState<SolicitudLine[]>([
    { concepto: 'Solicitud de aportación', monto: '', fechaCompromiso: format(new Date(), 'yyyy-MM-dd') }
  ])

  function addSolicitudLine() {
    setSolicitudLines(prev => [...prev, { concepto: '', monto: '', fechaCompromiso: format(new Date(), 'yyyy-MM-dd') }])
  }

  function updateSolicitudLine(index: number, field: keyof SolicitudLine, value: string) {
    setSolicitudLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line))
  }

  function removeSolicitudLine(index: number) {
    if (solicitudLines.length <= 1) return
    setSolicitudLines(prev => prev.filter((_, i) => i !== index))
  }

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const [sociosRes, aportRes, cuentasRes, facturasRes, cuentasAllRes] = await Promise.all([
      supabase.from('socios').select('*').eq('empresa_id', empresaId).eq('activo', true).order('nombre'),
      supabase.from('aportaciones').select('*, socios(nombre), cuentas_bancarias(nombre, banco)').eq('empresa_id', empresaId).order('fecha', { ascending: false }),
      supabase.from('cuentas_bancarias').select('*').eq('empresa_id', empresaId).eq('activa', true).order('nombre'),
      // Facturas pendientes (no pagadas, no rechazadas)
      supabase.from('facturas').select('total').eq('empresa_id', empresaId).not('estatus', 'in', '("pagada","rechazada")'),
      // Get all accounts for latest balance
      supabase.from('cuentas_bancarias').select('id').eq('empresa_id', empresaId).eq('activa', true),
    ])
    setSocios(sociosRes.data || [])
    setAportaciones(aportRes.data || [])
    setCuentas(cuentasRes.data || [])

    // Sum pending invoices
    const totalFact = (facturasRes.data || []).reduce((s, f) => s + (f.total || 0), 0)
    setTotalFacturasPendientes(totalFact)

    // Get latest balance per account
    const cuentaIds = (cuentasAllRes.data || []).map(c => c.id)
    let totalSaldos = 0
    if (cuentaIds.length > 0) {
      const saldoPromises = cuentaIds.map(async (cid) => {
        const { data } = await supabase
          .from('saldos_bancarios')
          .select('saldo')
          .eq('cuenta_id', cid)
          .order('fecha', { ascending: false })
          .limit(1)
          .single()
        return data?.saldo || 0
      })
      const saldos = await Promise.all(saldoPromises)
      totalSaldos = saldos.reduce((s, v) => s + v, 0)
    }
    setTotalSaldosBancarios(totalSaldos)
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir('asc') }
    } else { setSortKey(key); setSortDir('asc') }
  }

  async function addSocio(e: React.FormEvent) {
    e.preventDefault()
    if (!newSocioNombre.trim()) { toast.error('Nombre requerido'); return }
    const supabase = createClient()
    const { error } = await supabase.from('socios').insert({
      empresa_id: empresaId,
      nombre: newSocioNombre.trim(),
      email: newSocioEmail.trim() || null,
      porcentaje_participacion: newSocioPorcentaje ? Number(newSocioPorcentaje) : null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Socio agregado')
    setNewSocioNombre('')
    setNewSocioEmail('')
    setNewSocioPorcentaje('')
    setShowSocioForm(false)
    loadData()
  }

  async function addAportacion(e: React.FormEvent) {
    e.preventDefault()
    if (!formSocio || !formMonto || !formFecha) { toast.error('Socio, monto y fecha son requeridos'); return }
    const supabase = createClient()
    const { error } = await supabase.from('aportaciones').insert({
      empresa_id: empresaId,
      socio_id: formSocio,
      monto: Number(formMonto),
      fecha: formFecha,
      tipo: formTipo,
      cuenta_bancaria_id: formTipo === 'a_cuenta' && formCuenta ? formCuenta : null,
      concepto: formConcepto.trim() || null,
      metodo_pago: formMetodo.trim() || null,
      notas: formNotas.trim() || null,
      fecha_compromiso: formFechaCompromiso || null,
      estatus: 'pendiente',
    })
    if (error) { toast.error(error.message); return }
    toast.success('Aportación registrada')
    setFormSocio('')
    setFormMonto('')
    setFormTipo('a_cuenta')
    setFormCuenta('')
    setFormConcepto('')
    setFormMetodo('')
    setFormNotas('')
    setFormFechaCompromiso('')
    setShowForm(false)
    loadData()
  }

  async function updateEstatus(id: string, estatus: string) {
    const supabase = createClient()
    const { error } = await supabase.from('aportaciones').update({ estatus }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Estatus actualizado')
    loadData()
  }

  function getSocioNombre(a: Aportacion): string {
    return (a as unknown as Record<string, Record<string, string>>).socios?.nombre || ''
  }

  let filtered = aportaciones.filter(a => {
    if (filterSocio !== 'todos' && a.socio_id !== filterSocio) return false
    if (filterEstatus !== 'todos' && a.estatus !== filterEstatus) return false
    return true
  })

  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'socio': cmp = getSocioNombre(a).localeCompare(getSocioNombre(b)); break
        case 'monto': cmp = a.monto - b.monto; break
        case 'fecha': cmp = a.fecha.localeCompare(b.fecha); break
        case 'estatus': cmp = a.estatus.localeCompare(b.estatus); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }

  // Totals
  const totalRecibidas = aportaciones.filter(a => a.estatus === 'recibida').reduce((s, a) => s + a.monto, 0)
  const totalPendientes = aportaciones.filter(a => a.estatus === 'pendiente').reduce((s, a) => s + a.monto, 0)
  const totalACuenta = aportaciones.filter(a => a.tipo === 'a_cuenta').reduce((s, a) => s + a.monto, 0)
  const totalEfectivo = aportaciones.filter(a => a.tipo === 'efectivo').reduce((s, a) => s + a.monto, 0)

  // Per-socio totals
  const socioTotals = socios.map(s => {
    const socioAports = aportaciones.filter(a => a.socio_id === s.id)
    return {
      ...s,
      totalRecibido: socioAports.filter(a => a.estatus === 'recibida').reduce((sum, a) => sum + a.monto, 0),
      totalPendiente: socioAports.filter(a => a.estatus === 'pendiente').reduce((sum, a) => sum + a.monto, 0),
      totalACuenta: socioAports.filter(a => a.tipo === 'a_cuenta').reduce((sum, a) => sum + a.monto, 0),
      totalEfectivo: socioAports.filter(a => a.tipo === 'efectivo').reduce((sum, a) => sum + a.monto, 0),
      count: socioAports.length,
    }
  })

  const exportData = filtered.map(a => ({
    'Socio': getSocioNombre(a),
    'Monto': a.monto,
    'Fecha': a.fecha,
    'Tipo': TIPOS_APORTACION.find(t => t.value === a.tipo)?.label || a.tipo || 'A cuenta',
    'Concepto': a.concepto || '',
    'Método': a.metodo_pago || '',
    'Estatus': a.estatus,
    'Observaciones': a.notas || '',
  }))

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><HandCoins className="h-6 w-6" /> Aportaciones de Socios</h1>
        <div className="flex gap-2">
          <ExportButton data={exportData} filename="aportaciones" sheetName="Aportaciones" />
          {userRole !== 'viewer' && (
            <>
              <ExcelImport
                templateKey="aportaciones"
                empresaId={empresaId}
                onSuccess={loadData}
                transformRows={async (rows) => {
                  const supabase = createClient()
                  const { data: sociosDb } = await supabase.from('socios').select('id, nombre').eq('empresa_id', empresaId!)
                  const socioMap = new Map((sociosDb || []).map(s => [s.nombre.toUpperCase(), s.id]))

                  const result: Record<string, unknown>[] = []
                  for (const row of rows) {
                    const nombre = String(row._socio_nombre || '').toUpperCase().trim()
                    const socioId = socioMap.get(nombre)
                    if (!socioId) continue

                    let fecha = String(row._fecha || '').trim()
                    if (/^\d{5}$/.test(fecha)) {
                      const d = new Date((Number(fecha) - 25569) * 86400 * 1000)
                      fecha = format(d, 'yyyy-MM-dd')
                    }
                    const ddmm = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
                    if (ddmm) fecha = `${ddmm[3]}-${ddmm[2].padStart(2, '0')}-${ddmm[1].padStart(2, '0')}`
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fecha = format(new Date(), 'yyyy-MM-dd')

                    const tipoRaw = String(row._tipo || 'a_cuenta').toLowerCase().trim()
                    const tipo = ['a_cuenta', 'efectivo'].includes(tipoRaw) ? tipoRaw : 'a_cuenta'

                    const estatusRaw = String(row._estatus || 'pendiente').toLowerCase().trim()
                    const estatus = ['pendiente', 'recibida', 'cancelada'].includes(estatusRaw) ? estatusRaw : 'pendiente'

                    result.push({
                      empresa_id: empresaId,
                      socio_id: socioId,
                      monto: Number(row.monto) || 0,
                      fecha,
                      tipo,
                      concepto: row.concepto || null,
                      metodo_pago: row.metodo_pago || null,
                      estatus,
                      notas: row.notas || null,
                    })
                  }
                  return result
                }}
              />
              <Button variant="outline" size="sm" onClick={() => setShowSocioForm(!showSocioForm)}>
                <UserPlus className="h-4 w-4 mr-1" /> Socio
              </Button>
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-1" /> Aportación
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Add socio form - right after header */}
      {showSocioForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nuevo socio</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addSocio} className="flex flex-wrap gap-3">
              <Input placeholder="Nombre *" value={newSocioNombre} onChange={e => setNewSocioNombre(e.target.value)} className="flex-1 min-w-[200px]" required />
              <Input placeholder="Email (opcional)" type="email" value={newSocioEmail} onChange={e => setNewSocioEmail(e.target.value)} className="w-[200px]" />
              <Input placeholder="% participación" type="number" value={newSocioPorcentaje} onChange={e => setNewSocioPorcentaje(e.target.value)} className="w-[130px]" step="0.01" min="0" max="100" />
              <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Add aportación form - right after header */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nueva aportación</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addAportacion} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Socio *</Label>
                  <Select value={formSocio} onValueChange={setFormSocio}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {socios.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Monto *</Label>
                  <Input type="number" placeholder="$0.00" value={formMonto} onChange={e => setFormMonto(e.target.value)} step="0.01" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Fecha *</Label>
                  <Input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Tipo *</Label>
                  <Select value={formTipo} onValueChange={setFormTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_APORTACION.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {formTipo === 'a_cuenta' && (
                  <div className="space-y-1">
                    <Label className="text-sm">Cuenta bancaria</Label>
                    <Select value={formCuenta} onValueChange={setFormCuenta}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                      <SelectContent>
                        {cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} — {c.banco}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input placeholder="Concepto (opcional)" value={formConcepto} onChange={e => setFormConcepto(e.target.value)} />
                <Input placeholder="Observaciones (opcional)" value={formNotas} onChange={e => setFormNotas(e.target.value)} />
                <div className="space-y-1">
                  <Label className="text-sm">Fecha compromiso (opcional)</Label>
                  <Input type="date" value={formFechaCompromiso} onChange={e => setFormFechaCompromiso(e.target.value)} />
                </div>
              </div>
              <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Registrar aportación</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total recibido</p>
            <p className="text-2xl font-bold text-green-700">{formatMXN(totalRecibidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendiente por recibir</p>
            <p className="text-2xl font-bold text-yellow-700">{formatMXN(totalPendientes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">A cuenta bancaria</p>
            <p className="text-2xl font-bold text-blue-700">{formatMXN(totalACuenta)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">En efectivo</p>
            <p className="text-2xl font-bold text-green-700">{formatMXN(totalEfectivo)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Necesidad de aportación - auto-calculado */}
      {(() => {
        const faltante = totalFacturasPendientes - totalSaldosBancarios
        const porSocio = socios.length > 0 ? faltante / socios.length : 0
        return (
          <Card className={faltante > 0 ? 'border-orange-200 bg-orange-50/50' : 'border-green-200 bg-green-50/50'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Necesidad de aportación
              </CardTitle>
              <p className="text-xs text-muted-foreground">Calculado automáticamente: facturas pendientes de pago − saldos bancarios actuales</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Facturas pendientes</p>
                  <p className="text-lg font-bold text-red-700">{formatMXN(totalFacturasPendientes)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldos bancarios</p>
                  <p className="text-lg font-bold text-blue-700">{formatMXN(totalSaldosBancarios)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {faltante > 0 ? 'Monto necesario' : 'Superávit'}
                  </p>
                  <p className={`text-lg font-bold ${faltante > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                    {faltante > 0 ? formatMXN(faltante) : formatMXN(Math.abs(faltante))}
                  </p>
                </div>
              </div>
              {faltante > 0 && socios.length > 0 && (
                <div className="mt-3 pt-3 border-t border-orange-200">
                  <p className="text-xs text-muted-foreground mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                    Aportación sugerida por socio (partes iguales):
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {socios.map(s => {
                      const socioAportado = aportaciones
                        .filter(a => a.socio_id === s.id && a.estatus === 'pendiente')
                        .reduce((sum, a) => sum + a.monto, 0)
                      const netoPorAportar = Math.max(0, porSocio - socioAportado)
                      return (
                        <div key={s.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border text-sm">
                          <span className="font-medium">{s.nombre}:</span>
                          {netoPorAportar > 0 ? (
                            <span className="font-bold text-orange-700">{formatMXN(netoPorAportar)}</span>
                          ) : (
                            <span className="text-green-700 text-xs">Cubierto con pendientes</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Per-socio summary */}
      {socioTotals.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {socioTotals.map(s => (
            <Card key={s.id} className="flex-1 min-w-[220px]">
              <CardContent className="pt-4 pb-3">
                <p className="font-semibold text-sm">{s.nombre}</p>
                {s.porcentaje_participacion && (
                  <p className="text-xs text-muted-foreground">{s.porcentaje_participacion}% participación</p>
                )}
                <div className="flex flex-col gap-0.5 mt-1 text-xs">
                  <span className="text-blue-700">A cuenta: {formatMXN(s.totalACuenta)}</span>
                  <span className="text-green-700">Efectivo: {formatMXN(s.totalEfectivo)}</span>
                  {s.totalPendiente > 0 && <span className="text-yellow-700">Pendiente: {formatMXN(s.totalPendiente)}</span>}
                  <span className="font-semibold text-gray-900 mt-0.5">Total: {formatMXN(s.totalACuenta + s.totalEfectivo)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Balance entre socios */}
      {socioTotals.length > 1 && (() => {
        const maxAportado = Math.max(...socioTotals.map(s => s.totalACuenta + s.totalEfectivo))
        const socioMax = socioTotals.find(s => s.totalACuenta + s.totalEfectivo === maxAportado)
        const hayDesbalance = socioTotals.some(s => s.totalACuenta + s.totalEfectivo < maxAportado)

        if (!hayDesbalance) return (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center">
              <p className="text-sm font-medium text-green-800">Todos los socios han aportado la misma cantidad</p>
            </CardContent>
          </Card>
        )

        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Balance entre socios</CardTitle>
              <p className="text-xs text-muted-foreground">Diferencia respecto al socio que más ha aportado ({socioMax?.nombre})</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {socioTotals
                  .map(s => ({ ...s, totalAportado: s.totalACuenta + s.totalEfectivo }))
                  .sort((a, b) => b.totalAportado - a.totalAportado)
                  .map(s => {
                    const faltante = maxAportado - s.totalAportado
                    const porcentajeCubierto = maxAportado > 0 ? (s.totalAportado / maxAportado) * 100 : 100
                    return (
                      <div key={s.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{s.nombre}</span>
                          <div className="flex gap-3">
                            <span className="text-muted-foreground">Aportado: {formatMXN(s.totalAportado)}</span>
                            {faltante > 0 ? (
                              <span className="font-semibold text-orange-700">Falta: {formatMXN(faltante)}</span>
                            ) : (
                              <span className="font-semibold text-green-700">Al corriente</span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className="h-2.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(porcentajeCubierto, 100)}%`,
                              backgroundColor: faltante > 0 ? '#ea580c' : '#16a34a',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Solicitud de aportación */}
      {userRole !== 'viewer' && socios.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-5 w-5" />
              Solicitud de aportación
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Genera aportaciones pendientes para cada socio. Agrega varias líneas con diferentes conceptos y montos.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {solicitudLines.map((line, idx) => {
              const montoVal = line.monto ? Number(line.monto) : null
              const porSocio = montoVal && socios.length > 0 ? Math.round((montoVal / socios.length) * 100) / 100 : 0
              return (
                <div key={idx} className="flex flex-wrap items-end gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                  <div className="space-y-1 flex-1 min-w-[200px]">
                    <Label className="text-sm">Concepto</Label>
                    <Input
                      value={line.concepto}
                      onChange={e => updateSolicitudLine(idx, 'concepto', e.target.value)}
                      placeholder="Concepto de la solicitud"
                    />
                  </div>
                  <div className="space-y-1 w-[180px]">
                    <Label className="text-sm">Monto total *</Label>
                    <Input
                      type="number"
                      value={line.monto}
                      onChange={e => updateSolicitudLine(idx, 'monto', e.target.value)}
                      placeholder="$0.00"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-1 w-[170px]">
                    <Label className="text-sm">Fecha compromiso</Label>
                    <Input
                      type="date"
                      value={line.fechaCompromiso}
                      onChange={e => updateSolicitudLine(idx, 'fechaCompromiso', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {porSocio > 0 && (
                      <span className="text-xs text-blue-700 font-medium whitespace-nowrap">
                        {formatMXN(porSocio)} c/u
                      </span>
                    )}
                    {solicitudLines.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeSolicitudLine(idx)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={addSolicitudLine} className="text-blue-700 border-blue-200">
                <Plus className="h-4 w-4 mr-1" /> Agregar línea
              </Button>
              {(() => {
                const faltante = totalFacturasPendientes - totalSaldosBancarios
                const faltantePerSocio = socios.length > 0 ? Math.round((faltante / socios.length) * 100) / 100 : 0
                return faltante > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => {
                      setSolicitudLines([{
                        concepto: 'Cobertura de facturas pendientes',
                        monto: String(Math.round(faltante * 100) / 100),
                        fechaCompromiso: format(new Date(), 'yyyy-MM-dd'),
                      }])
                    }}
                  >
                    <Calculator className="h-3.5 w-3.5 mr-1" />
                    Auto-llenar faltante ({formatMXN(faltante)} total, {formatMXN(faltantePerSocio)} c/u)
                  </Button>
                )
              })()}
            </div>
            <div className="pt-2 border-t border-blue-100">
              {(() => {
                const totalSolicitud = solicitudLines.reduce((s, l) => s + (Number(l.monto) || 0), 0)
                const totalPorSocio = socios.length > 0 ? Math.round((totalSolicitud / socios.length) * 100) / 100 : 0
                return (
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      {solicitudLines.length > 1 && (
                        <span className="text-muted-foreground mr-3">
                          Total: <span className="font-semibold text-blue-800">{formatMXN(totalSolicitud)}</span>
                        </span>
                      )}
                      {totalPorSocio > 0 && (
                        <span className="text-muted-foreground">
                          Por socio: <span className="font-semibold text-blue-800">{formatMXN(totalPorSocio)}</span>
                        </span>
                      )}
                    </div>
                    <Button
                      className="border-blue-300 text-white bg-blue-600 hover:bg-blue-700"
                      disabled={solicitudLines.every(l => !l.monto || Number(l.monto) <= 0)}
                      onClick={async () => {
                        const validLines = solicitudLines.filter(l => l.monto && Number(l.monto) > 0)
                        if (validLines.length === 0) { toast.error('Agrega al menos un monto'); return }

                        const supabase = createClient()
                        const inserts: Record<string, unknown>[] = []
                        for (const line of validLines) {
                          const porSocio = Math.round((Number(line.monto) / socios.length) * 100) / 100
                          for (const s of socios) {
                            inserts.push({
                              empresa_id: empresaId,
                              socio_id: s.id,
                              monto: porSocio,
                              fecha: format(new Date(), 'yyyy-MM-dd'),
                              tipo: 'a_cuenta',
                              concepto: line.concepto.trim() || 'Solicitud de aportación',
                              estatus: 'pendiente',
                              fecha_compromiso: line.fechaCompromiso || format(new Date(), 'yyyy-MM-dd'),
                              notas: `Auto-generado: ${line.concepto || 'Solicitud'} — Total ${formatMXN(Number(line.monto))} ÷ ${socios.length} socios`,
                            })
                          }
                        }
                        const { error } = await supabase.from('aportaciones').insert(inserts)
                        if (error) { toast.error(error.message); return }
                        const totalCreadas = inserts.length
                        toast.success(`${totalCreadas} aportaciones creadas (${validLines.length} concepto(s) × ${socios.length} socios)`)
                        setSolicitudLines([{ concepto: 'Solicitud de aportación', monto: '', fechaCompromiso: format(new Date(), 'yyyy-MM-dd') }])
                        loadData()
                      }}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Crear solicitud para {socios.length} socio(s)
                    </Button>
                  </div>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={filterSocio} onValueChange={setFilterSocio}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los socios</SelectItem>
            {socios.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEstatus} onValueChange={setFilterEstatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="recibida">Recibida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <SortableHeader label="Socio" column="socio" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Monto" column="monto" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortableHeader label="Fecha" column="fecha" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <TableHead>Tipo</TableHead>
                <TableHead>Compromiso</TableHead>
                <TableHead>Concepto</TableHead>
                <SortableHeader label="Estatus" column="estatus" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => {
                const isExpanded = expandedId === a.id
                return (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                    <TableCell className="pr-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-medium">{getSocioNombre(a)}</TableCell>
                    <TableCell className="text-right font-medium">{formatMXN(a.monto)}</TableCell>
                    <TableCell>{format(new Date(a.fecha + 'T12:00:00'), 'dd/MM/yy')}</TableCell>
                    <TableCell>
                      {(() => {
                        const tipoInfo = TIPOS_APORTACION.find(t => t.value === a.tipo)
                        const cuentaNombre = (a as unknown as Record<string, Record<string, string>>).cuentas_bancarias?.nombre
                        return (
                          <div>
                            <Badge variant="outline" className={tipoInfo?.color}>{tipoInfo?.label || a.tipo || 'A cuenta'}</Badge>
                            {cuentaNombre && <p className="text-xs text-muted-foreground mt-0.5">{cuentaNombre}</p>}
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.fecha_compromiso ? (
                        <span className={a.estatus === 'pendiente' && new Date(a.fecha_compromiso + 'T12:00:00') < new Date() ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          {format(new Date(a.fecha_compromiso + 'T12:00:00'), 'dd/MM/yy')}
                        </span>
                      ) : (
                        a.estatus === 'pendiente' ? <span className="text-yellow-600 text-xs">Sin fecha</span> : '—'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{a.concepto || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[a.estatus]}>
                        {a.estatus.charAt(0).toUpperCase() + a.estatus.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {userRole !== 'viewer' && a.estatus === 'pendiente' && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => updateEstatus(a.id, 'recibida')} title="Marcar como recibida">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => updateEstatus(a.id, 'cancelada')} title="Cancelar">
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No hay aportaciones</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {socios.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Primero agrega socios para registrar aportaciones.</p>
            <Button variant="outline" className="mt-3" onClick={() => setShowSocioForm(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Agregar socio
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
