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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Shield, Building2, Users, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Search } from 'lucide-react'

interface EmpresaAdmin {
  id: string
  nombre: string
  rfc_empresa: string | null
  activa: boolean
  plan: string
  fecha_vencimiento_plan: string | null
  max_usuarios: number
  notas_admin: string | null
  created_at: string
  usuario_count?: number
  usuarios?: { user_id: string; rol: string; email?: string }[]
}

const PLANES = [
  { value: 'trial', label: 'Trial', color: 'bg-gray-100 text-gray-800' },
  { value: 'basico', label: 'Básico', color: 'bg-blue-100 text-blue-800' },
  { value: 'profesional', label: 'Profesional', color: 'bg-purple-100 text-purple-800' },
  { value: 'enterprise', label: 'Enterprise', color: 'bg-amber-100 text-amber-800' },
]

export default function PlataformaPage() {
  const [empresas, setEmpresas] = useState<EmpresaAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterActiva, setFilterActiva] = useState('todos')

  const loadData = useCallback(async () => {
    const supabase = createClient()

    // Check if current user is platform admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: platformCheck } = await supabase
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!platformCheck) {
      setIsPlatformAdmin(false)
      setLoading(false)
      return
    }

    setIsPlatformAdmin(true)

    // Load all empresas
    const { data: empresasData } = await supabase
      .from('empresas')
      .select('*')
      .order('created_at', { ascending: false })

    // Load user counts per empresa
    const { data: accesos } = await supabase
      .from('usuario_empresas')
      .select('empresa_id, user_id, rol')

    const empresasList = (empresasData || []).map((e: EmpresaAdmin) => {
      const empAccesos = (accesos || []).filter((a: { empresa_id: string }) => a.empresa_id === e.id)
      return {
        ...e,
        usuario_count: empAccesos.length,
        usuarios: empAccesos,
      }
    })

    setEmpresas(empresasList)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function toggleActiva(id: string, activa: boolean) {
    const supabase = createClient()
    const { error } = await supabase.from('empresas').update({ activa }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(activa ? 'Empresa activada' : 'Empresa desactivada')
    loadData()
  }

  async function updatePlan(id: string, plan: string) {
    const supabase = createClient()
    const { error } = await supabase.from('empresas').update({ plan }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Plan actualizado')
    loadData()
  }

  async function updateMaxUsuarios(id: string, max: number) {
    const supabase = createClient()
    const { error } = await supabase.from('empresas').update({ max_usuarios: max }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Límite de usuarios actualizado')
  }

  async function updateFechaVencimiento(id: string, fecha: string) {
    const supabase = createClient()
    const { error } = await supabase.from('empresas').update({ fecha_vencimiento_plan: fecha || null }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Fecha de vencimiento actualizada')
  }

  async function updateNotas(id: string, notas: string) {
    const supabase = createClient()
    const { error } = await supabase.from('empresas').update({ notas_admin: notas || null }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Notas guardadas')
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  if (!isPlatformAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Acceso restringido</h2>
            <p className="text-muted-foreground">Esta sección es solo para administradores de la plataforma.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filtered = empresas.filter(e => {
    if (filterActiva === 'activas' && !e.activa) return false
    if (filterActiva === 'inactivas' && e.activa) return false
    if (search) {
      const q = search.toLowerCase()
      if (!e.nombre.toLowerCase().includes(q) && !(e.rfc_empresa || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalEmpresas = empresas.length
  const activas = empresas.filter(e => e.activa).length
  const totalUsuarios = empresas.reduce((sum, e) => sum + (e.usuario_count || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" /> Administración de Plataforma
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{totalEmpresas}</p>
                <p className="text-sm text-muted-foreground">Empresas registradas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ToggleRight className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{activas} <span className="text-sm font-normal text-muted-foreground">/ {totalEmpresas}</span></p>
                <p className="text-sm text-muted-foreground">Empresas activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{totalUsuarios}</p>
                <p className="text-sm text-muted-foreground">Usuarios totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa o RFC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterActiva} onValueChange={setFilterActiva}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="activas">Activas</SelectItem>
            <SelectItem value="inactivas">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Empresas table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Empresas ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>RFC</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Usuarios</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const isExpanded = expandedId === e.id
                const planInfo = PLANES.find(p => p.value === e.plan)
                const vencida = e.fecha_vencimiento_plan && new Date(e.fecha_vencimiento_plan) < new Date()

                return (
                  <EmpresaRow
                    key={e.id}
                    empresa={e}
                    isExpanded={isExpanded}
                    planInfo={planInfo}
                    vencida={!!vencida}
                    onToggleExpand={() => setExpandedId(isExpanded ? null : e.id)}
                    onToggleActiva={() => toggleActiva(e.id, !e.activa)}
                    onUpdatePlan={(plan) => updatePlan(e.id, plan)}
                    onUpdateMaxUsuarios={(max) => updateMaxUsuarios(e.id, max)}
                    onUpdateFechaVencimiento={(fecha) => updateFechaVencimiento(e.id, fecha)}
                    onUpdateNotas={(notas) => updateNotas(e.id, notas)}
                  />
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No hay empresas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function EmpresaRow({
  empresa,
  isExpanded,
  planInfo,
  vencida,
  onToggleExpand,
  onToggleActiva,
  onUpdatePlan,
  onUpdateMaxUsuarios,
  onUpdateFechaVencimiento,
  onUpdateNotas,
}: {
  empresa: EmpresaAdmin
  isExpanded: boolean
  planInfo: { value: string; label: string; color: string } | undefined
  vencida: boolean
  onToggleExpand: () => void
  onToggleActiva: () => void
  onUpdatePlan: (plan: string) => void
  onUpdateMaxUsuarios: (max: number) => void
  onUpdateFechaVencimiento: (fecha: string) => void
  onUpdateNotas: (notas: string) => void
}) {
  const [notas, setNotas] = useState(empresa.notas_admin || '')
  const [maxUsr, setMaxUsr] = useState(String(empresa.max_usuarios))
  const [fechaVenc, setFechaVenc] = useState(empresa.fecha_vencimiento_plan || '')

  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 ${isExpanded ? 'border-b-0 bg-muted/30' : ''}`}
        onClick={onToggleExpand}
      >
        <TableCell className="w-8 pr-0">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium">{empresa.nombre}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{empresa.rfc_empresa || '—'}</TableCell>
        <TableCell>
          <Badge variant="outline" className={planInfo?.color}>
            {planInfo?.label || empresa.plan}
          </Badge>
          {vencida && <Badge variant="outline" className="ml-1 bg-red-100 text-red-800">Vencido</Badge>}
        </TableCell>
        <TableCell>
          <span className="font-medium">{empresa.usuario_count}</span>
          <span className="text-muted-foreground text-xs"> / {empresa.max_usuarios}</span>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {format(new Date(empresa.created_at), 'dd/MM/yy')}
        </TableCell>
        <TableCell>
          {empresa.activa ? (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Activa</Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Inactiva</Badge>
          )}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Button
            variant={empresa.activa ? 'destructive' : 'default'}
            size="sm"
            onClick={onToggleActiva}
          >
            {empresa.activa ? (
              <><ToggleLeft className="h-4 w-4 mr-1" /> Desactivar</>
            ) : (
              <><ToggleRight className="h-4 w-4 mr-1" /> Activar</>
            )}
          </Button>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Plan & config */}
              <div className="space-y-3">
                <Label className="font-semibold">Plan y configuración</Label>
                <div className="space-y-2">
                  <Label className="text-sm">Plan</Label>
                  <Select value={empresa.plan} onValueChange={onUpdatePlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Máx. usuarios</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={maxUsr}
                      onChange={(e) => setMaxUsr(e.target.value)}
                      className="w-20"
                      min={1}
                    />
                    <Button size="sm" variant="outline" onClick={() => onUpdateMaxUsuarios(Number(maxUsr) || 3)}>
                      Guardar
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Vencimiento del plan</Label>
                  <Input
                    type="date"
                    value={fechaVenc}
                    onChange={(e) => {
                      setFechaVenc(e.target.value)
                      onUpdateFechaVencimiento(e.target.value)
                    }}
                  />
                </div>
              </div>

              {/* Usuarios */}
              <div className="space-y-3">
                <Label className="font-semibold">Usuarios ({empresa.usuario_count})</Label>
                <div className="space-y-1">
                  {empresa.usuarios?.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-1.5 bg-background rounded border">
                      <Badge variant="outline" className="text-xs">
                        {u.rol}
                      </Badge>
                      <span className="text-muted-foreground truncate text-xs">{u.user_id.slice(0, 8)}...</span>
                    </div>
                  ))}
                  {(!empresa.usuarios || empresa.usuarios.length === 0) && (
                    <p className="text-sm text-muted-foreground">Sin usuarios</p>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-3">
                <Label className="font-semibold">Notas internas</Label>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas sobre este cliente..."
                  rows={4}
                />
                <Button size="sm" onClick={() => onUpdateNotas(notas)}>
                  Guardar notas
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
