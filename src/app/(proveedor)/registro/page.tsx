'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { MEXICAN_BANKS, RFC_REGEX, CLABE_REGEX } from '@/lib/constants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'

const schema = z.object({
  nombre_empresa: z.string().min(1, 'Requerido'),
  rfc: z.string().regex(RFC_REGEX, 'RFC inválido (ej. XAXX010101000)'),
  contacto_nombre: z.string().min(1, 'Requerido'),
  contacto_email: z.string().email('Email inválido'),
  telefono: z.string().optional(),
  banco: z.string().min(1, 'Selecciona un banco'),
  clabe: z.string().regex(CLABE_REGEX, 'CLABE debe ser 18 dígitos'),
  cuenta: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function RegistroProveedor() {
  const [tokenLink, setTokenLink] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const { data: proveedor, error } = await supabase
      .from('proveedores')
      .insert(data)
      .select('token_acceso')
      .single()

    if (error) {
      toast.error(error.message.includes('duplicate') ? 'El RFC ya está registrado' : error.message)
      return
    }

    const link = `${window.location.origin}/portal/${proveedor.token_acceso}`
    setTokenLink(link)
    toast.success('Proveedor registrado exitosamente')
  }

  if (tokenLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-green-600">¡Registro exitoso!</CardTitle>
            <CardDescription>Guarda este enlace para acceder a tu portal de proveedor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-3 break-all text-sm font-mono">
              {tokenLink}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigator.clipboard.writeText(tokenLink).then(() => toast.success('Copiado'))}>
                Copiar enlace
              </Button>
              <Button variant="outline" asChild>
                <Link href={tokenLink}>Ir al portal</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Registro de Proveedor</CardTitle>
          <CardDescription>Completa tu información para acceder al portal de proveedores</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre de empresa *</Label>
                <Input {...register('nombre_empresa')} />
                {errors.nombre_empresa && <p className="text-sm text-destructive">{errors.nombre_empresa.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>RFC *</Label>
                <Input {...register('rfc')} placeholder="XAXX010101000" className="uppercase" />
                {errors.rfc && <p className="text-sm text-destructive">{errors.rfc.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Nombre de contacto *</Label>
                <Input {...register('contacto_nombre')} />
                {errors.contacto_nombre && <p className="text-sm text-destructive">{errors.contacto_nombre.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Email de contacto *</Label>
                <Input type="email" {...register('contacto_email')} />
                {errors.contacto_email && <p className="text-sm text-destructive">{errors.contacto_email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input {...register('telefono')} />
              </div>

              <div className="space-y-2">
                <Label>Banco *</Label>
                <Select onValueChange={(val) => setValue('banco', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEXICAN_BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.banco && <p className="text-sm text-destructive">{errors.banco.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>CLABE interbancaria *</Label>
                <Input {...register('clabe')} placeholder="18 dígitos" maxLength={18} />
                {errors.clabe && <p className="text-sm text-destructive">{errors.clabe.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Número de cuenta</Label>
                <Input {...register('cuenta')} />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Registrar proveedor'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
