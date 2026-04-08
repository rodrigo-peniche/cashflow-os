import { createAdminSupabase } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { nombre, email, password, empresa_nombre, empresa_rfc, telefono } = await request.json()

    if (!nombre || !email || !password || !empresa_nombre) {
      return NextResponse.json(
        { error: 'Nombre, email, contraseña y nombre de empresa son requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminSupabase()

    // 1. Check if user already exists
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === email)

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con este correo electrónico' },
        { status: 400 }
      )
    }

    // 2. Create auth user
    const { data: newUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, telefono },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = newUser.user.id

    // 3. Create empresa (starts active, plan trial)
    const { data: empresa, error: empresaError } = await adminSupabase
      .from('empresas')
      .insert({
        nombre: empresa_nombre,
        rfc_empresa: empresa_rfc || null,
        activa: true,
        plan: 'trial',
      })
      .select('id')
      .single()

    if (empresaError) {
      // Rollback: delete the auth user
      await adminSupabase.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Error al crear empresa: ' + empresaError.message },
        { status: 500 }
      )
    }

    // 4. Link user to empresa as admin
    const { error: linkError } = await adminSupabase
      .from('usuario_empresas')
      .insert({
        user_id: userId,
        empresa_id: empresa.id,
        rol: 'admin',
      })

    if (linkError) {
      // Rollback
      await adminSupabase.from('empresas').delete().eq('id', empresa.id)
      await adminSupabase.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Error al vincular usuario: ' + linkError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cuenta creada exitosamente',
      empresa_id: empresa.id,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Error interno: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    )
  }
}
