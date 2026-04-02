import * as XLSX from 'xlsx'

export interface ExcelColumnDef {
  header: string
  key: string
  example: string
  required?: boolean
}

export interface ExcelTemplate {
  sheetName: string
  columns: ExcelColumnDef[]
  tableName: string
}

export const TEMPLATES: Record<string, ExcelTemplate> = {
  proveedores: {
    sheetName: 'Proveedores',
    tableName: 'proveedores',
    columns: [
      { header: 'Nombre Empresa', key: 'nombre_empresa', example: 'Acme S.A. de C.V.', required: true },
      { header: 'RFC', key: 'rfc', example: 'ACM010101ABC', required: true },
      { header: 'Contacto Nombre', key: 'contacto_nombre', example: 'Juan Pérez', required: true },
      { header: 'Contacto Email', key: 'contacto_email', example: 'juan@acme.com', required: true },
      { header: 'Teléfono', key: 'telefono', example: '5512345678' },
      { header: 'Banco', key: 'banco', example: 'BBVA', required: true },
      { header: 'CLABE', key: 'clabe', example: '012345678901234567', required: true },
      { header: 'Cuenta', key: 'cuenta', example: '1234567890' },
    ],
  },
  ordenes: {
    sheetName: 'Órdenes de Compra',
    tableName: 'ordenes_compra',
    columns: [
      { header: 'Número OC', key: 'numero_oc', example: 'OC-001', required: true },
      { header: 'RFC Proveedor', key: '_rfc_proveedor', example: 'ACM010101ABC', required: true },
      { header: 'Descripción', key: 'descripcion', example: 'Material de oficina' },
      { header: 'Monto Total', key: 'monto_total', example: '15000.00', required: true },
      { header: 'Fecha Emisión (YYYY-MM-DD)', key: 'fecha_emision', example: '2026-04-01', required: true },
      { header: 'Fecha Esperada Entrega (YYYY-MM-DD)', key: 'fecha_esperada_entrega', example: '2026-04-15' },
    ],
  },
  facturas: {
    sheetName: 'Facturas',
    tableName: 'facturas',
    columns: [
      { header: 'Número Factura', key: 'numero_factura', example: 'FAC-001', required: true },
      { header: 'RFC Proveedor', key: '_rfc_proveedor', example: 'ACM010101ABC', required: true },
      { header: 'Número OC (opcional)', key: '_numero_oc', example: 'OC-001' },
      { header: 'Fecha Factura (YYYY-MM-DD)', key: 'fecha_factura', example: '2026-04-01', required: true },
      { header: 'Días Crédito', key: 'dias_credito', example: '30', required: true },
      { header: 'Subtotal', key: 'subtotal', example: '10000.00', required: true },
      { header: 'Tipo IVA (16, 0, exento)', key: 'tipo_iva', example: '16', required: true },
      { header: 'Notas', key: 'notas', example: '' },
    ],
  },
  cuentas_bancarias: {
    sheetName: 'Cuentas Bancarias',
    tableName: 'cuentas_bancarias',
    columns: [
      { header: 'Nombre', key: 'nombre', example: 'Cuenta Principal', required: true },
      { header: 'Banco', key: 'banco', example: 'BBVA', required: true },
      { header: 'Número Cuenta', key: 'cuenta', example: '0123456789', required: true },
      { header: 'Moneda', key: 'moneda', example: 'MXN' },
    ],
  },
  saldos: {
    sheetName: 'Saldos Bancarios',
    tableName: 'saldos_bancarios',
    columns: [
      { header: 'Nombre Cuenta', key: '_nombre_cuenta', example: 'Cuenta Principal', required: true },
      { header: 'Fecha (YYYY-MM-DD)', key: 'fecha', example: '2026-04-01', required: true },
      { header: 'Saldo', key: 'saldo', example: '150000.00', required: true },
      { header: 'Notas', key: 'notas', example: '' },
    ],
  },
  pagos_programados: {
    sheetName: 'Pagos Programados',
    tableName: 'pagos_programados',
    columns: [
      { header: 'Nombre', key: 'nombre', example: 'Renta oficina', required: true },
      { header: 'Categoría (nomina/renta/servicios/impuestos/otro)', key: 'categoria', example: 'renta', required: true },
      { header: 'Es Fijo (SI/NO)', key: 'es_fijo', example: 'SI', required: true },
      { header: 'Monto', key: 'monto', example: '25000.00' },
      { header: 'Monto Mínimo', key: 'monto_minimo', example: '' },
      { header: 'Monto Máximo', key: 'monto_maximo', example: '' },
      { header: 'Frecuencia (unico/semanal/quincenal/mensual)', key: 'frecuencia', example: 'mensual', required: true },
      { header: 'Día del Mes', key: 'dia_del_mes', example: '1' },
      { header: 'Próxima Fecha (YYYY-MM-DD)', key: 'proxima_fecha', example: '2026-05-01', required: true },
      { header: 'Nombre Cuenta (opcional)', key: '_nombre_cuenta', example: 'Cuenta Principal' },
      { header: 'Notas', key: 'notas', example: '' },
    ],
  },
  flujos: {
    sheetName: 'Flujos Tentativos',
    tableName: 'flujos_tentativos',
    columns: [
      { header: 'Fecha (YYYY-MM-DD)', key: 'fecha', example: '2026-04-10', required: true },
      { header: 'Tipo (ingreso/egreso)', key: 'tipo', example: 'ingreso', required: true },
      { header: 'Descripción', key: 'descripcion', example: 'Pago cliente X', required: true },
      { header: 'Monto', key: 'monto', example: '50000.00', required: true },
      { header: 'Probabilidad (0-100)', key: 'probabilidad', example: '80' },
      { header: 'Nombre Cuenta (opcional)', key: '_nombre_cuenta', example: 'Cuenta Principal' },
      { header: 'Notas', key: 'notas', example: '' },
    ],
  },
}

export function downloadTemplate(templateKey: string) {
  const template = TEMPLATES[templateKey]
  if (!template) return

  const wb = XLSX.utils.book_new()

  // Header row + example row
  const headers = template.columns.map((c) => c.header)
  const examples = template.columns.map((c) => c.example)

  const ws = XLSX.utils.aoa_to_sheet([headers, examples])

  // Set column widths
  ws['!cols'] = template.columns.map((c) => ({ wch: Math.max(c.header.length, c.example.length, 15) }))

  XLSX.utils.book_append_sheet(wb, ws, template.sheetName)
  XLSX.writeFile(wb, `plantilla_${templateKey}.xlsx`)
}

export function parseExcelFile(file: File): Promise<Record<string, string | number>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws)
        resolve(json)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function mapRowsToColumns(
  rows: Record<string, string | number>[],
  template: ExcelTemplate
): Record<string, unknown>[] {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {}
    template.columns.forEach((col) => {
      const value = row[col.header]
      if (value !== undefined && value !== '') {
        mapped[col.key] = value
      }
    })
    return mapped
  })
}
