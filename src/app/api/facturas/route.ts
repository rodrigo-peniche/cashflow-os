import { createServerSupabase } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/get-empresa'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerSupabase()

  let empresaId: string
  try {
    empresaId = getEmpresaId()
  } catch {
    return NextResponse.json({ error: 'No empresa selected' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('facturas')
    .select('*, proveedores(nombre_empresa), ordenes_compra(numero_oc)')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = createServerSupabase()
  const { id, ...updates } = await request.json()
  const { data, error } = await supabase
    .from('facturas')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
