import { createServerSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { rfc, password } = await request.json()

  if (!rfc || !password) {
    return NextResponse.json({ error: 'RFC y contraseña son requeridos' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  const { data: proveedor, error } = await supabase
    .from('proveedores')
    .select('token_acceso, nombre_empresa, password_hash, activo')
    .eq('rfc', rfc.toUpperCase())
    .single()

  if (error || !proveedor) {
    return NextResponse.json({ error: 'RFC no encontrado' }, { status: 401 })
  }

  if (!proveedor.activo) {
    return NextResponse.json({ error: 'Cuenta desactivada' }, { status: 401 })
  }

  if (!proveedor.password_hash) {
    return NextResponse.json({ error: 'No tienes contraseña asignada. Contacta al administrador.' }, { status: 401 })
  }

  // Simple password comparison (in production, use bcrypt)
  if (proveedor.password_hash !== password) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  return NextResponse.json({
    token: proveedor.token_acceso,
    nombre: proveedor.nombre_empresa,
  })
}
