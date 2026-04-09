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
import type { Socio, GastoPersonal } from '@/lib/types'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { ExportButton } from '@/components/shared/export-button'
import { SortableHeader } from '@/components/shared/sortable-header'
import { CreditCard, Plus, Check } from 'lucide-react'

const CATEGORIAS = [
  { value: 'comida', label: 'Comida', color: 'bg-orange-100 text-orange-800' },
  { value: 'transporte', label: 'Transporte', color: 'bg-blue-100 text-blue-800' },
  { value: 'entretenimiento', label: 'Entretenimiento', color: 'bg-pink-100 text-pink-800' },
  { value: 'compras', label: 'Compras', color: 'bg-purple-100 text-purple-800' },
  { value: 'servicios', label: 'Servicios', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'otro', label: 'Otro', color: 'bg-gray-100 text-gray-800' },
]

export default function GastosTarjetaPage() {
  const { empresaId, userRole } = useEmpresa()
  const [socios, setSocios] = useState<Socio[]>([])
  const [gastos, setGastos] = useState<GastoPersonal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterSocio, setFilterSocio] = useState('todos')
  const [filterEstatus, setFilterEstatus] = useState('todos')
  const [filterMes, setFilterMes] = useState(format(new Date(), 'yyyy-MM'))
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Form
  const [formSocio, setFormSocio] = useState('')
  const [formMonto, setFormMonto] = useState('')
  const [formFecha, setFormFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formDesc, setFormDesc] = useState('')
  const [formCat, setFormCat] = useState('otro')
  const [formNotas, setFormNotas] = useState('')

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const [sociosRes, gastosRes] = await Promise.all([
      supabase.from('socios').select('*').eq('empresa_id', empresaId).eq('activo', true).order('nombre'),
      supabase.from('gastos_personales').select('*, socios(nombre)').eq('empresa_id', empresaId).order('fecha', { ascending: false }),
    ])
    setSocios(sociosRes.data || [])
    setGastos(gastosRes.data || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir('asc') }
    } else { setSortKey(key); setSortDir('asc') }
  }

  async function addGasto(e: React.FormEvent) {
    e.preventDefault()
    if (!formSocio || !formMonto || !formFecha || !formDesc.trim()) {
      toast.error('Socio, monto, fecha y descripción son requeridos')
      return
    }
    const mesDescuento = formFecha.slice(0, 7) // same month as expense
    const supabase = createClient()
    const { error } = await supabase.from('gastos_personales').insert({
      empresa_id: empresaId,
      socio_id: formSocio,
      monto: Number(formMonto),
      fecha: formFecha,
      descripcion: formDesc.trim(),
      categoria: formCat,
      estatus: 'pendiente',
      mes_descuento: mesDescuento,
      notas: formNotas.trim() || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Gasto registrado')
    setFormSocio('')
    setFormMonto('')
    setFormDesc('')
    setFormCat('otro')
    setFormNotas('')
    setShowForm(false)
    loadData()
  }

  async function marcarDescontado(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('gastos_personales').update({ estatus: 'descontado' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Marcado como descontado')
    loadData()
  }

  async function marcarTodosMes(socioId: string, mes: string) {
    const supabase = createClient()
    const { error } = await supabase.from('gastos_personales')
      .update({ estatus: 'descontado' })
      .eq('empresa_id', empresaId)
      .eq('socio_id', socioId)
      .eq('mes_descuento', mes)
      .eq('estatus', 'pendiente')
    if (error) { toast.error(error.message); return }
    toast.success('Gastos del mes marcados como descontados')
    loadData()
  }

  function getSocioNombre(g: GastoPersonal): string {
    return (g as unknown as Record<string, Record<string, string>>).socios?.nombre || ''
  }

  // Filter by month
  let filtered = gastos.filter(g => {
    if (filterSocio !== 'todos' && g.socio_id !== filterSocio) return false
    if (filterEstatus !== 'todos' && g.estatus !== filterEstatus) return false
    if (filterMes && g.fecha.slice(0, 7) !== filterMes) return false
    return true
  })

  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'socio': cmp = getSocioNombre(a).localeCompare(getSocioNombre(b)); break
        case 'monto': cmp = a.monto - b.monto; break
        case 'fecha': cmp = a.fecha.localeCompare(b.fecha); break
        case 'categoria': cmp = a.categoria.localeCompare(b.categoria); break
        case 'estatus': cmp = a.estatus.localeCompare(b.estatus); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }

  // Per-socio summary for selected month
  const socioSummary = socios.map(s => {
    const socioGastos = gastos.filter(g => g.socio_id === s.id && g.fecha.slice(0, 7) === filterMes)
    return {
      ...s,
      totalMes: socioGastos.reduce((sum, g) => sum + g.monto, 0),
      pendienteMes: socioGastos.filter(g => g.estatus === 'pendiente').reduce((sum, g) => sum + g.monto, 0),
      descontadoMes: socioGastos.filter(g => g.estatus === 'descontado').reduce((sum, g) => sum + g.monto, 0),
      countPendiente: socioGastos.filter(g => g.estatus === 'pendiente').length,
    }
  }).filter(s => s.totalMes > 0)

  const totalPendiente = filtered.filter(g => g.estatus === 'pendiente').reduce((s, g) => s + g.monto, 0)
  const totalDescontado = filtered.filter(g => g.estatus === 'descontado').reduce((s, g) => s + g.monto, 0)

  const exportData = filtered.map(g => ({
    'Socio': getSocioNombre(g),
    'Monto': g.monto,
    'Fecha': g.fecha,
    'Descripción': g.descripcion,
    'Categoría': g.categoria,
    'Estatus': g.estatus,
    'Mes descuento': g.mes_descuento || '',
    'Notas': g.notas || '',
  }))

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Gastos Tarjeta Empresa</h1>
        <div className="flex gap-2">
          <ExportButton data={exportData} filename={`gastos-tarjeta-${filterMes}`} sheetName="Gastos" />
          {userRole !== 'viewer' && (
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo gasto
            </Button>
          )}
        </div>
      </div>

      {/* Month selector and stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <Label className="text-sm text-muted-foreground">Mes</Label>
            <Input type="month" value={filterMes} onChange={e => setFilterMes(e.target.value)} className="mt-1" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pendiente por descontar</p>
            <p className="text-2xl font-bold text-yellow-700">{formatMXN(totalPendiente)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Ya descontado</p>
            <p className="text-2xl font-bold text-green-700">{formatMXN(totalDescontado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total del mes</p>
            <p className="text-2xl font-bold">{formatMXN(totalPendiente + totalDescontado)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-socio monthly summary with "descontar todo" button */}
      {socioSummary.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {socioSummary.map(s => (
            <Card key={s.id} className="flex-1 min-w-[250px]">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{s.nombre}</p>
                    <p className="text-lg font-bold mt-1">{formatMXN(s.totalMes)}</p>
                    <div className="flex gap-3 text-xs mt-0.5">
                      {s.pendienteMes > 0 && <span className="text-yellow-700">Pendiente: {formatMXN(s.pendienteMes)}</span>}
                      {s.descontadoMes > 0 && <span className="text-green-700">Descontado: {formatMXN(s.descontadoMes)}</span>}
                    </div>
                  </div>
                  {userRole !== 'viewer' && s.countPendiente > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => marcarTodosMes(s.id, filterMes)}
                      className="text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" /> Descontar todo
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add gasto form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nuevo gasto personal</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addGasto} className="space-y-3">
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
                  <Label className="text-sm">Categoría</Label>
                  <Select value={formCat} onValueChange={setFormCat}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Descripción *</Label>
                  <Input placeholder="Qué se compró..." value={formDesc} onChange={e => setFormDesc(e.target.value)} required />
                </div>
              </div>
              <div className="flex gap-3">
                <Input placeholder="Notas (opcional)" value={formNotas} onChange={e => setFormNotas(e.target.value)} className="flex-1" />
                <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Registrar</Button>
              </div>
            </form>
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
            <SelectItem value="descontado">Descontado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader label="Socio" column="socio" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Monto" column="monto" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortableHeader label="Fecha" column="fecha" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <TableHead>Descripción</TableHead>
                <SortableHeader label="Categoría" column="categoria" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Estatus" column="estatus" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(g => {
                const catInfo = CATEGORIAS.find(c => c.value === g.categoria)
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{getSocioNombre(g)}</TableCell>
                    <TableCell className="text-right font-medium">{formatMXN(g.monto)}</TableCell>
                    <TableCell>{format(new Date(g.fecha + 'T12:00:00'), 'dd/MM/yy')}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{g.descripcion}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={catInfo?.color}>{catInfo?.label || g.categoria}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={g.estatus === 'pendiente' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                        {g.estatus === 'pendiente' ? 'Pendiente' : 'Descontado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {userRole !== 'viewer' && g.estatus === 'pendiente' && (
                        <Button variant="ghost" size="sm" onClick={() => marcarDescontado(g.id)} title="Marcar como descontado">
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay gastos en este periodo</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
