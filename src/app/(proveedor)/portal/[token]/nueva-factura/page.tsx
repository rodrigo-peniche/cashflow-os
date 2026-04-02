'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { MoneyInput } from '@/components/shared/money-input'
import { FileUpload } from '@/components/shared/file-upload'
import { IVACalculator } from '@/components/shared/iva-calculator'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { addDays, format } from 'date-fns'
import type { Proveedor } from '@/lib/types'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const schema = z.object({
  numero_factura: z.string().min(1, 'Requerido'),
  fecha_factura: z.string().min(1, 'Requerido'),
  orden_compra_id: z.string().optional(),
  dias_credito: z.number().min(0),
  subtotal: z.number().min(0.01, 'Debe ser mayor a 0'),
  tipo_iva: z.enum(['16', '0', 'exento']),
  pdf_url: z.string().optional(),
  xml_url: z.string().optional(),
  pdf_firmado_url: z.string().optional(),
  notas: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NuevaFactura({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [loading, setLoading] = useState(true)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { dias_credito: 30, tipo_iva: '16', subtotal: 0 },
  })

  const subtotal = watch('subtotal') || 0
  const tipoIva = watch('tipo_iva') || '16'
  const montoIva = tipoIva === '16' ? subtotal * 0.16 : 0
  const total = subtotal + montoIva

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
        setLoading(false)
        return
      }
      setProveedor(prov)
      setLoading(false)
    }
    load()
  }, [params.token])

  async function onSubmit(data: FormData) {
    if (!proveedor) return

    const fechaVencimiento = format(
      addDays(new Date(data.fecha_factura), data.dias_credito),
      'yyyy-MM-dd'
    )

    const supabase = createClient()
    const { error } = await supabase.from('facturas').insert({
      proveedor_id: proveedor.id,
      orden_compra_id: data.orden_compra_id || null,
      numero_factura: data.numero_factura,
      fecha_factura: data.fecha_factura,
      dias_credito: data.dias_credito,
      fecha_vencimiento: fechaVencimiento,
      subtotal: data.subtotal,
      tipo_iva: data.tipo_iva,
      monto_iva: montoIva,
      total,
      pdf_url: data.pdf_url || null,
      xml_url: data.xml_url || null,
      pdf_firmado_url: data.pdf_firmado_url || null,
      notas: data.notas || null,
    })

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Factura registrada exitosamente')
    router.push(`/portal/${params.token}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="max-w-2xl mx-auto"><Skeleton className="h-96 w-full" /></div>
      </div>
    )
  }

  if (!proveedor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Acceso denegado</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" asChild>
          <Link href={`/portal/${params.token}`}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver al portal
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Nueva Factura</CardTitle>
            <CardDescription>{proveedor.nombre_empresa}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número de factura *</Label>
                  <Input {...register('numero_factura')} />
                  {errors.numero_factura && <p className="text-sm text-destructive">{errors.numero_factura.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Fecha de factura *</Label>
                  <Input type="date" {...register('fecha_factura')} />
                  {errors.fecha_factura && <p className="text-sm text-destructive">{errors.fecha_factura.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Número de orden de compra</Label>
                  <Input {...register('orden_compra_id')} placeholder="Ej. OC-001 (opcional)" />
                </div>

                <div className="space-y-2">
                  <Label>Días de crédito</Label>
                  <Input type="number" {...register('dias_credito')} min={0} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subtotal *</Label>
                <Controller
                  name="subtotal"
                  control={control}
                  render={({ field }) => (
                    <MoneyInput value={field.value} onChange={field.onChange} />
                  )}
                />
                {errors.subtotal && <p className="text-sm text-destructive">{errors.subtotal.message}</p>}
              </div>

              <IVACalculator
                subtotal={subtotal}
                tipoIva={tipoIva}
                onTipoIvaChange={(val) => setValue('tipo_iva', val)}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>PDF Factura</Label>
                  <Controller
                    name="pdf_url"
                    control={control}
                    render={({ field }) => (
                      <FileUpload
                        bucket="facturas-pdf"
                        folder={proveedor.id}
                        accept=".pdf"
                        label="Subir PDF factura"
                        value={field.value}
                        onUpload={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>XML Factura</Label>
                  <Controller
                    name="xml_url"
                    control={control}
                    render={({ field }) => (
                      <FileUpload
                        bucket="facturas-xml"
                        folder={proveedor.id}
                        accept=".xml"
                        label="Subir XML"
                        value={field.value}
                        onUpload={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PDF Firmado</Label>
                  <Controller
                    name="pdf_firmado_url"
                    control={control}
                    render={({ field }) => (
                      <FileUpload
                        bucket="facturas-firmadas"
                        folder={proveedor.id}
                        accept=".pdf"
                        label="Subir PDF firmado"
                        value={field.value}
                        onUpload={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea {...register('notas')} placeholder="Notas adicionales..." />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Registrar factura'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
