'use client'

import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { formatMXN } from '@/lib/constants'

interface IVACalculatorProps {
  subtotal: number
  tipoIva: '16' | '0' | 'exento'
  onTipoIvaChange: (tipo: '16' | '0' | 'exento') => void
}

export function IVACalculator({ subtotal, tipoIva, onTipoIvaChange }: IVACalculatorProps) {
  const montoIva = tipoIva === '16' ? subtotal * 0.16 : 0
  const total = subtotal + montoIva

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">Tipo de IVA</Label>
        <RadioGroup
          value={tipoIva}
          onValueChange={(val) => onTipoIvaChange(val as '16' | '0' | 'exento')}
          className="flex gap-4 mt-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="16" id="iva-16" />
            <Label htmlFor="iva-16" className="cursor-pointer">16%</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="0" id="iva-0" />
            <Label htmlFor="iva-0" className="cursor-pointer">0%</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="exento" id="iva-exento" />
            <Label htmlFor="iva-exento" className="cursor-pointer">Exento</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 p-3">
        <div>
          <p className="text-xs text-muted-foreground">Subtotal</p>
          <p className="font-semibold">{formatMXN(subtotal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">IVA</p>
          <p className="font-semibold">{formatMXN(montoIva)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold text-primary">{formatMXN(total)}</p>
        </div>
      </div>
    </div>
  )
}
