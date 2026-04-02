'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { MoneyInput } from '@/components/shared/money-input'
import { Textarea } from '@/components/ui/textarea'
import { formatMXN, MEXICAN_BANKS } from '@/lib/constants'
import { toast } from 'sonner'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, subDays } from 'date-fns'
import type { CuentaBancaria, SaldoBancario } from '@/lib/types'
import { ExcelImport } from '@/components/shared/excel-import'
import { Building2, Plus } from 'lucide-react'
import { useEmpresa } from '@/lib/contexts/empresa-context'

export default function BancosPage() {
  const { empresaId, userRole } = useEmpresa()
  const [cuentas, setCuentas] = useState<(CuentaBancaria & { ultimo_saldo?: number; fecha_saldo?: string })[]>([])
  const [saldos, setSaldos] = useState<SaldoBancario[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewAccount, setShowNewAccount] = useState(false)

  // New account form
  const [newNombre, setNewNombre] = useState('')
  const [newBanco, setNewBanco] = useState('')
  const [newCuenta, setNewCuenta] = useState('')
  const [newMoneda] = useState('MXN')

  // Balance form
  const [balCuenta, setBalCuenta] = useState('')
  const [balFecha, setBalFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [balMonto, setBalMonto] = useState(0)
  const [balNotas, setBalNotas] = useState('')

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()

    const { data: ctas } = await supabase
      .from('cuentas_bancarias')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nombre')

    if (ctas) {
      // Get latest balance for each account
      const ctasConSaldo = await Promise.all(
        ctas.map(async (c) => {
          const { data: ultimo } = await supabase
            .from('saldos_bancarios')
            .select('saldo, fecha')
            .eq('cuenta_id', c.id)
            .order('fecha', { ascending: false })
            .limit(1)
            .single()
          return { ...c, ultimo_saldo: ultimo?.saldo, fecha_saldo: ultimo?.fecha }
        })
      )
      setCuentas(ctasConSaldo)
    }

    // Get last 30 days of balances for chart
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const { data: saldosData } = await supabase
      .from('saldos_bancarios')
      .select('*, cuentas_bancarias(nombre)')
      .eq('empresa_id', empresaId)
      .gte('fecha', thirtyDaysAgo)
      .order('fecha')

    setSaldos(saldosData || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  async function handleNewAccount(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { error } = await supabase.from('cuentas_bancarias').insert({
      nombre: newNombre, banco: newBanco, cuenta: newCuenta, moneda: newMoneda, empresa_id: empresaId,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Cuenta creada')
    setNewNombre(''); setNewBanco(''); setNewCuenta(''); setShowNewAccount(false)
    loadData()
  }

  async function handleBalance(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { error } = await supabase.from('saldos_bancarios').upsert(
      { cuenta_id: balCuenta, fecha: balFecha, saldo: balMonto, notas: balNotas || null, empresa_id: empresaId },
      { onConflict: 'cuenta_id,fecha' }
    )
    if (error) { toast.error(error.message); return }
    toast.success('Saldo registrado')
    setBalMonto(0); setBalNotas('')
    loadData()
  }

  // Build chart data
  const chartData = (() => {
    const dateMap: Record<string, Record<string, number>> = {}
    const accountNames = new Set<string>()
    saldos.forEach((s) => {
      const name = (s as unknown as Record<string, { nombre?: string }>).cuentas_bancarias?.nombre || 'Cuenta'
      accountNames.add(name)
      if (!dateMap[s.fecha]) dateMap[s.fecha] = {}
      dateMap[s.fecha][name] = s.saldo
    })
    return Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, vals]) => ({ fecha: format(new Date(fecha + 'T12:00:00'), 'dd/MM'), ...vals }))
  })()

  const accountNames = Array.from(new Set(saldos.map((s) => (s as unknown as Record<string, { nombre?: string }>).cuentas_bancarias?.nombre || 'Cuenta')))
  const colors = ['#1d4ed8', '#16a34a', '#dc2626', '#9333ea', '#f59e0b']

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6" /> Cuentas Bancarias</h1>
        {userRole !== 'viewer' && (
          <div className="flex gap-2">
            <ExcelImport templateKey="cuentas_bancarias" onSuccess={loadData} />
            <ExcelImport
              templateKey="saldos"
              onSuccess={loadData}
              transformRows={async (rows) => {
                const supabase = createClient()
                const { data: ctas } = await supabase.from('cuentas_bancarias').select('id, nombre')
                const ctaMap = new Map((ctas || []).map((c) => [c.nombre.toUpperCase(), c.id]))
                return rows.map((row) => {
                  const nombre = String(row._nombre_cuenta || '').toUpperCase()
                  return {
                    cuenta_id: ctaMap.get(nombre) || null,
                    fecha: row.fecha,
                    saldo: row.saldo,
                    notas: row.notas || null,
                  }
                })
              }}
            />
            <Button onClick={() => setShowNewAccount(!showNewAccount)}>
              <Plus className="h-4 w-4 mr-2" /> Nueva cuenta
            </Button>
          </div>
        )}
      </div>

      {showNewAccount && (
        <Card>
          <CardHeader><CardTitle>Nueva cuenta bancaria</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleNewAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={newNombre} onChange={(e) => setNewNombre(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={newBanco} onValueChange={setNewBanco}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {MEXICAN_BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número de cuenta</Label>
                <Input value={newCuenta} onChange={(e) => setNewCuenta(e.target.value)} required />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">Crear</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts table */}
        <Card>
          <CardHeader>
            <CardTitle>Cuentas</CardTitle>
            <CardDescription>{cuentas.length} cuenta(s) registrada(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right">Último saldo</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuentas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell><Badge variant="outline">{c.banco}</Badge></TableCell>
                    <TableCell className="text-right font-medium">
                      {c.ultimo_saldo !== undefined ? formatMXN(c.ultimo_saldo) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.fecha_saldo ? format(new Date(c.fecha_saldo + 'T12:00:00'), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Balance form */}
        {userRole !== 'viewer' && (
          <Card>
            <CardHeader>
              <CardTitle>Registrar saldo</CardTitle>
              <CardDescription>Captura el saldo de una cuenta en una fecha específica</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBalance} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cuenta</Label>
                  <Select value={balCuenta} onValueChange={setBalCuenta}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                    <SelectContent>
                      {cuentas.filter(c => c.activa).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre} — {c.banco}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={balFecha} onChange={(e) => setBalFecha(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Saldo</Label>
                  <MoneyInput value={balMonto} onChange={setBalMonto} />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea value={balNotas} onChange={(e) => setBalNotas(e.target.value)} placeholder="Opcional" />
                </div>
                <Button type="submit" className="w-full" disabled={!balCuenta}>Guardar saldo</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de saldos (últimos 30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatMXN(Number(value))} />
                  <Legend />
                  {accountNames.map((name, i) => (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={colors[i % colors.length]}
                      fill={colors[i % colors.length] + '30'}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
