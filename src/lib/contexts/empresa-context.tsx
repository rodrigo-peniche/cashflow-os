'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Empresa, UserRole } from '@/lib/types'

interface EmpresaContextType {
  empresaId: string | null
  empresas: Empresa[]
  userRole: UserRole | null
  loading: boolean
  error: string | null
  setEmpresa: (id: string) => void
}

const EmpresaContext = createContext<EmpresaContextType>({
  empresaId: null,
  empresas: [],
  userRole: null,
  loading: true,
  error: null,
  setEmpresa: () => {},
})

export function useEmpresa() {
  return useContext(EmpresaContext)
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
}

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          setError('No hay sesión activa. Ve a /auth/login para ingresar.')
          setLoading(false)
          return
        }

        // Fetch user's company access
        const { data: accesos, error: accessError } = await supabase
          .from('usuario_empresas')
          .select('empresa_id, rol, empresas(*)')
          .eq('user_id', user.id)

        if (accessError) {
          setError(`Error al cargar empresas: ${accessError.message}`)
          setLoading(false)
          return
        }

        if (!accesos || accesos.length === 0) {
          setError('Tu usuario no tiene empresas asignadas. Contacta al administrador.')
          setLoading(false)
          return
        }

        const empresasList = accesos
          .map((a) => a.empresas as unknown as Empresa)
          .filter(Boolean)

        if (empresasList.length === 0) {
          setError('No se encontraron empresas válidas.')
          setLoading(false)
          return
        }

        setEmpresas(empresasList)

        // Check saved cookie
        const savedId = getCookie('empresa_id')
        const validSaved = savedId && empresasList.some((e) => e.id === savedId)
        const selectedId = validSaved ? savedId! : empresasList[0].id

        setEmpresaId(selectedId)
        setCookie('empresa_id', selectedId)

        // Set role for selected empresa
        const acceso = accesos.find((a) => a.empresa_id === selectedId)
        setUserRole((acceso?.rol as UserRole) || null)

        setLoading(false)
      } catch (err) {
        setError(`Error inesperado: ${err}`)
        setLoading(false)
      }
    }
    load()
  }, [])

  const setEmpresa = useCallback((id: string) => {
    setEmpresaId(id)
    setCookie('empresa_id', id)
    window.location.reload()
  }, [])

  return (
    <EmpresaContext.Provider value={{ empresaId, empresas, userRole, loading, error, setEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  )
}
