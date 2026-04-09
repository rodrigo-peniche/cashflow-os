'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMXN, FLOW_COLORS } from '@/lib/constants'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart,
} from 'recharts'
import type { FlujoDiario, FlujoDiarioItem } from '@/lib/types'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

function FlowCell({
  value,
  items,
  bgStyle,
  className = '',
}: {
  value: number
  items: FlujoDiarioItem[]
  bgStyle?: React.CSSProperties
  className?: string
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const cellRef = useRef<HTMLTableCellElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (value <= 0) {
    return (
      <td className={`text-center p-2 text-sm ${className}`}>
        —
      </td>
    )
  }

  return (
    <td
      ref={cellRef}
      className={`text-center p-2 text-sm relative ${className}`}
      style={{ ...bgStyle, cursor: items.length > 0 ? 'pointer' : undefined }}
      onMouseEnter={() => {
        if (items.length === 0) return
        timeoutRef.current = setTimeout(() => setShowTooltip(true), 200)
      }}
      onMouseLeave={() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setShowTooltip(false)
      }}
    >
      {formatMXN(value)}
      {showTooltip && items.length > 0 && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-left"
          style={{ pointerEvents: 'none' }}
        >
          <div className="text-xs font-semibold text-gray-700 mb-2 border-b pb-1">
            Desglose ({items.length} {items.length === 1 ? 'concepto' : 'conceptos'})
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between items-start gap-2 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.descripcion}</p>
                  <p className="text-gray-400">
                    {item.origen === 'factura' ? 'Factura' :
                     item.origen === 'pago_programado' ? 'Pago prog.' : 'Tentativo'}
                  </p>
                </div>
                <span className="font-semibold text-gray-800 shrink-0">{formatMXN(item.monto)}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-2 pt-1.5 flex justify-between text-xs font-bold text-gray-900">
            <span>Total</span>
            <span>{formatMXN(value)}</span>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
        </div>
      )}
    </td>
  )
}

interface OverdueData {
  total: number
  items: FlujoDiarioItem[]
}

