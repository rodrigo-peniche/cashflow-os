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
import type { Empresa } from '@/lib/types'
import { UserCog, Plus, Trash2, CheckCircle, Clock } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  editor: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-800',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Acceso total: gestionar usuarios, empresas y todos los datos',
  editor: 'Crear y editar datos en todos los módulos',
  viewer: 'Solo lectura en todos los módulos',
}

interface UsuarioEnriched {
  id: string
  user_id: string
  empresa_id: string
  rol: string
  created_at: string
  email: string | null
  nombre: string | null
  last_sign_in: string | null
  empresas?: { nombre: string }
}

export default function UsuariosPage() {
  const { userRole } = useEmpresa()
  const [usuarios, setUsuarios] = useState<UsuarioEnriched[]>([])
  const [socios, setSocios] = useState<{ id: string; nombre: string; email: string | null }[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [formNombre, setFormNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [rol, setRol] = useState('viewer')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [usersRes, empresasRes, sociosRes] = await Promise.all([
      fetch('/api/usuarios', { credentials: 'include' }).then(r => r.json()),
      supabase.from('empresas').select('*').eq('activa', true).order('nombre'),
      supabase.from('socios').select('id, nombre, email').order('nombre'),
    ])
    setUsuarios(Array.isArray(usersRes) ? usersRes : [])
    setEmpresas(empresasRes.data || [])
    setSocios(sociosRes.data || [])
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
        body: JSON.stringify({ email, password, empresa_id: empresaId, rol, nombre: formNombre }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      toast.success('Usuario creado y asignado')
      setFormNombre(''); setEmail(''); setPassword(''); setEmpresaId(''); setRol('viewer'); setShowForm(false)
      loadData()
    } catch {
      toast.error('Error al crear usuario')
    }
  }

  async function handleChangeRole(id: string, newRol: string) {
    try {
      const res = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, rol: newRol }),
      })
      if (!res.ok) { toast.error('Error al cambiar rol'); return }
      toast.success('Rol actualizado')
      loadData()
    } catch {
      toast.error('Error al cambiar rol')
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Nombre completo" />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña *</Label>
                  <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[rol]}</p>
                </div>
              </div>
              <Button type="submit">Crear y asignar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Permissions reference */}
      <Card>
        <CardHeader><CardTitle className="text-base">Permisos por rol</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground">Módulo</th>
                  <th className="text-center p-2"><Badge variant="outline" className={ROLE_COLORS.admin}>Admin</Badge></th>
                  <th className="text-center p-2"><Badge variant="outline" className={ROLE_COLORS.editor}>Editor</Badge></th>
                  <th className="text-center p-2"><Badge variant="outline" className={ROLE_COLORS.viewer}>Viewer</Badge></th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {[
                  { modulo: 'Dashboard', admin: 'Ver', editor: 'Ver', viewer: 'Ver' },
                  { modulo: 'Proveedores', admin: 'Crear/Editar/Eliminar', editor: 'Crear/Editar', viewer: 'Ver' },
                  { modulo: 'Facturas', admin: 'Crear/Editar/Programar', editor: 'Crear/Editar/Programar', viewer: 'Ver' },
                  { modulo: 'Órdenes de compra', admin: 'Crear/Editar', editor: 'Crear/Editar', viewer: 'Ver' },
                  { modulo: 'Bancos', admin: 'Crear/Editar', editor: 'Crear/Editar', viewer: 'Ver' },
                  { modulo: 'Pagos programados', admin: 'Crear/Editar', editor: 'Crear/Editar', viewer: 'Ver' },
                  { modulo: 'Ingresos diarios', admin: 'Registrar/Config', editor: 'Registrar', viewer: 'Ver' },
                  { modulo: 'Flujos tentativos', admin: 'Crear/Editar', editor: 'Crear/Editar', viewer: 'Ver' },
                  { modulo: 'Aportaciones', admin: 'Crear/Editar', editor: 'Crear/Editar', viewer: 'Ver' },
                  { modulo: 'Gastos tarjeta', admin: 'Crear/Descontar', editor: 'Crear/Descontar', viewer: 'Ver' },
                  { modulo: 'Empresas', admin: 'Gestionar', editor: '—', viewer: '—' },
                  { modulo: 'Usuarios', admin: 'Gestionar', editor: '—', viewer: '—' },
                ].map((row) => (
                  <tr key={row.modulo} className="border-b">
                    <td className="p-2 font-medium">{row.modulo}</td>
                    <td className="text-center p-2 text-green-700">{row.admin}</td>
                    <td className="text-center p-2 text-blue-700">{row.editor}</td>
                    <td className="text-center p-2 text-gray-500">{row.viewer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Usuarios asignados</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Asignado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div>
                      {u.nombre && <p className="font-medium">{u.nombre}</p>}
                      <p className={`text-sm ${u.nombre ? 'text-muted-foreground' : 'font-medium'}`}>{u.email || u.user_id.slice(0, 8) + '...'}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {u.empresas?.nombre || '—'}
                  </TableCell>
                  <TableCell>
                    <Select value={u.rol} onValueChange={(v) => handleChangeRole(u.id, v)}>
                      <SelectTrigger className="w-[120px] h-8">
                        <Badge variant="outline" className={ROLE_COLORS[u.rol]}>{u.rol}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {u.last_sign_in ? (
                      <div className="flex items-center gap-1 text-green-700">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span className="text-xs">Activo</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-yellow-700">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">Pendiente</span>
                      </div>
                    )}
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
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay usuarios asignados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Socios list */}
      {socios.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Socios registrados</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {socios.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 border rounded-md">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                    {s.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.nombre}</p>
                    {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
