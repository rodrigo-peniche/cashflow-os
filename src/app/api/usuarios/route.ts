import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerSupabase()
  const adminSupabase = createAdminSupabase()

  const { data, error } = await supabase
    .from('usuario_empresas')
    .select('*, empresas(nombre)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with user emails from auth
  let userEmails: Record<string, { email: string; name: string; lastSignIn: string | null }> = {}
  try {
    const { data: authUsers } = await adminSupabase.auth.admin.listUsers()
    if (authUsers?.users) {
      userEmails = Object.fromEntries(
        authUsers.users.map((u) => [
          u.id,
          {
            email: u.email || '',
            name: u.user_metadata?.nombre || u.user_metadata?.full_name || '',
            lastSignIn: u.last_sign_in_at || null,
          },
        ])
      )
    }
  } catch {
    // If admin client not available, continue without emails
  }

  const enriched = (data || []).map((u) => ({
    ...u,
    email: userEmails[u.user_id]?.email || null,
    nombre: userEmails[u.user_id]?.name || null,
    last_sign_in: userEmails[u.user_id]?.lastSignIn || null,
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const { email, password, empresa_id, rol, nombre } = await request.json()

  if (!email || !password || !empresa_id || !rol) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
  }

  const adminSupabase = createAdminSupabase()

  // Check if user already exists in auth
  const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u) => u.email === email)

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    // Create new auth user
    const { data: newUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre || '' },
    })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
    userId = newUser.user.id
  }

  // Add empresa access
  const supabase = createServerSupabase()
  const { error: insertError } = await supabase
    .from('usuario_empresas')
    .insert({ user_id: userId, empresa_id, rol })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

  return NextResponse.json({ success: true, user_id: userId })
}

export async function PATCH(request: Request) {
  const { id, rol } = await request.json()
  if (!id || !rol) return NextResponse.json({ error: 'ID y rol requeridos' }, { status: 400 })
  const supabase = createServerSupabase()
  const { error } = await supabase.from('usuario_empresas').update({ rol }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const { id } = await request.json()
  const supabase = createServerSupabase()
  const { error } = await supabase.from('usuario_empresas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
