'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import type { Sucursal } from '@/lib/types'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { Store, Plus, Pencil, Save, X, Trash2, RotateCcw } from 'lucide-react'

export default function SucursalesPage() {
  const { empresaId, userRole } = useEmpresa()
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [inactivas, setInactivas] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [newNombre, setNewNombre] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const [{ data: activas }, { data: inact }] = await Promise.all([
      supabase.from('sucursales').select('*').eq('empresa_id', empresaId).eq('activa', true).order('nombre'),
      supabase.from('sucursales').select('*').eq('empresa_id', empresaId).eq('activa', false).order('nombre'),
    ])
    setSucursales(activas || [])
    setInactivas(inact || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  async function addSucursal(e: React.FormEvent) {
    e.preventDefault()
    const nombre = newNombre.trim()
    if (!nombre) { toast.error('Escribe un nombre'); return }
    const supabase = createClient()
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
      if (error) { toast.error(error.message); return }
      toast.success(`Sucursal "${nombre}" creada`)
    }
    setNewNombre('')
    loadData()
  }

  async function saveName(id: string) {
    const nombre = editNombre.trim()
    if (!nombre) { toast.error('Nombre requerido'); return }
    const supabase = createClient()
    const { error } = await supabase.from('sucursales').update({ nombre }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Nombre actualizado')
    setEditingId(null)
    loadData()
  }

  async function deactivate(id: string) {
    const supabase = createClient()
    await supabase.from('sucursales').update({ activa: false }).eq('id', id)
    toast.success('Sucursal desactivada')
    loadData()
  }

  async function reactivate(id: string) {
    const supabase = createClient()
    await supabase.from('sucursales').update({ activa: true }).eq('id', id)
    toast.success('Sucursal reactivada')
    loadData()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6" /> Sucursales</h1>
      </div>

      {userRole !== 'viewer' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nueva sucursal</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addSucursal} className="flex gap-3">
              <Input
                placeholder="Nombre de la sucursal..."
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="flex-1"
              />
              <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Sucursales activas ({sucursales.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sucursales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {editingId === s.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="h-8 w-[250px]"
                          onKeyDown={(e) => { if (e.key === 'Enter') saveName(s.id) }}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => saveName(s.id)}><Save className="h-4 w-4 text-green-600" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <span className="font-medium">{s.nombre}</span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="bg-green-50 text-green-700">Activa</Badge></TableCell>
                  <TableCell>
                    {userRole !== 'viewer' && editingId !== s.id && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingId(s.id); setEditNombre(s.nombre) }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deactivate(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {sucursales.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No hay sucursales</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {inactivas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base text-muted-foreground">Sucursales inactivas ({inactivas.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {inactivas.map((s) => (
                  <TableRow key={s.id} className="opacity-60">
                    <TableCell className="font-medium">{s.nombre}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-gray-50 text-gray-500">Inactiva</Badge></TableCell>
                    <TableCell>
                      {userRole !== 'viewer' && (
                        <Button variant="ghost" size="sm" onClick={() => reactivate(s.id)} title="Reactivar">
                          <RotateCcw className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
