'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { MoneyInput } from '@/components/shared/money-input'
import { formatMXN } from '@/lib/constants'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { OrdenCompra } from '@/lib/types'
import { ExcelImport } from '@/components/shared/excel-import'
import { FileText, Plus } from 'lucide-react'
import { useEmpresa } from '@/lib/contexts/empresa-context'

const STATUS_COLORS: Record<string, string> = {
  abierta: 'bg-blue-100 text-blue-800',
  recibida: 'bg-green-100 text-green-800',
  pagada: 'bg-gray-100 text-gray-800',
  cancelada: 'bg-red-100 text-red-800',
}

export default function OrdenesPage() {
  const { empresaId, userRole } = useEmpresa()
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [proveedores, setProveedores] = useState<{ id: string; nombre_empresa: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [numeroOc, setNumeroOc] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [montoTotal, setMontoTotal] = useState(0)
  const [fechaEmision, setFechaEmision] = useState('')
  const [fechaEsperada, setFechaEsperada] = useState('')

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const [{ data: ocs }, { data: provs }] = await Promise.all([
      supabase.from('ordenes_compra').select('*, proveedores(nombre_empresa)').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      supabase.from('proveedores').select('id, nombre_empresa').eq('empresa_id', empresaId).eq('activo', true).order('nombre_empresa'),
    ])
    setOrdenes(ocs || [])
    setProveedores(provs || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { error } = await supabase.from('ordenes_compra').insert({
      numero_oc: numeroOc,
      proveedor_id: proveedorId,
      descripcion: descripcion || null,
      monto_total: montoTotal,
      fecha_emision: fechaEmision,
      fecha_esperada_entrega: fechaEsperada || null,
      empresa_id: empresaId,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Orden de compra creada')
    setShowForm(false); loadData()
  }

  async function updateEstatus(id: string, estatus: string) {
    const supabase = createClient()
    await supabase.from('ordenes_compra').update({ estatus }).eq('id', id)
    loadData()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Órdenes de Compra</h1>
        {userRole !== 'viewer' && (
          <div className="flex gap-2">
            <ExcelImport
              templateKey="ordenes"
              onSuccess={loadData}
              transformRows={async (rows) => {
                const supabase = createClient()
                const { data: provs } = await supabase.from('proveedores').select('id, rfc').eq('empresa_id', empresaId)
                const rfcMap = new Map((provs || []).map((p) => [p.rfc.toUpperCase(), p.id]))
                return rows.map((row) => {
                  const rfc = String(row._rfc_proveedor || '').toUpperCase()
                  return {
                    numero_oc: row.numero_oc,
                    proveedor_id: rfcMap.get(rfc) || null,
                    descripcion: row.descripcion || null,
                    monto_total: row.monto_total,
                    fecha_emision: row.fecha_emision,
                    fecha_esperada_entrega: row.fecha_esperada_entrega || null,
                    empresa_id: empresaId,
                  }
                })
              }}
            />
            <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" /> Nueva OC</Button>
          </div>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nueva orden de compra</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Número OC *</Label><Input value={numeroOc} onChange={(e) => setNumeroOc(e.target.value)} required /></div>
              <div className="space-y-2">
                <Label>Proveedor *</Label>
                <Select value={proveedorId} onValueChange={setProveedorId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre_empresa}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Monto total *</Label><MoneyInput value={montoTotal} onChange={setMontoTotal} /></div>
              <div className="space-y-2"><Label>Fecha emisión *</Label><Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Fecha esperada entrega</Label><Input type="date" value={fechaEsperada} onChange={(e) => setFechaEsperada(e.target.value)} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Descripción</Label><Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
              <div className="md:col-span-2"><Button type="submit">Crear OC</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead># OC</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Estatus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenes.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.numero_oc}</TableCell>
                  <TableCell>{(o as unknown as Record<string, Record<string, string>>).proveedores?.nombre_empresa || '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{o.descripcion || '—'}</TableCell>
                  <TableCell className="text-right font-medium">{formatMXN(o.monto_total)}</TableCell>
                  <TableCell>{format(new Date(o.fecha_emision + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    {userRole === 'viewer' ? (
                      <Badge variant="outline" className={STATUS_COLORS[o.estatus]}>
                        {o.estatus.charAt(0).toUpperCase() + o.estatus.slice(1)}
                      </Badge>
                    ) : (
                      <Select value={o.estatus} onValueChange={(v) => updateEstatus(o.id, v)}>
                        <SelectTrigger className="w-[130px] h-8">
                          <Badge variant="outline" className={STATUS_COLORS[o.estatus]}>
                            {o.estatus.charAt(0).toUpperCase() + o.estatus.slice(1)}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {['abierta', 'recibida', 'pagada', 'cancelada'].map((s) => (
                            <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {ordenes.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay órdenes de compra</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
