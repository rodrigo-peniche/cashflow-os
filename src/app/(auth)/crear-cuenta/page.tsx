'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Building2, User, Mail, Lock, Phone, FileText } from 'lucide-react'

export default function RegistroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    password2: '',
    empresa_nombre: '',
    empresa_rfc: '',
    telefono: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.nombre.trim() || !form.email.trim() || !form.password || !form.empresa_nombre.trim()) {
      toast.error('Completa todos los campos obligatorios')
      return
    }

    if (form.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (form.password !== form.password2) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          empresa_nombre: form.empresa_nombre.trim(),
          empresa_rfc: form.empresa_rfc.trim().toUpperCase() || null,
          telefono: form.telefono.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Error al registrar')
        setLoading(false)
        return
      }

      toast.success('Cuenta creada exitosamente. Inicia sesión.')
      router.push('/auth/login')
    } catch {
      toast.error('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">CashFlow OS</CardTitle>
          <CardDescription>Crea tu cuenta y empresa para comenzar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Datos personales */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <User className="h-4 w-4" /> Datos personales
              </h3>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo *</Label>
                <Input
                  id="nombre"
                  placeholder="Tu nombre"
                  value={form.nombre}
                  onChange={(e) => update('nombre', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@empresa.com"
                    className="pl-10"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono (opcional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="telefono"
                    placeholder="55 1234 5678"
                    className="pl-10"
                    value={form.telefono}
                    onChange={(e) => update('telefono', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="pl-10"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Confirmar *</Label>
                  <Input
                    id="password2"
                    type="password"
                    placeholder="Repetir contraseña"
                    value={form.password2}
                    onChange={(e) => update('password2', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Datos empresa */}
            <div className="space-y-3 pt-2 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 pt-2">
                <Building2 className="h-4 w-4" /> Datos de la empresa
              </h3>
              <div className="space-y-2">
                <Label htmlFor="empresa_nombre">Nombre de la empresa *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="empresa_nombre"
                    placeholder="Mi Empresa S.A. de C.V."
                    className="pl-10"
                    value={form.empresa_nombre}
                    onChange={(e) => update('empresa_nombre', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="empresa_rfc">RFC de la empresa (opcional)</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="empresa_rfc"
                    placeholder="ABC123456XYZ"
                    className="pl-10 uppercase"
                    value={form.empresa_rfc}
                    onChange={(e) => update('empresa_rfc', e.target.value)}
                    maxLength={13}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{' '}
              <Link href="/auth/login" className="text-primary hover:underline font-medium">
                Inicia sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
