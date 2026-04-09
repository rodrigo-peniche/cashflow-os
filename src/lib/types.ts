export interface Empresa {
  id: string
  nombre: string
  rfc_empresa: string | null
  activa: boolean
  plan: string
  fecha_vencimiento_plan: string | null
  max_usuarios: number
  notas_admin: string | null
  created_at: string
}

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface UsuarioEmpresa {
  id: string
  user_id: string
  empresa_id: string
  rol: UserRole
  created_at: string
  empresas?: Empresa
}

export type ModalidadPago = 'factura_primero' | 'pago_primero'

export interface Proveedor {
  id: string
  empresa_id: string
  nombre_empresa: string
  id_banco: string | null
  rfc: string
  contacto_nombre: string
  contacto_email: string
  telefono: string | null
  banco: string
  clabe: string
  cuenta: string | null
  titular: string | null
  tipo_cuenta: string | null
  moneda: string
  dias_credito: number
  requiere_concepto: boolean
  giro: string | null
  modalidad_pago: ModalidadPago
  token_acceso: string
  activo: boolean
  created_at: string
}

export interface OrdenCompra {
  id: string
  empresa_id: string
  numero_oc: string
  proveedor_id: string
  descripcion: string | null
  monto_total: number
  fecha_emision: string
  fecha_esperada_entrega: string | null
  estatus: 'abierta' | 'recibida' | 'pagada' | 'cancelada'
  created_at: string
  proveedores?: Proveedor
}

export interface Factura {
  id: string
  empresa_id: string
  proveedor_id: string
  orden_compra_id: string | null
  numero_factura: string
  fecha_factura: string
  dias_credito: number
  fecha_vencimiento: string | null
  subtotal: number
  tipo_iva: '16' | '0' | 'exento'
  monto_iva: number
  total: number
  pdf_url: string | null
  xml_url: string | null
  pdf_firmado_url: string | null
  estatus: 'pendiente' | 'aprobada' | 'programada' | 'pagada' | 'rechazada'
  fecha_programada_pago: string | null
  notas: string | null
  created_at: string
  proveedores?: Proveedor
  ordenes_compra?: OrdenCompra
}

export interface CuentaBancaria {
  id: string
  empresa_id: string
  nombre: string
  banco: string
  cuenta: string
  moneda: string
  activa: boolean
  created_at: string
}

export interface SaldoBancario {
  id: string
  empresa_id: string
  cuenta_id: string
  fecha: string
  saldo: number
  notas: string | null
  created_at: string
  cuentas_bancarias?: CuentaBancaria
}

export interface PagoProgramado {
  id: string
  empresa_id: string
  nombre: string
  categoria: 'nomina' | 'renta' | 'servicios' | 'impuestos' | 'otro'
  es_fijo: boolean
  monto: number | null
  monto_minimo: number | null
  monto_maximo: number | null
  frecuencia: 'unico' | 'semanal' | 'quincenal' | 'mensual'
  dia_del_mes: number | null
  proxima_fecha: string
  cuenta_id: string | null
  activo: boolean
  notas: string | null
  created_at: string
  cuentas_bancarias?: CuentaBancaria
}

export interface FlujoTentativo {
  id: string
  empresa_id: string
  fecha: string
  tipo: 'ingreso' | 'egreso'
  descripcion: string
  monto: number
  probabilidad: number
  cuenta_id: string | null
  realizado: boolean
  monto_real: number | null
  notas: string | null
  created_at: string
  cuentas_bancarias?: CuentaBancaria
}

export interface Sucursal {
  id: string
  empresa_id: string
  nombre: string
  activa: boolean
  created_at: string
}

export type FrecuenciaIngreso = 'diario' | 'semanal' | 'quincenal' | 'mensual'

export interface CanalIngreso {
  id: string
  empresa_id: string
  nombre: string
  frecuencia: FrecuenciaIngreso
  dia_deposito: string | null
  monto_aproximado: number | null
  activo: boolean
  created_at: string
}

export interface IngresoDiario {
  id: string
  empresa_id: string
  sucursal_id: string
  canal_id: string
  fecha: string
  monto: number
  notas: string | null
  created_at: string
}

export interface FlujoDiario {
  fecha: string
  saldo_inicial: number
  ingreso_real: number
  ingreso_estimado: number
  egreso_real: number
  egreso_estimado: number
  saldo_final: number
  items: FlujoDiarioItem[]
}

export interface FlujoDiarioItem {
  tipo: 'ingreso_real' | 'ingreso_estimado' | 'egreso_real' | 'egreso_estimado'
  descripcion: string
  monto: number
  origen: string
}

export interface Socio {
  id: string
  empresa_id: string
  nombre: string
  email: string | null
  telefono: string | null
  porcentaje_participacion: number | null
  activo: boolean
  created_at: string
}

export interface Aportacion {
  id: string
  empresa_id: string
  socio_id: string
  monto: number
  fecha: string
  concepto: string | null
  estatus: 'pendiente' | 'recibida' | 'cancelada'
  metodo_pago: string | null
  comprobante_url: string | null
  notas: string | null
  created_at: string
  socios?: Socio
}

export type CategoriaGasto = 'comida' | 'transporte' | 'entretenimiento' | 'compras' | 'servicios' | 'otro'

export interface GastoPersonal {
  id: string
  empresa_id: string
  socio_id: string
  monto: number
  fecha: string
  descripcion: string
  categoria: CategoriaGasto
  estatus: 'pendiente' | 'descontado'
  mes_descuento: string | null
  notas: string | null
  created_at: string
  socios?: Socio
}