export default function DashboardPage() {
  const [flujo, setFlujo] = useState<FlujoDiario[]>([])
  const [overdue, setOverdue] = useState<OverdueData>({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(true)
  const { empresaId } = useEmpresa()

  useEffect(() => {
    if (!empresaId) return
    fetch('/api/flujo', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.days && Array.isArray(data.days)) {
          setFlujo(data.days)
          setOverdue(data.overdue || { total: 0, items: [] })
        } else if (Array.isArray(data)) {
          // backwards compat
          setFlujo(data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [empresaId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  const saldoActual = flujo[0]?.saldo_inicial || 0
  const totalEgresos = flujo.reduce((s, d) => s + d.egreso_real + d.egreso_estimado, 0)
  const totalIngresos = flujo.reduce((s, d) => s + d.ingreso_real + d.ingreso_estimado, 0)

  const saldoMinimo = flujo.reduce(
    (min, d) => (d.saldo_final < min.saldo ? { saldo: d.saldo_final, fecha: d.fecha } : min),
    { saldo: Infinity, fecha: '' }
  )

  // Chart data
  const chartData = flujo.map((d) => ({
    fecha: format(parseISO(d.fecha), 'dd/MM', { locale: es }),
    'Ingreso real': d.ingreso_real,
    'Ingreso est.': d.ingreso_estimado,
    'Egreso real': -d.egreso_real,
    'Egreso est.': -d.egreso_estimado,
    'Saldo': d.saldo_final,
  }))

  // Upcoming items for next 10 days
  const upcomingItems = flujo
    .slice(0, 10)
    .flatMap((d) =>
      d.items.map((item) => ({
        ...item,
        fecha: d.fecha,
      }))
    )
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  function exportToExcel() {
    // Flow table data
    const flowRows = flujo.map((d) => ({
      Fecha: format(parseISO(d.fecha), 'dd/MM/yyyy'),
      'Saldo inicial': d.saldo_inicial,
      'Ingresos reales': d.ingreso_real,
      'Ingresos estimados': d.ingreso_estimado,
      'Egresos programados': d.egreso_real,
      'Egresos estimados': d.egreso_estimado,
      'Saldo final': d.saldo_final,
    }))

    // Overdue items
    const overdueRows = overdue.items.map((item) => ({
      Concepto: item.descripcion,
      Monto: item.monto,
      Origen: item.origen === 'factura' ? 'Factura' : item.origen === 'pago_programado' ? 'Pago prog.' : 'Tentativo',
    }))

    // Detail items per day
    const detailRows = flujo.flatMap((d) =>
      d.items.map((item) => ({
        Fecha: format(parseISO(d.fecha), 'dd/MM/yyyy'),
        Tipo: item.tipo,
        Concepto: item.descripcion,
        Monto: item.monto,
        Origen: item.origen === 'factura' ? 'Factura' : item.origen === 'pago_programado' ? 'Pago prog.' : 'Tentativo',
      }))
    )

    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(flowRows)
    XLSX.utils.book_append_sheet(wb, ws1, 'Flujo 15 días')

    if (overdueRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(overdueRows)
      XLSX.utils.book_append_sheet(wb, ws2, 'Vencidas')
    }

    if (detailRows.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(detailRows)
      XLSX.utils.book_append_sheet(wb, ws3, 'Desglose')
    }

    XLSX.writeFile(wb, `flujo-efectivo-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard — Flujo de Efectivo 15 Días</h1>
        <Button variant="outline" size="sm" onClick={exportToExcel}>
          <Download className="h-4 w-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" style={{ color: saldoActual >= 0 ? FLOW_COLORS.saldo_positivo : FLOW_COLORS.saldo_negativo }}>
              {formatMXN(saldoActual)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Egresos próx. 15 días</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatMXN(totalEgresos)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos esperados</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatMXN(totalIngresos)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo mínimo proyectado</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p
              className="text-2xl font-bold"
              style={{ color: saldoMinimo.saldo >= 0 ? FLOW_COLORS.saldo_positivo : FLOW_COLORS.saldo_negativo }}
            >
              {saldoMinimo.saldo === Infinity ? '—' : formatMXN(saldoMinimo.saldo)}
            </p>
            {saldoMinimo.fecha && (
              <p className="text-xs text-muted-foreground mt-1">
                {format(parseISO(saldoMinimo.fecha), "dd 'de' MMMM", { locale: es })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming items - collapsible, full width, moved to top */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
          onClick={() => setShowUpcoming(!showUpcoming)}
        >
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              Próximos 10 días
              {upcomingItems.length > 0 && (
                <Badge variant="outline" className="text-xs">{upcomingItems.length} movimientos</Badge>
              )}
              {overdue.items.length > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                  {overdue.items.length} vencidas — {formatMXN(overdue.total)}
                </Badge>
              )}
            </span>
            {showUpcoming ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {showUpcoming && (
          <CardContent className="pt-0">
            {/* Overdue items */}
            {overdue.items.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-red-700 mb-2">Facturas vencidas</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {overdue.items.map((item, idx) => (
                    <div key={`ov-${idx}`} className="flex items-center justify-between p-2 rounded-md border border-red-200 bg-red-50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-red-900">{item.descripcion}</p>
                        <p className="text-xs text-red-500">Vencida</p>
                      </div>
                      <span className="text-sm font-semibold text-red-700 shrink-0 ml-2">-{formatMXN(item.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Upcoming items */}
            {upcomingItems.length === 0 && overdue.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin movimientos próximos</p>
            ) : upcomingItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {upcomingItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-md border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.descripcion}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(item.fecha), "dd 'de' MMM", { locale: es })}
                        {' · '}
                        {item.origen === 'factura' ? 'Factura' :
                         item.origen === 'pago_programado' ? 'Pago prog.' : 'Tentativo'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold shrink-0 ml-2" style={{
                      color: item.tipo.includes('ingreso') ? FLOW_COLORS.ingreso_real : FLOW_COLORS.egreso_real
                    }}>
                      {item.tipo.includes('ingreso') ? '+' : '-'}{formatMXN(item.monto)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        )}
      </Card>

      {/* 15-day flow table - full width */}
      <Card>
        <CardHeader>
          <CardTitle>Flujo de efectivo — 15 días</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground sticky left-0 bg-card min-w-[120px]">Concepto</th>
                  {overdue.items.length > 0 && (
                    <th className="text-center p-2 font-medium min-w-[90px] bg-red-50">
                      <div className="text-red-700">Vencidas</div>
                      <div className="text-xs text-red-500">{overdue.items.length} fact.</div>
                    </th>
                  )}
                  {flujo.map((d) => (
                    <th key={d.fecha} className="text-center p-2 font-medium min-w-[90px]">
                      <div>{format(parseISO(d.fecha), 'EEE', { locale: es })}</div>
                      <div className="text-xs text-muted-foreground">{format(parseISO(d.fecha), 'dd/MM')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Saldo inicial */}
                <tr className="border-b">
                  <td className="p-2 font-medium sticky left-0 bg-card">Saldo inicial</td>
                  {overdue.items.length > 0 && <td className="text-center p-2 bg-red-50/50" />}
                  {flujo.map((d) => (
                    <td key={d.fecha} className="text-center p-2 font-medium">
                      {formatMXN(d.saldo_inicial)}
                    </td>
                  ))}
                </tr>

                {/* Ingresos reales */}
                <tr className="border-b">
                  <td className="p-2 sticky left-0 bg-card">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: FLOW_COLORS.ingreso_real + '20', color: FLOW_COLORS.ingreso_real }}>
                      + Ingresos reales
                    </span>
                  </td>
                  {overdue.items.length > 0 && <td className="text-center p-2 bg-red-50/50">—</td>}
                  {flujo.map((d) => (
                    <FlowCell
                      key={d.fecha}
                      value={d.ingreso_real}
                      items={d.items.filter(i => i.tipo === 'ingreso_real')}
                      bgStyle={d.ingreso_real > 0 ? { backgroundColor: FLOW_COLORS.ingreso_real + '15' } : {}}
                    />
                  ))}
                </tr>

                {/* Ingresos estimados */}
                <tr className="border-b border-dashed">
                  <td className="p-2 sticky left-0 bg-card">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border border-dashed" style={{ borderColor: FLOW_COLORS.ingreso_estimado, color: '#16a34a', backgroundColor: FLOW_COLORS.ingreso_estimado + '30' }}>
                      + Ingresos est.
                    </span>
                  </td>
                  {overdue.items.length > 0 && <td className="text-center p-2 bg-red-50/50">—</td>}
                  {flujo.map((d) => (
                    <FlowCell
                      key={d.fecha}
                      value={d.ingreso_estimado}
                      items={d.items.filter(i => i.tipo === 'ingreso_estimado')}
                      bgStyle={d.ingreso_estimado > 0 ? { backgroundColor: FLOW_COLORS.ingreso_estimado + '30', borderStyle: 'dashed' } : {}}
                    />
                  ))}
                </tr>

                {/* Egresos reales */}
                <tr className="border-b">
                  <td className="p-2 sticky left-0 bg-card">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: FLOW_COLORS.egreso_real + '15', color: FLOW_COLORS.egreso_real }}>
                      - Egresos prog.
                    </span>
                  </td>
                  {overdue.items.length > 0 && <td className="text-center p-2 bg-red-50/50">—</td>}
                  {flujo.map((d) => (
                    <FlowCell
                      key={d.fecha}
                      value={d.egreso_real}
                      items={d.items.filter(i => i.tipo === 'egreso_real')}
                      bgStyle={d.egreso_real > 0 ? { backgroundColor: FLOW_COLORS.egreso_real + '10' } : {}}
                    />
                  ))}
                </tr>

                {/* Egresos estimados */}
                <tr className="border-b border-dashed">
                  <td className="p-2 sticky left-0 bg-card">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border border-dashed" style={{ borderColor: FLOW_COLORS.egreso_estimado, color: FLOW_COLORS.egreso_real, backgroundColor: FLOW_COLORS.egreso_estimado + '30' }}>
                      - Egresos est.
                    </span>
                  </td>
                  {overdue.items.length > 0 && (
                    <FlowCell
                      value={overdue.total}
                      items={overdue.items}
                      bgStyle={{ backgroundColor: '#dc262620' }}
                      className="bg-red-50"
                    />
                  )}
                  {flujo.map((d) => (
                    <FlowCell
                      key={d.fecha}
                      value={d.egreso_estimado}
                      items={d.items.filter(i => i.tipo === 'egreso_estimado')}
                      bgStyle={d.egreso_estimado > 0 ? { backgroundColor: FLOW_COLORS.egreso_estimado + '40', borderStyle: 'dashed' } : {}}
                    />
                  ))}
                </tr>

                {/* Saldo final */}
                <tr className="font-bold">
                  <td className="p-2 sticky left-0 bg-card">= Saldo final</td>
                  {overdue.items.length > 0 && (
                    <td className="text-center p-2 bg-red-50 text-red-700 font-bold">
                      -{formatMXN(overdue.total)}
                    </td>
                  )}
                  {flujo.map((d) => (
                    <td
                      key={d.fecha}
                      className="text-center p-2"
                      style={{
                        color: d.saldo_final >= 0 ? FLOW_COLORS.saldo_positivo : FLOW_COLORS.saldo_negativo,
                        backgroundColor: d.saldo_final < 0 ? '#dc262615' : undefined,
                      }}
                    >
                      {formatMXN(d.saldo_final)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Proyección gráfica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatMXN(Math.abs(Number(value)))} />
                <Legend />
                <Bar dataKey="Ingreso real" stackId="positive" fill={FLOW_COLORS.ingreso_real} />
                <Bar dataKey="Ingreso est." stackId="positive" fill={FLOW_COLORS.ingreso_estimado} />
                <Bar dataKey="Egreso real" stackId="negative" fill={FLOW_COLORS.egreso_real} />
                <Bar dataKey="Egreso est." stackId="negative" fill={FLOW_COLORS.egreso_estimado} />
                <Line type="monotone" dataKey="Saldo" stroke={FLOW_COLORS.saldo_positivo} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
