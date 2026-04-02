'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatMXN, FLOW_COLORS } from '@/lib/constants'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart,
} from 'recharts'
import type { FlujoDiario } from '@/lib/types'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'

export default function DashboardPage() {
  const [flujo, setFlujo] = useState<FlujoDiario[]>([])
  const [loading, setLoading] = useState(true)
  const { empresaId } = useEmpresa()

  useEffect(() => {
    if (!empresaId) return
    fetch('/api/flujo', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFlujo(data)
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

  // Upcoming items for next 5 days
  const upcomingItems = flujo
    .slice(0, 5)
    .flatMap((d) =>
      d.items.map((item) => ({
        ...item,
        fecha: d.fecha,
      }))
    )
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard — Flujo de Efectivo 15 Días</h1>

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content - 3 cols */}
        <div className="lg:col-span-3 space-y-6">
          {/* 15-day flow table */}
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
                      {flujo.map((d) => (
                        <td
                          key={d.fecha}
                          className="text-center p-2 text-sm"
                          style={d.ingreso_real > 0 ? { backgroundColor: FLOW_COLORS.ingreso_real + '15' } : {}}
                        >
                          {d.ingreso_real > 0 ? formatMXN(d.ingreso_real) : '—'}
                        </td>
                      ))}
                    </tr>

                    {/* Ingresos estimados */}
                    <tr className="border-b border-dashed">
                      <td className="p-2 sticky left-0 bg-card">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border border-dashed" style={{ borderColor: FLOW_COLORS.ingreso_estimado, color: '#16a34a', backgroundColor: FLOW_COLORS.ingreso_estimado + '30' }}>
                          + Ingresos est.
                        </span>
                      </td>
                      {flujo.map((d) => (
                        <td
                          key={d.fecha}
                          className="text-center p-2 text-sm"
                          style={d.ingreso_estimado > 0 ? { backgroundColor: FLOW_COLORS.ingreso_estimado + '30', borderStyle: 'dashed' } : {}}
                        >
                          {d.ingreso_estimado > 0 ? formatMXN(d.ingreso_estimado) : '—'}
                        </td>
                      ))}
                    </tr>

                    {/* Egresos reales */}
                    <tr className="border-b">
                      <td className="p-2 sticky left-0 bg-card">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: FLOW_COLORS.egreso_real + '15', color: FLOW_COLORS.egreso_real }}>
                          - Egresos prog.
                        </span>
                      </td>
                      {flujo.map((d) => (
                        <td
                          key={d.fecha}
                          className="text-center p-2 text-sm"
                          style={d.egreso_real > 0 ? { backgroundColor: FLOW_COLORS.egreso_real + '10' } : {}}
                        >
                          {d.egreso_real > 0 ? formatMXN(d.egreso_real) : '—'}
                        </td>
                      ))}
                    </tr>

                    {/* Egresos estimados */}
                    <tr className="border-b border-dashed">
                      <td className="p-2 sticky left-0 bg-card">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium border border-dashed" style={{ borderColor: FLOW_COLORS.egreso_estimado, color: FLOW_COLORS.egreso_real, backgroundColor: FLOW_COLORS.egreso_estimado + '30' }}>
                          - Egresos est.
                        </span>
                      </td>
                      {flujo.map((d) => (
                        <td
                          key={d.fecha}
                          className="text-center p-2 text-sm"
                          style={d.egreso_estimado > 0 ? { backgroundColor: FLOW_COLORS.egreso_estimado + '40', borderStyle: 'dashed' } : {}}
                        >
                          {d.egreso_estimado > 0 ? formatMXN(d.egreso_estimado) : '—'}
                        </td>
                      ))}
                    </tr>

                    {/* Saldo final */}
                    <tr className="font-bold">
                      <td className="p-2 sticky left-0 bg-card">= Saldo final</td>
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

        {/* Sidebar - upcoming payments */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Próximos 5 días</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin movimientos próximos</p>
              ) : (
                upcomingItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded-md border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.descripcion}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(item.fecha), "dd 'de' MMM", { locale: es })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium" style={{
                        color: item.tipo.includes('ingreso') ? FLOW_COLORS.ingreso_real : FLOW_COLORS.egreso_real
                      }}>
                        {item.tipo.includes('ingreso') ? '+' : '-'}{formatMXN(item.monto)}
                      </p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {item.origen === 'factura' ? 'Factura' :
                         item.origen === 'pago_programado' ? 'Pago prog.' : 'Tentativo'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
