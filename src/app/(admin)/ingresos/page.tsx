'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMXN } from '@/lib/constants'
import { toast } from 'sonner'
import { format, addDays, startOfWeek, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Sucursal, CanalIngreso } from '@/lib/types'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DollarSign, Plus, ChevronLeft, ChevronRight, Settings, Download, X } from 'lucide-react'
import * as XLSX from 'xlsx'

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const

const FRECUENCIAS_INGRESO = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
] as const

const CANALES_DEFAULT = ['Efectivo', 'Tarjeta', 'Clip', 'TPV', 'Uber', 'Rappi']

const CANALES_PREDEFINIDOS = ['Efectivo', 'Tarjeta', 'Clip', 'TPV', 'Uber', 'Rappi', 'Transferencia', 'Cheque', 'MercadoPago', 'PayPal', 'Otro']

interface IngresoCell {
  id?: string
  monto: number
}

export default function IngresosPage() {
  const { empresaId, userRole } = useEmpresa()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [canales, setCanales] = useState<CanalIngreso[]>([])
  const [ingresos, setIngresos] = useState<Record<string, IngresoCell>>({}) // key: `${sucursal_id}_${canal_id}_${fecha}`
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    return format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  })
  const [numDays, setNumDays] = useState(7)
  const [showConfig, setShowConfig] = useState(false)

  // Config form state
  const [newSucursal, setNewSucursal] = useState('')
  const [newCanal, setNewCanal] = useState('')
  const [newCanalCustom, setNewCanalCustom] = useState('')
  const [newCanalFrecuencia, setNewCanalFrecuencia] = useState('diario')
  const [newCanalDia, setNewCanalDia] = useState('')
  const [newCanalMonto, setNewCanalMonto] = useState('')

  const dates = Array.from({ length: numDays }, (_, i) => format(addDays(new Date(startDate), i), 'yyyy-MM-dd'))

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const [sucRes, canRes] = await Promise.all([
      supabase.from('sucursales').select('*').eq('empresa_id', empresaId).eq('activa', true).order('nombre'),
      supabase.from('canales_ingreso').select('*').eq('empresa_id', empresaId).eq('activo', true).order('nombre'),
    ])
    setSucursales(sucRes.data || [])
    setCanales(canRes.data || [])

    // Load ingresos for the date range
    const endDate = format(addDays(new Date(startDate), numDays - 1), 'yyyy-MM-dd')
    const { data: ingData } = await supabase
      .from('ingresos_diarios')
      .select('*')
      .eq('empresa_id', empresaId)
      .gte('fecha', startDate)
      .lte('fecha', endDate)

    const map: Record<string, IngresoCell> = {}
    ;(ingData || []).forEach((ing) => {
      map[`${ing.sucursal_id}_${ing.canal_id}_${ing.fecha}`] = { id: ing.id, monto: Number(ing.monto) }
    })
    setIngresos(map)
    setLoading(false)
  }, [empresaId, startDate, numDays])

  useEffect(() => { loadData() }, [loadData])

  function getCellKey(sucId: string, canalId: string, fecha: string) {
    return `${sucId}_${canalId}_${fecha}`
  }

  async function handleCellChange(sucId: string, canalId: string, fecha: string, value: string) {
    const monto = Number(value) || 0
    const key = getCellKey(sucId, canalId, fecha)
    const existing = ingresos[key]

    // Optimistic update
    setIngresos(prev => ({ ...prev, [key]: { ...existing, monto } }))

    const supabase = createClient()
    if (existing?.id) {
      await supabase.from('ingresos_diarios').update({ monto }).eq('id', existing.id)
    } else if (monto > 0) {
      const { data } = await supabase.from('ingresos_diarios').insert({
        empresa_id: empresaId,
        sucursal_id: sucId,
        canal_id: canalId,
        fecha,
        monto,
      }).select('id').single()
      if (data) {
        setIngresos(prev => ({ ...prev, [key]: { id: data.id, monto } }))
      }
    }
  }

  async function addSucursal(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const nombre = newSucursal.trim()
    if (!nombre) { toast.error('Escribe un nombre de sucursal'); return }
    if (!empresaId) { toast.error('No hay empresa seleccionada'); return }
    const supabase = createClient()
    // Check if exists (maybe inactive)
    const { data: existing } = await supabase
      .from('sucursales')
      .select('id, activa')
      .eq('empresa_id', empresaId)
      .eq('nombre', nombre)
      .single()
    if (existing) {
      if (!existing.activa) {
        await supabase.from('sucursales').update({ activa: true }).eq('id', existing.id)
        toast.success(`Sucursal "${nombre}" reactivada`)
      } else {
        toast.error(`La sucursal "${nombre}" ya existe`)
        return
      }
    } else {
      const { error } = await supabase.from('sucursales').insert({ empresa_id: empresaId, nombre })
      if (error) { toast.error('Error al crear sucursal: ' + error.message); return }
      toast.success(`Sucursal "${nombre}" creada`)
    }
    setNewSucursal('')
    loadData()
  }

  async function deleteSucursal(id: string) {
    const supabase = createClient()
    await supabase.from('sucursales').update({ activa: false }).eq('id', id)
    toast.success('Sucursal eliminada')
    loadData()
  }

  async function addCanal(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const nombre = newCanal === 'Otro' ? newCanalCustom.trim() : newCanal.trim()
    if (!nombre) { toast.error('Selecciona o escribe un nombre de canal'); return }
    if (!empresaId) { toast.error('No hay empresa seleccionada'); return }
    const supabase = createClient()
    // Check if exists (maybe inactive)
    const { data: existing } = await supabase
      .from('canales_ingreso')
      .select('id, activo')
      .eq('empresa_id', empresaId)
      .eq('nombre', nombre)
      .single()
    if (existing) {
      // Update existing canal (reactivate + update fields)
      const { error } = await supabase.from('canales_ingreso').update({
        activo: true,
        frecuencia: newCanalFrecuencia,
        dia_deposito: newCanalFrecuencia !== 'diario' ? (newCanalDia || null) : null,
        monto_aproximado: newCanalMonto ? Number(newCanalMonto) : null,
      }).eq('id', existing.id)
      if (error) { toast.error('Error: ' + error.message); return }
      toast.success(existing.activo ? `Canal "${nombre}" actualizado` : `Canal "${nombre}" reactivado`)
    } else {
      const { error } = await supabase.from('canales_ingreso').insert({
        empresa_id: empresaId,
        nombre,
        frecuencia: newCanalFrecuencia,
        dia_deposito: newCanalFrecuencia !== 'diario' ? (newCanalDia || null) : null,
        monto_aproximado: newCanalMonto ? Number(newCanalMonto) : null,
      })
      if (error) { toast.error('Error al crear canal: ' + error.message); return }
      toast.success(`Canal "${nombre}" creado`)
    }
    setNewCanal('')
    setNewCanalCustom('')
    setNewCanalFrecuencia('diario')
    setNewCanalDia('')
    setNewCanalMonto('')
    loadData()
  }

  async function deleteCanal(id: string) {
    const supabase = createClient()
    await supabase.from('canales_ingreso').update({ activo: false }).eq('id', id)
    toast.success('Canal eliminado')
    loadData()
  }

  async function initDefaults() {
    const supabase = createClient()
    for (const canal of CANALES_DEFAULT) {
      await supabase.from('canales_ingreso').upsert(
        { empresa_id: empresaId, nombre: canal },
        { onConflict: 'empresa_id,nombre' }
      )
    }
    toast.success('Canales predeterminados creados')
    loadData()
  }

  function getSucursalTotal(sucId: string, fecha: string): number {
    return canales.reduce((sum, c) => sum + (ingresos[getCellKey(sucId, c.id, fecha)]?.monto || 0), 0)
  }

  function getCanalTotal(sucId: string, canalId: string): number {
    return dates.reduce((sum, d) => sum + (ingresos[getCellKey(sucId, canalId, d)]?.monto || 0), 0)
  }

  function getSucursalGrandTotal(sucId: string): number {
    return dates.reduce((sum, d) => sum + getSucursalTotal(sucId, d), 0)
  }

  function getDayGrandTotal(fecha: string): number {
    return sucursales.reduce((sum, s) => sum + getSucursalTotal(s.id, fecha), 0)
  }

  function getGrandTotal(): number {
    return dates.reduce((sum, d) => sum + getDayGrandTotal(d), 0)
  }

  function exportToExcel() {
    const rows: Record<string, unknown>[] = []
    sucursales.forEach(suc => {
      canales.forEach(canal => {
        const row: Record<string, unknown> = { Sucursal: suc.nombre, Canal: canal.nombre }
        dates.forEach(d => {
          const label = format(new Date(d + 'T12:00:00'), 'dd/MM', { locale: es })
          row[label] = ingresos[getCellKey(suc.id, canal.id, d)]?.monto || 0
        })
        row['Total'] = getCanalTotal(suc.id, canal.id)
        rows.push(row)
      })
      // Subtotal row
      const subtotal: Record<string, unknown> = { Sucursal: suc.nombre, Canal: 'TOTAL' }
      dates.forEach(d => {
        subtotal[format(new Date(d + 'T12:00:00'), 'dd/MM', { locale: es })] = getSucursalTotal(suc.id, d)
      })
      subtotal['Total'] = getSucursalGrandTotal(suc.id)
      rows.push(subtotal)
      rows.push({}) // empty row separator
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Ingresos')
    XLSX.writeFile(wb, `ingresos_${startDate}.xlsx`)
    toast.success('Excel exportado')
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" /> Ingresos Diarios</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" /> Excel
          </Button>
          {userRole !== 'viewer' && (
            <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
              <Settings className="h-4 w-4 mr-2" /> Configurar
            </Button>
          )}
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setStartDate(format(subDays(new Date(startDate), numDays), 'yyyy-MM-dd'))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input type="date" className="w-[160px]" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <span className="text-sm text-muted-foreground">al {format(addDays(new Date(startDate), numDays - 1), 'dd/MM/yyyy')}</span>
        <Button variant="outline" size="icon" onClick={() => setStartDate(format(addDays(new Date(startDate), numDays), 'yyyy-MM-dd'))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="flex gap-1 ml-4">
          {[7, 14, 30].map(n => (
            <Button key={n} variant={numDays === n ? 'default' : 'outline'} size="sm" onClick={() => setNumDays(n)}>
              {n}d
            </Button>
          ))}
        </div>
      </div>

      {/* Config panel */}
      {showConfig && (
        <Card>
          <CardHeader><CardTitle className="text-base">Configurar sucursales y canales</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sucursales */}
              <div className="space-y-3">
                <Label className="font-semibold text-base">Sucursales</Label>
                {sucursales.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sucursales.map(s => (
                      <Badge key={s.id} variant="outline" className="py-1 pr-1 flex items-center gap-1">
                        {s.nombre}
                        <button
                          onClick={() => deleteSucursal(s.id)}
                          className="ml-1 rounded-full hover:bg-red-100 p-0.5"
                          title="Eliminar sucursal"
                        >
                          <X className="h-3 w-3 text-red-500" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <form onSubmit={addSucursal} className="flex gap-2">
                  <Input
                    placeholder="Nombre de la sucursal..."
                    value={newSucursal}
                    onChange={(e) => setNewSucursal(e.target.value)}
                  />
                  <Button type="submit" size="sm"><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
                </form>
              </div>

              {/* Canales */}
              <div className="space-y-3">
                <Label className="font-semibold text-base">Canales de ingreso</Label>
                {canales.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {canales.map(c => (
                      <Badge key={c.id} variant="outline" className="py-1 pr-1 flex items-center gap-1">
                        {c.nombre}
                        <span className="text-xs opacity-60">
                          ({FRECUENCIAS_INGRESO.find(f => f.value === c.frecuencia)?.label || 'Diario'})
                        </span>
                        {c.dia_deposito && <span className="text-xs opacity-60">dep: {c.dia_deposito}</span>}
                        {c.monto_aproximado != null && c.monto_aproximado > 0 && (
                          <span className="text-xs opacity-60">~{formatMXN(c.monto_aproximado)}</span>
                        )}
                        <button
                          onClick={() => deleteCanal(c.id)}
                          className="ml-1 rounded-full hover:bg-red-100 p-0.5"
                          title="Eliminar canal"
                        >
                          <X className="h-3 w-3 text-red-500" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {canales.length === 0 && (
                  <Button variant="outline" size="sm" onClick={initDefaults}>
                    Crear canales predeterminados (Efectivo, Tarjeta, Clip, TPV, Uber, Rappi)
                  </Button>
                )}
                <form onSubmit={addCanal} className="space-y-2 border rounded-md p-3 bg-muted/30">
                  <Label className="text-sm text-muted-foreground">Agregar canal</Label>
                  <div className="flex gap-2">
                    <Select value={newCanal} onValueChange={setNewCanal}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar canal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CANALES_PREDEFINIDOS.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newCanalFrecuencia} onValueChange={setNewCanalFrecuencia}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Frecuencia" />
                      </SelectTrigger>
                      <SelectContent>
                        {FRECUENCIAS_INGRESO.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newCanal === 'Otro' && (
                    <Input
                      placeholder="Escribe el nombre del canal..."
                      value={newCanalCustom}
                      onChange={(e) => setNewCanalCustom(e.target.value)}
                    />
                  )}
                  {newCanalFrecuencia !== 'diario' && (
                    <div className="flex gap-2">
                      <Select value={newCanalDia} onValueChange={setNewCanalDia}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Día de depósito..." />
                        </SelectTrigger>
                        <SelectContent>
                          {DIAS_SEMANA.map(d => (
                            <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input placeholder="Monto aprox. (opcional)" value={newCanalMonto} onChange={(e) => setNewCanalMonto(e.target.value)} className="flex-1" type="number" />
                    <Button type="submit" size="sm"><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
                  </div>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid */}
      {sucursales.length === 0 || canales.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Configura al menos una sucursal y un canal de ingreso para comenzar.</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowConfig(true)}>
              <Settings className="h-4 w-4 mr-2" /> Configurar
            </Button>
          </CardContent>
        </Card>
      ) : (
        sucursales.map(suc => (
          <Card key={suc.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">{suc.nombre}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 min-w-[120px] font-medium text-muted-foreground">Canal</th>
                      {dates.map(d => {
                        const dateObj = new Date(d + 'T12:00:00')
                        return (
                          <th key={d} className="text-center py-2 px-1 min-w-[80px]">
                            <div className="font-medium">{format(dateObj, 'EEE', { locale: es })}</div>
                            <div className="text-xs text-muted-foreground">{format(dateObj, 'dd/MM')}</div>
                          </th>
                        )
                      })}
                      <th className="text-right py-2 pl-2 min-w-[100px] font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {canales.map(canal => (
                      <tr key={canal.id} className="border-b border-dashed">
                        <td className="py-1 pr-4">
                          <div className="flex items-center gap-1">
                            <span>{canal.nombre}</span>
                            <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                              {FRECUENCIAS_INGRESO.find(f => f.value === canal.frecuencia)?.label || canal.frecuencia}
                            </span>
                            {canal.dia_deposito && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{canal.dia_deposito}</span>
                            )}
                          </div>
                        </td>
                        {dates.map(d => {
                          const key = getCellKey(suc.id, canal.id, d)
                          const val = ingresos[key]?.monto || 0
                          return (
                            <td key={d} className="py-1 px-1">
                              <Input
                                type="number"
                                className="h-8 text-center text-sm w-full min-w-[70px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={val || ''}
                                onChange={(e) => handleCellChange(suc.id, canal.id, d, e.target.value)}
                                placeholder="0"
                                disabled={userRole === 'viewer'}
                              />
                            </td>
                          )
                        })}
                        <td className="py-1 pl-2 text-right font-medium">
                          {formatMXN(getCanalTotal(suc.id, canal.id))}
                        </td>
                      </tr>
                    ))}
                    {/* Subtotal row */}
                    <tr className="bg-muted/50 font-semibold">
                      <td className="py-2 pr-4">Total {suc.nombre}</td>
                      {dates.map(d => (
                        <td key={d} className="py-2 px-1 text-center">
                          {formatMXN(getSucursalTotal(suc.id, d))}
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right text-primary">
                        {formatMXN(getSucursalGrandTotal(suc.id))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Grand total */}
      {sucursales.length > 1 && (
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 min-w-[120px] font-bold">TOTAL GENERAL</th>
                    {dates.map(d => {
                      const dateObj = new Date(d + 'T12:00:00')
                      return (
                        <th key={d} className="text-center py-2 px-1 min-w-[80px]">
                          <div className="text-xs">{format(dateObj, 'EEE dd/MM', { locale: es })}</div>
                        </th>
                      )
                    })}
                    <th className="text-right py-2 pl-2 min-w-[100px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-bold text-primary">
                    <td className="py-2 pr-4">Todas las sucursales</td>
                    {dates.map(d => (
                      <td key={d} className="py-2 px-1 text-center">{formatMXN(getDayGrandTotal(d))}</td>
                    ))}
                    <td className="py-2 pl-2 text-right text-lg">{formatMXN(getGrandTotal())}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
