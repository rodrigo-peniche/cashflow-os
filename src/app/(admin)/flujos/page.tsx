'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { MoneyInput } from '@/components/shared/money-input'
import { BankAccountSelect } from '@/components/shared/bank-account-select'
import { FlowBadge } from '@/components/shared/flow-badge'
import { formatMXN } from '@/lib/constants'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { FlujoTentativo } from '@/lib/types'
import { ExcelImport } from '@/components/shared/excel-import'
import { ExportButton } from '@/components/shared/export-button'
import { TrendingUpDown, Plus, Trash2 } from 'lucide-react'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { useTableSort } from '@/lib/hooks/use-table-sort'
import { SortableHeader } from '@/components/shared/sortable-header'

export default function FlujosPage() {
  const { empresaId, userRole } = useEmpresa()
  const [flujos, setFlujos] = useState<FlujoTentativo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [fecha, setFecha] = useState('')
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState(0)
  const [probabilidad, setProbabilidad] = useState(100)
  const [cuentaId, setCuentaId] = useState('')
  const [realizado, setRealizado] = useState(false)
  const [montoReal, setMontoReal] = useState(0)
  const [notas, setNotas] = useState('')

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('flujos_tentativos')
      .select('*, cuentas_bancarias(nombre)')
      .eq('empresa_id', empresaId)
      .order('fecha')
    setFlujos(data || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  function resetForm() {
    setFecha(''); setTipo('ingreso'); setDescripcion(''); setMonto(0)
    setProbabilidad(100); setCuentaId(''); setRealizado(false); setMontoReal(0); setNotas('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { error } = await supabase.from('flujos_tentativos').insert({
      empresa_id: empresaId,
      fecha, tipo, descripcion, monto, probabilidad,
      cuenta_id: cuentaId || null,
      realizado,
      monto_real: realizado ? montoReal : null,
      notas: notas || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Flujo registrado')
    resetForm(); setShowForm(false); loadData()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('flujos_tentativos').delete().eq('id', id)
    toast.success('Flujo eliminado')
    loadData()
  }

  const { sortKey, sortDir, handleSort, sortData } = useTableSort(flujos)

  if (loading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>

  const sorted = sortData({
    fecha: (f) => f.fecha,
    tipo: (f) => f.tipo,
    descripcion: (f) => f.descripcion,
    monto: (f) => f.monto,
    probabilidad: (f) => f.probabilidad,
  })

  const exportData = sorted.map(f => ({
    'Fecha': f.fecha,
    'Tipo': f.tipo,
    'Descripción': f.descripcion,
    'Monto': f.monto,
    'Probabilidad': f.probabilidad + '%',
    'Realizado': f.realizado ? 'Sí' : 'No',
    'Monto Real': f.monto_real || '',
    'Notas': f.notas || '',
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUpDown className="h-6 w-6" /> Flujos Tentativos</h1>
        <div className="flex gap-2">
          <ExportButton data={exportData} filename="flujos_tentativos" sheetName="Flujos" />
          {userRole !== 'viewer' && (
            <>
              <ExcelImport
                templateKey="flujos"
                onSuccess={loadData}
                transformRows={async (rows) => {
                  const supabase = createClient()
                  const { data: ctas } = await supabase.from('cuentas_bancarias').select('id, nombre').eq('empresa_id', empresaId)
                  const ctaMap = new Map((ctas || []).map((c) => [c.nombre.toUpperCase(), c.id]))
                  return rows.map((row) => ({
                    empresa_id: empresaId,
                    fecha: row.fecha,
                    tipo: row.tipo,
                    descripcion: row.descripcion,
                    monto: row.monto,
                    probabilidad: row.probabilidad || 100,
                    cuenta_id: ctaMap.get(String(row._nombre_cuenta || '').toUpperCase()) || null,
                    notas: row.notas || null,
                  }))
                }}
              />
              <Button onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-2" /> Nuevo flujo
              </Button>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nuevo flujo tentativo</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select value={tipo} onValueChange={(v) => setTipo(v as 'ingreso' | 'egreso')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingreso">Ingreso</SelectItem>
                      <SelectItem value="egreso">Egreso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cuenta bancaria</Label>
                  <BankAccountSelect value={cuentaId} onValueChange={setCuentaId} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción *</Label>
                <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>Monto *</Label>
                <MoneyInput value={monto} onChange={setMonto} />
              </div>

              <div className="space-y-2">
                <Label>Probabilidad: {probabilidad}%</Label>
                <Slider
                  value={[probabilidad]}
                  onValueChange={([v]) => setProbabilidad(v)}
                  min={0} max={100} step={5}
                />
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  checked={realizado}
                  onCheckedChange={(v) => setRealizado(v === true)}
                  id="realizado"
                />
                <Label htmlFor="realizado">Ya realizado</Label>
              </div>

              {realizado && (
                <div className="space-y-2">
                  <Label>Monto real</Label>
                  <MoneyInput value={montoReal} onChange={setMontoReal} />
                </div>
              )}

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>

              <Button type="submit">Guardar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader column="fecha" label="Fecha" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="tipo" label="Tipo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="descripcion" label="Descripción" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader column="monto" label="Monto" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortableHeader column="probabilidad" label="Prob." sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-center" />
                <TableHead>Realizado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((f) => {
                const flowType = f.tipo === 'ingreso'
                  ? f.probabilidad === 100 ? 'ingreso_real' : 'ingreso_estimado'
                  : f.probabilidad === 100 ? 'egreso_real' : 'egreso_estimado'
                return (
                  <TableRow key={f.id}>
                    <TableCell>{format(new Date(f.fecha + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell><FlowBadge type={flowType} /></TableCell>
                    <TableCell>{f.descripcion}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMXN(f.realizado && f.monto_real ? f.monto_real : f.monto)}
                    </TableCell>
                    <TableCell className="text-center">{f.probabilidad}%</TableCell>
                    <TableCell>{f.realizado ? '✓' : '—'}</TableCell>
                    <TableCell>
                      {userRole !== 'viewer' && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(f.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {flujos.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay flujos tentativos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
