'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ProveedorOption {
  id: string
  nombre_empresa: string
  rfc?: string
}

interface ProveedorComboboxProps {
  proveedores: ProveedorOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
}

export function ProveedorCombobox({ proveedores, value, onValueChange, placeholder = 'Seleccionar proveedor...' }: ProveedorComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = proveedores.find(p => p.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? (
            <span className="truncate">{selected.nombre_empresa}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar proveedor..." />
          <CommandList>
            <CommandEmpty>No se encontró proveedor.</CommandEmpty>
            <CommandGroup>
              {proveedores.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.nombre_empresa} ${p.rfc || ''}`}
                  onSelect={() => {
                    onValueChange(p.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === p.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{p.nombre_empresa}</span>
                  {p.rfc && <span className="ml-auto text-xs text-muted-foreground">{p.rfc}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
