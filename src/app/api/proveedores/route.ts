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
    .from('proveedores')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nombre_empresa')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServerSupabase()
  const body = await request.json()
  const { data, error } = await supabase
    .from('proveedores')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
