'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { formatMXN } from '@/lib/constants'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import type { Proveedor, Factura } from '@/lib/types'
import { toast } from 'sonner'
import { FileText, Plus, Download, Clock, CheckCircle, XCircle, AlertCircle, LogOut, ThumbsUp } from 'lucide-react'

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pendiente: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock, label: 'Pendiente de revisión' },
  aprobada: { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: CheckCircle, label: 'Aprobada' },
  programada: { color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Clock, label: 'Pago programado' },
  pagada: { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle, label: 'Pagada' },
  rechazada: { color: 'bg-red-100 text-red-800 border-red-300', icon: XCircle, label: 'Rechazada' },
}

interface FacturaExtended extends Factura {
  comprobante_pago_url?: string | null
  observaciones?: string | null
}

export default function PortalProveedor({ params }: { params: { token: string } }) {
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [facturas, setFacturas] = useState<FacturaExtended[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedFactura, setSelectedFactura] = useState<FacturaExtended | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: prov } = await supabase
        .from('proveedores')
        .select('*')
        .eq('token_acceso', params.token)
        .eq('activo', true)
        .single()

      if (!prov) {
        setError(true)
        setLoading(false)
        return
      }

      setProveedor(prov)

      const { data: facts } = await supabase
        .from('facturas')
        .select('*')
        .eq('proveedor_id', prov.id)
        .order('created_at', { ascending: false })

      setFacturas(facts || [])
      setLoading(false)
    }
    load()
  }, [params.token])

  async function aprobarParaPago(facturaId: string) {
    const supabase = createClient()
    const { error: err } = await supabase
      .from('facturas')
      .update({ estatus: 'aprobada' })
      .eq('id', facturaId)
      .eq('proveedor_id', proveedor?.id || '')
    if (err) { toast.error('Error al aprobar'); return }
    toast.success('Factura aprobada para pago')
    // Update local state
    setFacturas(prev => prev.map(f => f.id === facturaId ? { ...f, estatus: 'aprobada' } : f))
    if (selectedFactura?.id === facturaId) {
      setSelectedFactura(prev => prev ? { ...prev, estatus: 'aprobada' } : null)
    }
  }

  function handleLogout() {
    localStorage.removeItem('proveedor_token')
    localStorage.removeItem('proveedor_nombre')
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error || !proveedor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Acceso denegado</CardTitle>
            <CardDescription>El enlace no es válido o el proveedor está inactivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/login">Ir al login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pendientes = facturas.filter((f) => f.estatus === 'pendiente').length
  const aprobadas = facturas.filter((f) => ['aprobada', 'programada'].includes(f.estatus)).length
  const pagadas = facturas.filter((f) => f.estatus === 'pagada').length

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{proveedor.nombre_empresa}</h1>
            <p className="text-muted-foreground">RFC: {proveedor.rfc} · {proveedor.contacto_email}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/portal/${params.token}/nueva-factura`}>
                <Plus className="h-4 w-4 mr-2" /> Nueva factura
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Salir
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-yellow-100 p-2"><AlertCircle className="h-5 w-5 text-yellow-700" /></div>
                <div>
                  <p className="text-2xl font-bold">{pendientes}</p>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2"><Clock className="h-5 w-5 text-blue-700" /></div>
                <div>
                  <p className="text-2xl font-bold">{aprobadas}</p>
                  <p className="text-sm text-muted-foreground">Aprobadas / Programadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 p-2"><CheckCircle className="h-5 w-5 text-green-700" /></div>
                <div>
                  <p className="text-2xl font-bold">{pagadas}</p>
                  <p className="text-sm text-muted-foreground">Pagadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice list */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Mis facturas
                </CardTitle>
                <CardDescription>{facturas.length} factura(s) registrada(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {facturas.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No tienes facturas registradas aún.</p>
                ) : (
                  <div className="space-y-3">
                    {facturas.map((f) => {
                      const statusConfig = STATUS_CONFIG[f.estatus] || STATUS_CONFIG.pendiente
                      const StatusIcon = statusConfig.icon
                      const isSelected = selectedFactura?.id === f.id

                      return (
                        <div
                          key={f.id}
                          className={`rounded-lg border p-4 cursor-pointer transition-all hover:shadow-sm ${
                            isSelected ? 'ring-2 ring-primary border-primary' : ''
                          }`}
                          onClick={() => setSelectedFactura(isSelected ? null : f)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{f.numero_factura}</span>
                                <Badge variant="outline" className={statusConfig.color}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <div className="flex gap-4 text-sm text-muted-foreground">
                                <span>Fecha: {format(new Date(f.fecha_factura + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                                <span>Vence: {f.fecha_vencimiento ? format(new Date(f.fecha_vencimiento + 'T12:00:00'), 'dd/MM/yyyy') : '—'}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                              <p className="font-bold text-lg">{formatMXN(f.total)}</p>
                              {f.fecha_programada_pago && (
                                <p className="text-xs text-muted-foreground">
                                  Pago: {format(new Date(f.fecha_programada_pago + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: es })}
                                </p>
                              )}
                              {f.estatus === 'pendiente' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    aprobarParaPago(f.id)
                                  }}
                                >
                                  <ThumbsUp className="h-3 w-3 mr-1" /> Aprobar para pago
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detail sidebar */}
          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-base">Detalle de factura</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedFactura ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Selecciona una factura para ver el detalle
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Número</p>
                      <p className="font-semibold">{selectedFactura.numero_factura}</p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Subtotal</p>
                        <p className="font-medium">{formatMXN(selectedFactura.subtotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">IVA ({selectedFactura.tipo_iva === '16' ? '16%' : selectedFactura.tipo_iva === '0' ? '0%' : 'Exento'})</p>
                        <p className="font-medium">{formatMXN(selectedFactura.monto_iva)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-bold text-lg">{formatMXN(selectedFactura.total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Días crédito</p>
                        <p className="font-medium">{selectedFactura.dias_credito}</p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-xs text-muted-foreground">Estatus</p>
                      <Badge variant="outline" className={`mt-1 ${STATUS_CONFIG[selectedFactura.estatus]?.color}`}>
                        {STATUS_CONFIG[selectedFactura.estatus]?.label}
                      </Badge>
                      {selectedFactura.estatus === 'pendiente' && (
                        <Button
                          size="sm"
                          className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => aprobarParaPago(selectedFactura.id)}
                        >
                          <ThumbsUp className="h-4 w-4 mr-2" /> Aprobar para pago
                        </Button>
                      )}
                    </div>

                    {selectedFactura.fecha_programada_pago && (
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha de pago programada</p>
                        <p className="font-medium text-primary">
                          {format(new Date(selectedFactura.fecha_programada_pago + 'T12:00:00'), "EEEE dd 'de' MMMM yyyy", { locale: es })}
                        </p>
                      </div>
                    )}

                    {selectedFactura.observaciones && (
                      <div>
                        <p className="text-xs text-muted-foreground">Observaciones</p>
                        <div className="mt-1 rounded-md bg-muted/50 p-3 text-sm">
                          {selectedFactura.observaciones}
                        </div>
                      </div>
                    )}

                    {selectedFactura.notas && (
                      <div>
                        <p className="text-xs text-muted-foreground">Notas</p>
                        <p className="text-sm">{selectedFactura.notas}</p>
                      </div>
                    )}

                    <Separator />

                    {/* Documents */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Documentos</p>
                      <div className="space-y-2">
                        {selectedFactura.pdf_url && (
                          <a href={selectedFactura.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <Download className="h-3 w-3" /> PDF Factura
                          </a>
                        )}
                        {selectedFactura.xml_url && (
                          <a href={selectedFactura.xml_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <Download className="h-3 w-3" /> XML Factura
                          </a>
                        )}
                        {selectedFactura.pdf_firmado_url && (
                          <a href={selectedFactura.pdf_firmado_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <Download className="h-3 w-3" /> PDF Firmado
                          </a>
                        )}
                        {selectedFactura.comprobante_pago_url && (
                          <a href={selectedFactura.comprobante_pago_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-green-700 hover:underline">
                            <Download className="h-3 w-3" /> Comprobante de pago
                          </a>
                        )}
                        {selectedFactura.estatus === 'pagada' && !selectedFactura.comprobante_pago_url && (
                          <p className="text-xs text-muted-foreground italic">Comprobante aún no disponible</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
