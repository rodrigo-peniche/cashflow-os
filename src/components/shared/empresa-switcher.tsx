'use client'

import { useEmpresa } from '@/lib/contexts/empresa-context'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Building2 } from 'lucide-react'

export function EmpresaSwitcher() {
  const { empresaId, empresas, userRole, setEmpresa } = useEmpresa()

  if (empresas.length === 0) return null

  if (empresas.length === 1) {
    return (
      <div className="px-3 py-2 rounded-md bg-muted/50">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{empresas[0].nombre}</span>
        </div>
        {userRole && (
          <Badge variant="outline" className="mt-1 text-xs">{userRole}</Badge>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Select value={empresaId || ''} onValueChange={setEmpresa}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <SelectValue placeholder="Seleccionar empresa" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {empresas.map((e) => (
            <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {userRole && (
        <Badge variant="outline" className="text-xs">{userRole}</Badge>
      )}
    </div>
  )
}
