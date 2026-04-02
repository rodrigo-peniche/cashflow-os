import { cookies } from 'next/headers'

export function getEmpresaId(): string {
  const cookieStore = cookies()
  const empresaId = cookieStore.get('empresa_id')?.value
  if (!empresaId) throw new Error('No empresa selected')
  return empresaId
}

export function getEmpresaIdFromRequest(request: Request): string {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(/empresa_id=([^;]+)/)
  if (!match) throw new Error('No empresa selected')
  return decodeURIComponent(match[1])
}
