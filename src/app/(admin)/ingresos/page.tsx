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
import { DollarSign, Plus, ChevronLeft, ChevronRight, Settings, Download, X, RefreshCw, Save } from 'lucide-react'
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
  const [localEdits, setLocalEdits] = useState<Record<string, number>>({}) // local changes not yet saved
  const [saving, setSaving] = useState(false)

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

    // Cleanup: delete orphaned ingresos without valid sucursal
    const sucIds = new Set((sucRes.data || []).map(s => s.id))
    const orphans = (ingData || []).filter(ing => !sucIds.has(ing.sucursal_id))
    if (orphans.length > 0) {
      for (const o of orphans) {
        await supabase.from('ingresos_diarios').delete().eq('id', o.id)
      }
    }

    setLoading(false)
  }, [empresaId, startDate, numDays])

  useEffect(() => { loadData() }, [loadData])

  function getCellKey(sucId: string, canalId: string, fecha: string) {
    return `${sucId}_${canalId}_${fecha}`
  }

  function shouldPrefill(canal: CanalIngreso, fecha: string): boolean {
    if (!canal.monto_aproximado) return false
    const date = new Date(fecha + 'T12:00:00')
    const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

    const diaMap: Record<string, number> = {
      domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
    }

    switch (canal.frecuencia) {
      case 'diario':
        return true
      case 'semanal':
        if (!canal.dia_deposito) return false
        return dayOfWeek === diaMap[canal.dia_deposito]
      case 'quincenal':
        if (!canal.dia_deposito) return false
        if (dayOfWeek !== diaMap[canal.dia_deposito]) return false
        // Only 1st and 3rd occurrence of that weekday in the month
        const dayOfMonth = date.getDate()
        return dayOfMonth <= 7 || (dayOfMonth >= 15 && dayOfMonth <= 21)
      case 'mensual':
        // Default: day 1 of each month, or use dia_deposito as day number
        if (canal.dia_deposito) {
          const targetDay = parseInt(canal.dia_deposito)
          if (!isNaN(targetDay)) return date.getDate() === targetDay
          return dayOfWeek === diaMap[canal.dia_deposito] && date.getDate() <= 7
        }
        return date.getDate() === 1
      default:
        return true
    }
  }

  function getCellValue(sucId: string, canalId: string, fecha: string): number {
    const key = getCellKey(sucId, canalId, fecha)
    // Priority: local edit > saved value > monto_aproximado from canal (respecting frequency)
    if (localEdits[key] !== undefined) return localEdits[key]
    if (ingresos[key]) return ingresos[key].monto
    // Default: use monto_aproximado from canal config, but only on matching days
    const canal = canales.find(c => c.id === canalId)
    if (canal && shouldPrefill(canal, fecha)) return canal.monto_aproximado || 0
    return 0
  }

  function handleCellEdit(sucId: string, canalId: string, fecha: string, value: string) {
    const key = getCellKey(sucId, canalId, fecha)
    const monto = Number(value) || 0
    setLocalEdits(prev => ({ ...prev, [key]: monto }))
    // mark changed
  }

  async function saveAllChanges() {
    setSaving(true)
    const supabase = createClient()
    let savedCount = 0

    for (const suc of sucursales) {
      for (const canal of canales) {
        for (const fecha of dates) {
          const key = getCellKey(suc.id, canal.id, fecha)
          const currentVal = getCellValue(suc.id, canal.id, fecha)
          const existing = ingresos[key]

          // Only save if there's a value > 0 or an existing record to update/delete
          if (existing?.id) {
            if (currentVal === 0) {
              await supabase.from('ingresos_diarios').delete().eq('id', existing.id)
              savedCount++
            } else if (currentVal !== existing.monto) {
              await supabase.from('ingresos_diarios').update({ monto: currentVal }).eq('id', existing.id)
              savedCount++
            }
          } else if (currentVal > 0) {
            await supabase.from('ingresos_diarios').insert({
              empresa_id: empresaId,
              sucursal_id: suc.id,
              canal_id: canal.id,
              fecha,
              monto: currentVal,
            })
            savedCount++
          }
        }
      }
    }

    setLocalEdits({})
    // changes saved
    setSaving(false)
    toast.success(`${savedCount} registros guardados — se reflejarán en el Dashboard`)
    loadData()
  }

  async function addSucursal(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const nombre = newSucursal.trim()
    if (!nombre) { toast.error('Escribe un nombre de sucursal'); return }
    if (!empresaId) { toast.error('No hay empresa seleccionada'); return }
    const supabase = createClient()
    // Check if exists (maybe inactive) - use maybeSingle to avoid error when no match
    const { data: existing } = await supabase
      .from('sucursales')
      .select('id, activa')
      .eq('empresa_id', empresaId)
      .eq('nombre', nombre)
      .maybeSingle()
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
      .maybeSingle()
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
    return canales.reduce((sum, c) => sum + getCellValue(sucId, c.id, fecha), 0)
  }

  function getCanalTotal(sucId: string, canalId: string): number {
    return dates.reduce((sum, d) => sum + getCellValue(sucId, canalId, d), 0)
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
          row[label] = getCellValue(suc.id, canal.id, d)
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
        <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" /> Ingresos Aproximados</h1>
        <div className="flex gap-2">
          {userRole !== 'viewer' && sucursales.length > 0 && canales.length > 0 && (
            <Button
              size="sm"
              onClick={saveAllChanges}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Guardar y actualizar Dashboard</>
              )}
            </Button>
          )}
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
      <p className="text-sm text-muted-foreground -mt-4">
        Los montos configurados en los canales se pre-llenan automáticamente. Ajusta y presiona &quot;Guardar&quot; para reflejar en el Dashboard.
      </p>

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

      {/* Canales config - always visible, editable inline */}
      {canales.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Canales de ingreso configurados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Canal</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Frecuencia</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Día depósito</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Monto aprox.</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {canales.map(c => (
                    <tr key={c.id} className="border-b border-dashed">
                      <td className="py-1.5 pr-2 font-medium">{c.nombre}</td>
                      <td className="py-1.5 px-2">
                        {userRole !== 'viewer' ? (
                          <Select
                            value={c.frecuencia}
                            onValueChange={async (v) => {
                              const supabase = createClient()
                              await supabase.from('canales_ingreso').update({ frecuencia: v }).eq('id', c.id)
                              loadData()
                            }}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FRECUENCIAS_INGRESO.map(f => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span>{FRECUENCIAS_INGRESO.find(f => f.value === c.frecuencia)?.label}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {userRole !== 'viewer' && c.frecuencia !== 'diario' ? (
                          <Select
                            value={c.dia_deposito || ''}
                            onValueChange={async (v) => {
                              const supabase = createClient()
                              await supabase.from('canales_ingreso').update({ dia_deposito: v || null }).eq('id', c.id)
                              loadData()
                            }}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {DIAS_SEMANA.map(d => (
                                <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : c.frecuencia === 'diario' ? (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        ) : (
                          <span>{c.dia_deposito ? c.dia_deposito.charAt(0).toUpperCase() + c.dia_deposito.slice(1) : '—'}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {userRole !== 'viewer' ? (
                          <Input
                            type="number"
                            className="h-8 w-[120px] text-sm"
                            defaultValue={c.monto_aproximado || ''}
                            placeholder="$0"
                            onBlur={async (e) => {
                              const val = Number(e.target.value) || null
                              if (val !== c.monto_aproximado) {
                                const supabase = createClient()
                                await supabase.from('canales_ingreso').update({ monto_aproximado: val }).eq('id', c.id)
                                loadData()
                                toast.success(`Monto de ${c.nombre} actualizado`)
                              }
                            }}
                          />
                        ) : (
                          <span>{c.monto_aproximado ? formatMXN(c.monto_aproximado) : '—'}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        {userRole !== 'viewer' && (
                          <button onClick={() => deleteCanal(c.id)} className="text-red-400 hover:text-red-600 p-1" title="Eliminar canal">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                          const val = getCellValue(suc.id, canal.id, d)
                          const key = getCellKey(suc.id, canal.id, d)
                          const isFromConfig = !ingresos[key] && localEdits[key] === undefined && val > 0
                          return (
                            <td key={d} className="py-1 px-1">
                              <Input
                                type="number"
                                className={`h-8 text-center text-sm w-full min-w-[70px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isFromConfig ? 'text-blue-500 italic' : ''}`}
                                defaultValue={val || ''}
                                key={`${key}-${val}`}
                                onBlur={(e) => handleCellEdit(suc.id, canal.id, d, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCellEdit(suc.id, canal.id, d, (e.target as HTMLInputElement).value)
                                    ;(e.target as HTMLInputElement).blur()
                                  }
                                }}
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

      {/* Add sucursal / canal - at the bottom */}
      {showConfig && userRole !== 'viewer' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Agregar sucursal o canal</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sucursales */}
              <div className="space-y-3">
                <Label className="font-semibold text-base">Sucursales</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {sucursales.map(s => (
                    <Badge key={s.id} variant="outline" className="py-1 pr-1 flex items-center gap-1">
                      {s.nombre}
                      <button onClick={() => deleteSucursal(s.id)} className="ml-1 rounded-full hover:bg-red-100 p-0.5">
                        <X className="h-3 w-3 text-red-500" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <form onSubmit={addSucursal} className="flex gap-2">
                  <Input placeholder="Nombre de la sucursal..." value={newSucursal} onChange={(e) => setNewSucursal(e.target.value)} />
                  <Button type="submit" size="sm"><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
                </form>
              </div>

              {/* Canales */}
              <div className="space-y-3">
                <Label className="font-semibold text-base">Nuevo canal de ingreso</Label>
                {canales.length === 0 && (
                  <Button variant="outline" size="sm" onClick={initDefaults}>
                    Crear canales predeterminados (Efectivo, Tarjeta, Clip, TPV, Uber, Rappi)
                  </Button>
                )}
                <form onSubmit={addCanal} className="space-y-2 border rounded-md p-3 bg-muted/30">
                  <div className="flex gap-2">
                    <Select value={newCanal} onValueChange={setNewCanal}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Seleccionar canal..." /></SelectTrigger>
                      <SelectContent>
                        {CANALES_PREDEFINIDOS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Select value={newCanalFrecuencia} onValueChange={setNewCanalFrecuencia}>
                      <SelectTrigger className="w-[140px]"><SelectValue placeholder="Frecuencia" /></SelectTrigger>
                      <SelectContent>
                        {FRECUENCIAS_INGRESO.map(f => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newCanal === 'Otro' && (
                    <Input placeholder="Escribe el nombre del canal..." value={newCanalCustom} onChange={(e) => setNewCanalCustom(e.target.value)} />
                  )}
                  {newCanalFrecuencia !== 'diario' && (
                    <Select value={newCanalDia} onValueChange={setNewCanalDia}>
                      <SelectTrigger><SelectValue placeholder="Día de depósito..." /></SelectTrigger>
                      <SelectContent>
                        {DIAS_SEMANA.map(d => (<SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>))}
                      </SelectContent>
                    </Select>
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
