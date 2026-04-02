'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { LogIn } from 'lucide-react'

export default function LoginProveedor() {
  const router = useRouter()
  const [rfc, setRfc] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/proveedor/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfc: rfc.toUpperCase(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Credenciales inválidas')
        setLoading(false)
        return
      }

      // Store token in localStorage for session
      localStorage.setItem('proveedor_token', data.token)
      localStorage.setItem('proveedor_nombre', data.nombre)
      router.push(`/portal/${data.token}`)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Portal de Proveedores</CardTitle>
          <CardDescription>Ingresa con tu RFC y contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>RFC</Label>
              <Input
                value={rfc}
                onChange={(e) => setRfc(e.target.value)}
                placeholder="XAXX010101000"
                className="uppercase"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
