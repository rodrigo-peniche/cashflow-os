'use client'

import { Input } from '@/components/ui/input'
import { forwardRef, useState } from 'react'

interface MoneyInputProps {
  value?: number | string
  onChange?: (value: number) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  name?: string
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, placeholder = '$0.00', disabled, className, ...props }, ref) => {
    const [display, setDisplay] = useState(() => {
      if (value !== undefined && value !== '' && value !== null) {
        return formatDisplay(Number(value))
      }
      return ''
    })

    function formatDisplay(num: number): string {
      if (isNaN(num)) return ''
      return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num)
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value.replace(/[^0-9.]/g, '')
      const parts = raw.split('.')
      const cleaned = parts[0] + (parts.length > 1 ? '.' + parts[1]?.slice(0, 2) : '')
      setDisplay(cleaned)
      const num = parseFloat(cleaned)
      if (!isNaN(num)) {
        onChange?.(num)
      } else if (cleaned === '') {
        onChange?.(0)
      }
    }

    function handleBlur() {
      const num = parseFloat(display.replace(/,/g, ''))
      if (!isNaN(num)) {
        setDisplay(formatDisplay(num))
      }
    }

    function handleFocus() {
      if (value !== undefined && value !== '' && value !== null) {
        setDisplay(String(Number(value)))
      }
    }

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-7 ${className ?? ''}`}
          {...props}
        />
      </div>
    )
  }
)
MoneyInput.displayName = 'MoneyInput'
