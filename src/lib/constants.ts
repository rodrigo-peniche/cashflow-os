export const FLOW_COLORS = {
  ingreso_real: '#16a34a',
  ingreso_estimado: '#86efac',
  egreso_real: '#dc2626',
  egreso_estimado: '#fca5a5',
  saldo_positivo: '#1d4ed8',
  saldo_negativo: '#7f1d1d',
  neutro: '#6b7280',
} as const

export const MEXICAN_BANKS = [
  'BBVA',
  'Banorte',
  'Santander',
  'HSBC',
  'Scotiabank',
  'Citibanamex',
  'Banco Azteca',
  'BanCoppel',
  'Inbursa',
  'Banregio',
  'Afirme',
  'Multiva',
  'BanBajío',
  'Mifel',
  'Intercam',
  'Monex',
  'Otro',
] as const

export const RFC_REGEX = /^[A-Z]{3,4}\d{6}[A-Z0-9]{3}$/i
export const CLABE_REGEX = /^\d{18}$/

export function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}

export const CATEGORIAS_PAGO = [
  { value: 'nomina', label: 'Nómina' },
  { value: 'renta', label: 'Renta' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'otro', label: 'Otro' },
] as const

export const FRECUENCIAS = [
  { value: 'unico', label: 'Único' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
] as const
