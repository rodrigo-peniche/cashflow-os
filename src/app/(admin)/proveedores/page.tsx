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
import { Switch } from '@/components/ui/switch'
import { MEXICAN_BANKS, RFC_REGEX, CLABE_REGEX } from '@/lib/constants'
import { toast } from 'sonner'
import type { Proveedor, ModalidadPago } from '@/lib/types'
import { ExcelImport } from '@/components/shared/excel-import'
import { Users, Plus, Copy, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import { useEmpresa } from '@/lib/contexts/empresa-context'

const TIPOS_CUENTA = [
  'Debito CLABE OB',
  'Cheques',
  'CLABE Interbancaria',
  'Tarjeta de Débito',
  'Otro',
] as const

const MONEDAS = ['MXP', 'USD', 'EUR'] as const

const MODALIDAD_LABELS: Record<ModalidadPago, string> = {
  factura_primero: 'Se paga con factura',
  pago_primero: 'Se paga sin factura',
}

export default function ProveedoresPage() {
  const { empresaId, userRole } = useEmpresa()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [nombre, setNombre] = useState('')
  const [idBanco, setIdBanco] = useState('')
  const [rfc, setRfc] = useState('')
  const [contactoNombre, setContactoNombre] = useState('')
  const [contactoEmail, setContactoEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [clabe, setClabe] = useState('')
  const [cuenta, setCuenta] = useState('')
  const [titular, setTitular] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('')
  const [banco, setBanco] = useState('')
  const [moneda, setMoneda] = useState('MXP')
  const [diasCredito, setDiasCredito] = useState(0)
  const [requiereConcepto, setRequiereConcepto] = useState(false)
  const [giro, setGiro] = useState('')
  const [modalidadPago, setModalidadPago] = useState<ModalidadPago>('factura_primero')
  const [password, setPassword] = useState('')

  const loadData = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const { data } = await supabase.from('proveedores').select('*').eq('empresa_id', empresaId).order('nombre_empresa')
    setProveedores(data || [])
    setLoading(false)
  }, [empresaId])

  useEffect(() => { loadData() }, [loadData])

  function resetForm() {
    setNombre(''); setIdBanco(''); setRfc(''); setContactoNombre(''); setContactoEmail('')
    setTelefono(''); setClabe(''); setCuenta(''); setTitular(''); setTipoCuenta('')
    setBanco(''); setMoneda('MXP'); setDiasCredito(0); setRequiereConcepto(false)
    setGiro(''); setModalidadPago('factura_primero'); setPassword('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!RFC_REGEX.test(rfc)) { toast.error('RFC inválido'); return }
    if (clabe && !CLABE_REGEX.test(clabe)) { toast.error('CLABE debe ser 18 dígitos'); return }

    const supabase = createClient()
    const { error } = await supabase.from('proveedores').insert({
      empresa_id: empresaId,
      nombre_empresa: nombre,
      id_banco: idBanco || null,
      rfc,
      contacto_nombre: contactoNombre,
      contacto_email: contactoEmail,
      telefono: telefono || null,
      banco,
      clabe: clabe || null,
      cuenta: cuenta || null,
      titular: titular || null,
      tipo_cuenta: tipoCuenta || null,
      moneda,
      dias_credito: diasCredito,
      requiere_concepto: requiereConcepto,
      giro: giro || null,
      modalidad_pago: modalidadPago,
      password_hash: password,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Proveedor creado')
    resetForm(); setShowForm(false); loadData()
  }

  async function toggleActivo(id: string, activo: boolean) {
    const supabase = createClient()
    await supabase.from('proveedores').update({ activo: !activo }).eq('id', id)
    loadData()
  }

  const filtered = proveedores.filter((p) =>
    p.nombre_empresa.toLowerCase().includes(search.toLowerCase()) ||
    p.rfc.toLowerCase().includes(search.toLowerCase()) ||
    (p.id_banco || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Proveedores</h1>
        {userRole !== 'viewer' && (
          <div className="flex gap-2">
            <ExcelImport templateKey="proveedores" empresaId={empresaId} onSuccess={loadData} />
            <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" /> Nuevo</Button>
          </div>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nuevo proveedor</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Datos generales */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Datos generales</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Nombre empresa *</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>ID banco (portal)</Label><Input value={idBanco} onChange={(e) => setIdBanco(e.target.value)} placeholder="PROV016" /></div>
                  <div className="space-y-2"><Label>RFC *</Label><Input value={rfc} onChange={(e) => setRfc(e.target.value)} className="uppercase" required /></div>
                  <div className="space-y-2"><Label>Contacto *</Label><Input value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Email *</Label><Input type="email" value={contactoEmail} onChange={(e) => setContactoEmail(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Teléfono</Label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Giro / Descripción</Label><Input value={giro} onChange={(e) => setGiro(e.target.value)} placeholder="PAN TORTILLA Y HARINA" /></div>
                </div>
              </div>

              {/* Datos bancarios */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Datos bancarios</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Cuenta / CLABE / Celular *</Label><Input value={clabe} onChange={(e) => setClabe(e.target.value)} required /></div>
                  <div className="space-y-2"><Label>Cuenta (adicional)</Label><Input value={cuenta} onChange={(e) => setCuenta(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Titular</Label><Input value={titular} onChange={(e) => setTitular(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Tipo de cuenta</Label>
                    <Select value={tipoCuenta} onValueChange={setTipoCuenta}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{TIPOS_CUENTA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Banco *</Label>
                    <Select value={banco} onValueChange={setBanco}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{MEXICAN_BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Moneda</Label>
                    <Select value={moneda} onValueChange={setMoneda}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Condiciones comerciales */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Condiciones comerciales</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Días de crédito</Label>
                    <Input type="number" min={0} value={diasCredito} onChange={(e) => setDiasCredito(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Modalidad de pago</Label>
                    <Select value={modalidadPago} onValueChange={(v) => setModalidadPago(v as ModalidadPago)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="factura_primero">Se paga con factura</SelectItem>
                        <SelectItem value="pago_primero">Se paga sin factura</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <Switch checked={requiereConcepto} onCheckedChange={setRequiereConcepto} />
                    <Label>Requiere concepto</Label>
                  </div>
                </div>
              </div>

              {/* Portal */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Portal proveedor</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Contraseña portal *</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña para el proveedor" required /></div>
                </div>
              </div>

              <Button type="submit">Crear proveedor</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Input placeholder="Buscar por empresa, RFC o ID banco..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>RFC</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Crédito</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const isExpanded = expandedId === p.id
                  return (
                    <>
                      <TableRow key={p.id} className={isExpanded ? 'border-b-0' : ''}>
                        <TableCell className="font-mono text-xs">{p.id_banco || '—'}</TableCell>
                        <TableCell className="font-medium">{p.nombre_empresa}</TableCell>
                        <TableCell className="font-mono text-sm">{p.rfc}</TableCell>
                        <TableCell>
                          <div>{p.contacto_nombre}</div>
                          <div className="text-xs text-muted-foreground">{p.contacto_email}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{p.banco}</Badge></TableCell>
                        <TableCell>{p.dias_credito > 0 ? `${p.dias_credito} días` : '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.modalidad_pago === 'factura_primero' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}>
                            {MODALIDAD_LABELS[p.modalidad_pago] || p.modalidad_pago}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.activo ? 'default' : 'secondary'}>{p.activo ? 'Vigente' : 'Inactivo'}</Badge>
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
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            {userRole !== 'viewer' && (
                              <Button variant="ghost" size="sm" onClick={() => toggleActivo(p.id, p.activo)}>
                                {p.activo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${p.id}-detail`}>
                          <TableCell colSpan={10} className="bg-muted/30 p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Teléfono:</span>
                                <p className="font-medium">{p.telefono || '—'}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">CLABE/Cuenta:</span>
                                <p className="font-medium font-mono">{p.clabe}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Cuenta adicional:</span>
                                <p className="font-medium font-mono">{p.cuenta || '—'}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Titular:</span>
                                <p className="font-medium">{p.titular || '—'}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Tipo cuenta:</span>
                                <p className="font-medium">{p.tipo_cuenta || '—'}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Moneda:</span>
                                <p className="font-medium">{p.moneda}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Giro:</span>
                                <p className="font-medium">{p.giro || '—'}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Requiere concepto:</span>
                                <p className="font-medium">{p.requiere_concepto ? 'Sí' : 'No'}</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No hay proveedores</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
