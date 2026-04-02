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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MEXICAN_BANKS, RFC_REGEX, CLABE_REGEX } from '@/lib/constants'
import { toast } from 'sonner'
import type { Proveedor } from '@/lib/types'
import { ExcelImport } from '@/components/shared/excel-import'
import { Users, Plus, Copy, Eye, EyeOff } from 'lucide-react'
import { useEmpresa } from '@/lib/contexts/empresa-context'

export default function ProveedoresPage() {
  const { empresaId, userRole } = useEmpresa()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [nombre, setNombre] = useState('')
  const [rfc, setRfc] = useState('')
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoEmail, setContactoEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [banco, setBanco] = useState('')
  const [clabe, setClabe] = useState('')
  const [cuenta, setCuenta] = useState('')
  const [password, setPassword] = useState('')

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const { data } = await supabase.from('proveedores').select('*').eq('empresa_id', empresaId).order('nombre_empresa')
    setProveedores(data || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!RFC_REGEX.test(rfc)) { toast.error('RFC inválido'); return }
    if (!CLABE_REGEX.test(clabe)) { toast.error('CLABE debe ser 18 dígitos'); return }

    const supabase = createClient()
    const { error } = await supabase.from('proveedores').insert({
      empresa_id: empresaId,
      nombre_empresa: nombre, rfc, contacto_nombre: contactoNombre,
      contacto_email: contactoEmail, telefono: telefono || null,
      banco, clabe, cuenta: cuenta || null, password_hash: password,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Proveedor creado')
    setShowForm(false); loadData()
  }

  async function toggleActivo(id: string, activo: boolean) {
    const supabase = createClient()
    await supabase.from('proveedores').update({ activo: !activo }).eq('id', id)
    loadData()
  }

  const filtered = proveedores.filter((p) =>
    p.nombre_empresa.toLowerCase().includes(search.toLowerCase()) ||
    p.rfc.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Proveedores</h1>
        {userRole !== 'viewer' && (
          <div className="flex gap-2">
            <ExcelImport templateKey="proveedores" onSuccess={loadData} />
            <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" /> Nuevo</Button>
          </div>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nuevo proveedor</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Empresa *</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></div>
              <div className="space-y-2"><Label>RFC *</Label><Input value={rfc} onChange={(e) => setRfc(e.target.value)} className="uppercase" required /></div>
              <div className="space-y-2"><Label>Contacto *</Label><Input value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={contactoEmail} onChange={(e) => setContactoEmail(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Teléfono</Label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Banco *</Label>
                <Select value={banco} onValueChange={setBanco}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{MEXICAN_BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>CLABE *</Label><Input value={clabe} onChange={(e) => setClabe(e.target.value)} maxLength={18} required /></div>
              <div className="space-y-2"><Label>Cuenta</Label><Input value={cuenta} onChange={(e) => setCuenta(e.target.value)} /></div>
              <div className="space-y-2"><Label>Contraseña portal *</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña para el proveedor" required /></div>
              <div className="md:col-span-2"><Button type="submit">Crear proveedor</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Input placeholder="Buscar por empresa o RFC..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>RFC</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre_empresa}</TableCell>
                  <TableCell className="font-mono text-sm">{p.rfc}</TableCell>
                  <TableCell>
                    <div>{p.contacto_nombre}</div>
                    <div className="text-xs text-muted-foreground">{p.contacto_email}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{p.banco}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={p.activo ? 'default' : 'secondary'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/portal/${p.token_acceso}`)
                        toast.success('Link copiado')
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Link
                    </Button>
                  </TableCell>
                  {userRole !== 'viewer' && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => toggleActivo(p.id, p.activo)}>
                        {p.activo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay proveedores</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
