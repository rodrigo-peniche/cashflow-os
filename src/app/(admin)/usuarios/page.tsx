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
import { toast } from 'sonner'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import type { Empresa, UsuarioEmpresa } from '@/lib/types'
import { UserCog, Plus, Trash2 } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  editor: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-800',
}

export default function UsuariosPage() {
  const { userRole } = useEmpresa()
  const [usuarios, setUsuarios] = useState<(UsuarioEmpresa & { email?: string })[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [rol, setRol] = useState('viewer')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: uData }, { data: eData }] = await Promise.all([
      supabase.from('usuario_empresas').select('*, empresas(nombre)').order('created_at', { ascending: false }),
      supabase.from('empresas').select('*').eq('activa', true).order('nombre'),
    ])
    setUsuarios(uData || [])
    setEmpresas(eData || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (userRole !== 'admin') {
    return <p className="text-muted-foreground">No tienes permiso para acceder a esta página.</p>
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, empresa_id: empresaId, rol }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Usuario creado y asignado')
      setEmail(''); setPassword(''); setEmpresaId(''); setRol('viewer'); setShowForm(false)
      loadData()
    } catch {
      toast.error('Error al crear usuario')
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch('/api/usuarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) { toast.error('Error al eliminar'); return }
      toast.success('Acceso eliminado')
      loadData()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserCog className="h-6 w-6" /> Usuarios</h1>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" /> Nuevo usuario</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Crear usuario y asignar empresa</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Contraseña *</Label>
                <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
              </div>
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rol *</Label>
                <Select value={rol} onValueChange={setRol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — acceso total</SelectItem>
                    <SelectItem value="editor">Editor — puede editar datos</SelectItem>
                    <SelectItem value="viewer">Viewer — solo lectura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2"><Button type="submit">Crear y asignar</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Asignado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.user_id.slice(0, 8)}...</TableCell>
                  <TableCell className="font-medium">
                    {(u as unknown as Record<string, Record<string, string>>).empresas?.nombre || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ROLE_COLORS[u.rol]}>{u.rol}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString('es-MX')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {usuarios.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay usuarios asignados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
