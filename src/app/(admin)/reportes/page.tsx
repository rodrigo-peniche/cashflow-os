'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMXN } from '@/lib/constants'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { ExportButton } from '@/components/shared/export-button'
import { BarChart3 } from 'lucide-react'

// ─── Interfaces ───────────────────────────────────────────────────

interface ResumenGeneral {
  totalFacturas: number
  montoTotal: number
  facturasPagadas: number
  montoPagado: number
  facturasPendientes: number
  montoPendiente: number
  totalIngresos: number
  balance: number
}

interface EgresoPorProveedor {
  proveedor: string
  cantidad: number
  total: number
  porcentaje: number
}

interface EgresoPorSucursal {
  sucursal: string
  cantidad: number
  total: number
  porcentaje: number
}

interface FlujoMensual {
  mes: string
  mesLabel: string
  facturas: number
  egresos: number
  pagadas: number
  pendientes: number
}

interface AportacionPorSocio {
  socio: string
  totalRecibido: number
  totalPendiente: number
  cantidad: number
}

// ─── Page Component ───────────────────────────────────────────────

export default function ReportesPage() {
  const { empresaId } = useEmpresa()

  // Period selector
  const [desde, setDesde] = useState(() => {
    const d = new Date()
    return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
  })
  const [hasta, setHasta] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  // Data
  const [resumen, setResumen] = useState<ResumenGeneral | null>(null)
  const [egresosPorProveedor, setEgresosPorProveedor] = useState<EgresoPorProveedor[]>([])
  const [egresosPorSucursal, setEgresosPorSucursal] = useState<EgresoPorSucursal[]>([])
  const [flujoMensual, setFlujoMensual] = useState<FlujoMensual[]>([])
  const [aportacionesPorSocio, setAportacionesPorSocio] = useState<AportacionPorSocio[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Quick period buttons ─────────────────────────────────────

  function setThisMonth() {
    const d = new Date()
    setDesde(format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd'))
    setHasta(format(new Date(d.getFullYear(), d.getMonth() + 1, 0), 'yyyy-MM-dd'))
  }

  function setLastMonth() {
    const d = new Date()
    setDesde(format(new Date(d.getFullYear(), d.getMonth() - 1, 1), 'yyyy-MM-dd'))
    setHasta(format(new Date(d.getFullYear(), d.getMonth(), 0), 'yyyy-MM-dd'))
  }

  function setLast3Months() {
    const d = new Date()
    setDesde(format(new Date(d.getFullYear(), d.getMonth() - 2, 1), 'yyyy-MM-dd'))
    setHasta(format(new Date(d.getFullYear(), d.getMonth() + 1, 0), 'yyyy-MM-dd'))
  }

  function setThisYear() {
    const d = new Date()
    setDesde(format(new Date(d.getFullYear(), 0, 1), 'yyyy-MM-dd'))
    setHasta(format(new Date(d.getFullYear(), 11, 31), 'yyyy-MM-dd'))
  }

  // ─── Load data ────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)

    try {
      const supabase = createClient()

      const [facturasRes, ingresosRes, aportacionesRes] = await Promise.all([
        supabase
          .from('facturas')
          .select('id, proveedor_id, sucursal_id, total, estatus, fecha_factura, proveedores(nombre_empresa), sucursales(id, nombre)')
          .eq('empresa_id', empresaId)
          .gte('fecha_factura', desde)
          .lte('fecha_factura', hasta),
        supabase
          .from('ingresos_diarios')
          .select('id, monto, fecha')
          .eq('empresa_id', empresaId)
          .gte('fecha', desde)
          .lte('fecha', hasta),
        supabase
          .from('aportaciones')
          .select('id, socio_id, monto, estatus, fecha, socios(nombre)')
          .eq('empresa_id', empresaId)
          .gte('fecha', desde)
          .lte('fecha', hasta),
      ])

      if (facturasRes.error) { toast.error('Error cargando facturas: ' + facturasRes.error.message); setLoading(false); return }
      if (ingresosRes.error) { toast.error('Error cargando ingresos: ' + ingresosRes.error.message); setLoading(false); return }
      if (aportacionesRes.error) { toast.error('Error cargando aportaciones: ' + aportacionesRes.error.message); setLoading(false); return }

      const facturas = facturasRes.data || []
      const ingresos = ingresosRes.data || []
      const aportaciones = aportacionesRes.data || []

      // ── 1. Resumen General ──────────────────────────────────
      const totalFacturas = facturas.length
      const montoTotal = facturas.reduce((s, f) => s + (f.total || 0), 0)
      const pagadas = facturas.filter(f => f.estatus === 'pagada')
      const pendientes = facturas.filter(f => f.estatus !== 'pagada' && f.estatus !== 'rechazada')
      const totalIngresos = ingresos.reduce((s, i) => s + (i.monto || 0), 0)

      setResumen({
        totalFacturas,
        montoTotal,
        facturasPagadas: pagadas.length,
        montoPagado: pagadas.reduce((s, f) => s + (f.total || 0), 0),
        facturasPendientes: pendientes.length,
        montoPendiente: pendientes.reduce((s, f) => s + (f.total || 0), 0),
        totalIngresos,
        balance: totalIngresos - montoTotal,
      })

      // ── 2. Egresos por Proveedor ────────────────────────────
      const provMap = new Map<string, { cantidad: number; total: number }>()
      for (const f of facturas) {
        const nombre = (f as unknown as Record<string, Record<string, string>>).proveedores?.nombre_empresa || 'Sin proveedor'
        const prev = provMap.get(nombre) || { cantidad: 0, total: 0 }
        provMap.set(nombre, { cantidad: prev.cantidad + 1, total: prev.total + (f.total || 0) })
      }
      const provArr = Array.from(provMap.entries())
        .map(([proveedor, v]) => ({ proveedor, ...v, porcentaje: montoTotal > 0 ? (v.total / montoTotal) * 100 : 0 }))
        .sort((a, b) => b.total - a.total)
      setEgresosPorProveedor(provArr)

      // ── 3. Egresos por Sucursal ─────────────────────────────
      const sucMap = new Map<string, { cantidad: number; total: number }>()
      for (const f of facturas) {
        const nombre = (f as unknown as Record<string, Record<string, string>>).sucursales?.nombre || 'Sin sucursal'
        const prev = sucMap.get(nombre) || { cantidad: 0, total: 0 }
        sucMap.set(nombre, { cantidad: prev.cantidad + 1, total: prev.total + (f.total || 0) })
      }
      const sucArr = Array.from(sucMap.entries())
        .map(([sucursal, v]) => ({ sucursal, ...v, porcentaje: montoTotal > 0 ? (v.total / montoTotal) * 100 : 0 }))
        .sort((a, b) => b.total - a.total)
      setEgresosPorSucursal(sucArr)

      // ── 4. Flujo Mensual ────────────────────────────────────
      const mesMap = new Map<string, { facturas: number; egresos: number; pagadas: number; pendientes: number }>()
      for (const f of facturas) {
        const mes = f.fecha_factura?.substring(0, 7) || 'unknown'
        const prev = mesMap.get(mes) || { facturas: 0, egresos: 0, pagadas: 0, pendientes: 0 }
        prev.facturas += 1
        prev.egresos += f.total || 0
        if (f.estatus === 'pagada') prev.pagadas += f.total || 0
        else if (f.estatus !== 'rechazada') prev.pendientes += f.total || 0
        mesMap.set(mes, prev)
      }
      const mesArr = Array.from(mesMap.entries())
        .map(([mes, v]) => {
          let mesLabel: string
          try {
            const [year, month] = mes.split('-')
            mesLabel = format(new Date(parseInt(year), parseInt(month) - 1, 1), 'MMMM yyyy', { locale: es })
            mesLabel = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)
          } catch {
            mesLabel = mes
          }
          return { mes, mesLabel, ...v }
        })
        .sort((a, b) => a.mes.localeCompare(b.mes))
      setFlujoMensual(mesArr)

      // ── 5. Aportaciones por Socio ───────────────────────────
      const socioMap = new Map<string, { totalRecibido: number; totalPendiente: number; cantidad: number }>()
      for (const a of aportaciones) {
        const nombre = (a as unknown as Record<string, Record<string, string>>).socios?.nombre || 'Sin socio'
        const prev = socioMap.get(nombre) || { totalRecibido: 0, totalPendiente: 0, cantidad: 0 }
        prev.cantidad += 1
        if (a.estatus === 'recibida') prev.totalRecibido += a.monto || 0
        else if (a.estatus === 'pendiente') prev.totalPendiente += a.monto || 0
        socioMap.set(nombre, prev)
      }
      const socioArr = Array.from(socioMap.entries())
        .map(([socio, v]) => ({ socio, ...v }))
        .sort((a, b) => (b.totalRecibido + b.totalPendiente) - (a.totalRecibido + a.totalPendiente))
      setAportacionesPorSocio(socioArr)

    } catch {
      toast.error('Error cargando reportes')
    } finally {
      setLoading(false)
    }
  }, [empresaId, desde, hasta])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Reportes</h1>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="desde">Desde</Label>
              <Input
                id="desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hasta">Hasta</Label>
              <Input
                id="hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={setThisMonth}>Este mes</Button>
              <Button variant="outline" size="sm" onClick={setLastMonth}>Mes pasado</Button>
              <Button variant="outline" size="sm" onClick={setLast3Months}>Ultimos 3 meses</Button>
              <Button variant="outline" size="sm" onClick={setThisYear}>Este ano</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {!loading && resumen && (
        <>
          {/* 1. Resumen General */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen General</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-sm text-muted-foreground">Total facturas</p>
                  <p className="text-2xl font-bold">{resumen.totalFacturas}</p>
                  <p className="text-sm text-muted-foreground">{formatMXN(resumen.montoTotal)}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-sm text-muted-foreground">Pagadas</p>
                  <p className="text-2xl font-bold text-green-600">{resumen.facturasPagadas}</p>
                  <p className="text-sm text-muted-foreground">{formatMXN(resumen.montoPagado)}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-600">{resumen.facturasPendientes}</p>
                  <p className="text-sm text-muted-foreground">{formatMXN(resumen.montoPendiente)}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-sm text-muted-foreground">Ingresos estimados</p>
                  <p className="text-2xl font-bold text-blue-600">{formatMXN(resumen.totalIngresos)}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">Balance:</span>
                    <Badge variant={resumen.balance >= 0 ? 'default' : 'destructive'}>
                      {formatMXN(resumen.balance)}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Egresos por Proveedor */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Egresos por Proveedor</CardTitle>
              <ExportButton
                data={egresosPorProveedor.map(e => ({
                  Proveedor: e.proveedor,
                  'Num. Facturas': e.cantidad,
                  Total: e.total,
                  '% del total': e.porcentaje.toFixed(1) + '%',
                }))}
                filename="egresos-por-proveedor"
                sheetName="Proveedores"
              />
            </CardHeader>
            <CardContent>
              {egresosPorProveedor.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay facturas en este periodo</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right"># Facturas</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% del total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {egresosPorProveedor.map((e) => (
                        <TableRow key={e.proveedor}>
                          <TableCell className="font-medium">{e.proveedor}</TableCell>
                          <TableCell className="text-right">{e.cantidad}</TableCell>
                          <TableCell className="text-right">{formatMXN(e.total)}</TableCell>
                          <TableCell className="text-right">{e.porcentaje.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Egresos por Sucursal */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Egresos por Sucursal</CardTitle>
              <ExportButton
                data={egresosPorSucursal.map(e => ({
                  Sucursal: e.sucursal,
                  'Num. Facturas': e.cantidad,
                  Total: e.total,
                  '% del total': e.porcentaje.toFixed(1) + '%',
                }))}
                filename="egresos-por-sucursal"
                sheetName="Sucursales"
              />
            </CardHeader>
            <CardContent>
              {egresosPorSucursal.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay facturas en este periodo</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sucursal</TableHead>
                        <TableHead className="text-right"># Facturas</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">% del total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {egresosPorSucursal.map((e) => (
                        <TableRow key={e.sucursal}>
                          <TableCell className="font-medium">{e.sucursal}</TableCell>
                          <TableCell className="text-right">{e.cantidad}</TableCell>
                          <TableCell className="text-right">{formatMXN(e.total)}</TableCell>
                          <TableCell className="text-right">{e.porcentaje.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Flujo Mensual */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Flujo Mensual</CardTitle>
              <ExportButton
                data={flujoMensual.map(m => ({
                  Mes: m.mesLabel,
                  Facturas: m.facturas,
                  Egresos: m.egresos,
                  Pagadas: m.pagadas,
                  Pendientes: m.pendientes,
                }))}
                filename="flujo-mensual"
                sheetName="Flujo Mensual"
              />
            </CardHeader>
            <CardContent>
              {flujoMensual.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay datos en este periodo</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mes</TableHead>
                        <TableHead className="text-right">Facturas</TableHead>
                        <TableHead className="text-right">Egresos</TableHead>
                        <TableHead className="text-right">Pagadas</TableHead>
                        <TableHead className="text-right">Pendientes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flujoMensual.map((m) => (
                        <TableRow key={m.mes}>
                          <TableCell className="font-medium">{m.mesLabel}</TableCell>
                          <TableCell className="text-right">{m.facturas}</TableCell>
                          <TableCell className="text-right">{formatMXN(m.egresos)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatMXN(m.pagadas)}</TableCell>
                          <TableCell className="text-right text-yellow-600">{formatMXN(m.pendientes)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Aportaciones de Socios */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Aportaciones de Socios</CardTitle>
              <ExportButton
                data={aportacionesPorSocio.map(a => ({
                  Socio: a.socio,
                  'Num. Aportaciones': a.cantidad,
                  Recibido: a.totalRecibido,
                  Pendiente: a.totalPendiente,
                }))}
                filename="aportaciones-socios"
                sheetName="Aportaciones"
              />
            </CardHeader>
            <CardContent>
              {aportacionesPorSocio.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay aportaciones en este periodo</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Socio</TableHead>
                        <TableHead className="text-right"># Aportaciones</TableHead>
                        <TableHead className="text-right">Recibido</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aportacionesPorSocio.map((a) => (
                        <TableRow key={a.socio}>
                          <TableCell className="font-medium">{a.socio}</TableCell>
                          <TableCell className="text-right">{a.cantidad}</TableCell>
                          <TableCell className="text-right text-green-600">{formatMXN(a.totalRecibido)}</TableCell>
                          <TableCell className="text-right text-yellow-600">{formatMXN(a.totalPendiente)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
