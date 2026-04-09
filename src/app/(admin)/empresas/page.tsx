'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import type { Empresa } from '@/lib/types'
import { Settings, Plus, Eye, EyeOff, Pencil, Save, X } from 'lucide-react'

export default function EmpresasPage() {
  const { userRole } = useEmpresa()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [rfcEmpresa, setRfcEmpresa] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editRfc, setEditRfc] = useState('')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('empresas').select('*').order('nombre')
    setEmpresas(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (userRole !== 'admin') {
    return <p className="text-muted-foreground">No tienes permiso para acceder a esta página.</p>
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { error } = await supabase.from('empresas').insert({
      nombre,
      rfc_empresa: rfcEmpresa || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Empresa creada')
    setNombre(''); setRfcEmpresa(''); setShowForm(false)
    loadData()
  }

  async function toggleActiva(id: string, activa: boolean) {
    const supabase = createClient()
    await supabase.from('empresas').update({ activa: !activa }).eq('id', id)
    loadData()
  }

  function startEdit(e: Empresa) {
    setEditingId(e.id)
    setEditNombre(e.nombre)
    setEditRfc(e.rfc_empresa || '')
  }

  async function saveEdit() {
    if (!editingId || !editNombre.trim()) { toast.error('El nombre es requerido'); return }
    const supabase = createClient()
    const { error } = await supabase.from('empresas').update({
      nombre: editNombre.trim(),
      rfc_empresa: editRfc.trim() || null,
    }).eq('id', editingId)
    if (error) { toast.error(error.message); return }
    toast.success('Empresa actualizada')
    setEditingId(null)
    loadData()
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6" /> Empresas</h1>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" /> Nueva empresa</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nueva empresa</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>RFC empresa</Label>
                <Input value={rfcEmpresa} onChange={(e) => setRfcEmpresa(e.target.value)} className="uppercase" />
              </div>
              <div className="md:col-span-2"><Button type="submit">Crear empresa</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>RFC</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    {editingId === e.id ? (
                      <Input value={editNombre} onChange={(ev) => setEditNombre(ev.target.value)} className="h-8 w-full" />
                    ) : (
                      <span className="font-medium">{e.nombre}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === e.id ? (
                      <Input value={editRfc} onChange={(ev) => setEditRfc(ev.target.value)} className="h-8 w-full uppercase" placeholder="RFC" />
                    ) : (
                      <span className="font-mono text-sm">{e.rfc_empresa || '—'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.activa ? 'default' : 'secondary'}>{e.activa ? 'Activa' : 'Inactiva'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString('es-MX')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {editingId === e.id ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={saveEdit} title="Guardar">
                            <Save className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} title="Cancelar">
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => startEdit(e)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleActiva(e.id, e.activa)} title={e.activa ? 'Desactivar' : 'Activar'}>
                            {e.activa ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {empresas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay empresas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
