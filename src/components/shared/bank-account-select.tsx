'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import type { CuentaBancaria } from '@/lib/types'

interface BankAccountSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
}

export function BankAccountSelect({ value, onValueChange, placeholder = 'Seleccionar cuenta' }: BankAccountSelectProps) {
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const { empresaId } = useEmpresa()

  useEffect(() => {
    if (!empresaId) return
    const supabase = createClient()
    supabase
      .from('cuentas_bancarias')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('activa', true)
      .order('nombre')
      .then(({ data }) => {
        if (data) setCuentas(data)
      })
  }, [empresaId])

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {cuentas.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nombre} — {c.banco}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
