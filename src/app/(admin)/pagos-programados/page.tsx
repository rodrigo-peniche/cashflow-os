'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { MoneyInput } from '@/components/shared/money-input'
import { BankAccountSelect } from '@/components/shared/bank-account-select'
import { formatMXN, CATEGORIAS_PAGO, FRECUENCIAS } from '@/lib/constants'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { PagoProgramado } from '@/lib/types'
import { ExcelImport } from '@/components/shared/excel-import'
import { ExportButton } from '@/components/shared/export-button'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import type { Proveedor } from '@/lib/types'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { useTableSort } from '@/lib/hooks/use-table-sort'
import { SortableHeader } from '@/components/shared/sortable-header'

export default function PagosProgramadosPage() {
  const { empresaId, userRole } = useEmpresa()
  const [pagos, setPagos] = useState<PagoProgramado[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('')
  const [esFijo, setEsFijo] = useState(true)
  const [monto, setMonto] = useState(0)
  const [montoMin, setMontoMin] = useState(0)
  const [montoMax, setMontoMax] = useState(0)
  const [frecuencia, setFrecuencia] = useState('')
  const [diaMes, setDiaMes] = useState<number | undefined>()
  const [proximaFecha, setProximaFecha] = useState('')
  const [cuentaId, setCuentaId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [notas, setNotas] = useState('')

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const [{ data }, { data: provs }] = await Promise.all([
      supabase
        .from('pagos_programados')
        .select('*, cuentas_bancarias(nombre, banco), proveedores(id, nombre_empresa)')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('proxima_fecha'),
      supabase
        .from('proveedores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre_empresa'),
    ])
    setPagos(data || [])
    setProveedores(provs || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  function resetForm() {
    setNombre(''); setCategoria(''); setEsFijo(true); setMonto(0)
    setMontoMin(0); setMontoMax(0); setFrecuencia(''); setDiaMes(undefined)
    setProximaFecha(''); setCuentaId(''); setProveedorId(''); setNotas('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { error } = await supabase.from('pagos_programados').insert({
      empresa_id: empresaId,
      nombre,
      categoria,
      es_fijo: esFijo,
      monto: esFijo ? monto : null,
      monto_minimo: !esFijo ? montoMin : null,
      monto_maximo: !esFijo ? montoMax : null,
      frecuencia,
      dia_del_mes: diaMes || null,
      proxima_fecha: proximaFecha,
      cuenta_id: cuentaId || null,
      proveedor_id: proveedorId && proveedorId !== 'none' ? proveedorId : null,
      notas: notas || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Pago programado creado')
    resetForm(); setShowForm(false); loadData()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('pagos_programados').update({ activo: false }).eq('id', id)
    toast.success('Pago desactivado')
    loadData()
  }

  const catColors: Record<string, string> = {
    nomina: 'bg-blue-100 text-blue-800',
    renta: 'bg-purple-100 text-purple-800',
    servicios: 'bg-orange-100 text-orange-800',
    impuestos: 'bg-red-100 text-red-800',
    otro: 'bg-gray-100 text-gray-800',
  }

  const { sortKey, sortDir, handleSort, sortData } = useTableSort(pagos)

  if (loading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>

  const sorted = sortData({
    nombre: (p) => p.nombre,
    categoria: (p) => p.categoria,
    frecuencia: (p) => p.frecuencia,
    monto: (p) => p.monto || 0,
    proxima_fecha: (p) => p.proxima_fecha,
  })

  const exportData = sorted.map(p => ({
    'Nombre': p.nombre,
    'Categoría': p.categoria,
    'Frecuencia': p.frecuencia,
    'Fijo': p.es_fijo ? 'Sí' : 'No',
    'Monto': p.monto || '',
    'Monto Mínimo': p.monto_minimo || '',
    'Monto Máximo': p.monto_maximo || '',
    'Próxima Fecha': p.proxima_fecha,
    'Notas': p.notas || '',
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock className="h-6 w-6" /> Pagos Programados</h1>
        <div className="flex gap-2">
          <ExportButton data={exportData} filename="pagos_programados" sheetName="Pagos" />
          {userRole !== 'viewer' && (
            <>
              <ExcelImport
                templateKey="pagos_programados"
                onSuccess={loadData}
                transformRows={async (rows) => {
                  const supabase = createClient()
                  const { data: ctas } = await supabase.from('cuentas_bancarias').select('id, nombre').eq('empresa_id', empresaId)
                  const ctaMap = new Map((ctas || []).map((c) => [c.nombre.toUpperCase(), c.id]))
                  return rows.map((row) => ({
                    empresa_id: empresaId,
                    nombre: row.nombre,
                    categoria: row.categoria,
                    es_fijo: String(row.es_fijo).toUpperCase() === 'SI',
                    monto: row.monto || null,
                    monto_minimo: row.monto_minimo || null,
                    monto_maximo: row.monto_maximo || null,
                    frecuencia: row.frecuencia,
                    dia_del_mes: row.dia_del_mes || null,
                    proxima_fecha: row.proxima_fecha,
                    cuenta_id: ctaMap.get(String(row._nombre_cuenta || '').toUpperCase()) || null,
                    notas: row.notas || null,
                  }))
                }}
              />
              <Button onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-2" /> Nuevo pago
              </Button>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nuevo pago programado</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Categoría *</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_PAGO.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label>Monto fijo</Label>
                <Switch checked={esFijo} onCheckedChange={setEsFijo} />
                <span className="text-sm text-muted-foreground">{esFijo ? 'Fijo' : 'Aproximado'}</span>
              </div>

              {esFijo ? (
                <div className="space-y-2">
                  <Label>Monto *</Label>
                  <MoneyInput value={monto} onChange={setMonto} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monto mínimo</Label>
                    <MoneyInput value={montoMin} onChange={setMontoMin} />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto máximo</Label>
                    <MoneyInput value={montoMax} onChange={setMontoMax} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Frecuencia *</Label>
                  <Select value={frecuencia} onValueChange={setFrecuencia}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {FRECUENCIAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Próxima fecha *</Label>
                  <Input type="date" value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select value={proveedorId} onValueChange={setProveedorId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar proveedor..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin proveedor</SelectItem>
                      {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre_empresa}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cuenta bancaria</Label>
                  <BankAccountSelect value={cuentaId} onValueChange={setCuentaId} />
                </div>
              </div>

              {frecuencia === 'mensual' && (
                <div className="space-y-2">
                  <Label>Día del mes</Label>
                  <Input type="number" min={1} max={31} value={diaMes || ''} onChange={(e) => setDiaMes(Number(e.target.value))} />
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
                <SortableHeader label="Nombre" column="nombre" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Categoría" column="categoria" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Frecuencia" column="frecuencia" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Monto" column="monto" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortableHeader label="Próxima fecha" column="proxima_fecha" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <TableHead>Proveedor</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={catColors[p.categoria]}>
                      {CATEGORIAS_PAGO.find(c => c.value === p.categoria)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{FRECUENCIAS.find(f => f.value === p.frecuencia)?.label}</TableCell>
                  <TableCell className="text-right font-medium">
                    {p.es_fijo
                      ? formatMXN(p.monto || 0)
                      : `${formatMXN(p.monto_minimo || 0)} - ${formatMXN(p.monto_maximo || 0)}`}
                  </TableCell>
                  <TableCell>{format(new Date(p.proxima_fecha + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(p as unknown as Record<string, Record<string, string>>).proveedores?.nombre_empresa || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(p as unknown as Record<string, Record<string, string>>).cuentas_bancarias?.nombre || '—'}
                  </TableCell>
                  <TableCell>
                    {userRole !== 'viewer' && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {pagos.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay pagos programados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
