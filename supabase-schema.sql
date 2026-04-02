-- ============================================
-- CashFlow OS — Schema: uno_cashflow
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create schema
CREATE SCHEMA IF NOT EXISTS uno_cashflow;

-- 2. IMPORTANT: Expose the schema manually in Supabase Dashboard:
--    Settings → API → Exposed schemas → Add "uno_cashflow"
--    Then reload PostgREST:
NOTIFY pgrst, 'reload config';

-- 3. Grant usage to roles
GRANT USAGE ON SCHEMA uno_cashflow TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA uno_cashflow TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA uno_cashflow TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA uno_cashflow GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA uno_cashflow GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 4. Create tables

CREATE TABLE uno_cashflow.proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_empresa text NOT NULL,
  rfc text NOT NULL UNIQUE,
  contacto_nombre text NOT NULL,
  contacto_email text NOT NULL,
  telefono text,
  banco text NOT NULL,
  clabe text NOT NULL,
  cuenta text,
  token_acceso uuid UNIQUE DEFAULT gen_random_uuid(),
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE uno_cashflow.ordenes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_oc text NOT NULL UNIQUE,
  proveedor_id uuid REFERENCES uno_cashflow.proveedores(id),
  descripcion text,
  monto_total numeric(12,2) NOT NULL,
  fecha_emision date NOT NULL,
  fecha_esperada_entrega date,
  estatus text DEFAULT 'abierta' CHECK (estatus IN ('abierta','recibida','pagada','cancelada')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE uno_cashflow.facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid REFERENCES uno_cashflow.proveedores(id),
  orden_compra_id uuid REFERENCES uno_cashflow.ordenes_compra(id),
  numero_factura text NOT NULL,
  fecha_factura date NOT NULL,
  dias_credito integer NOT NULL DEFAULT 30,
  fecha_vencimiento date,
  subtotal numeric(12,2) NOT NULL,
  tipo_iva text NOT NULL CHECK (tipo_iva IN ('16','0','exento')),
  monto_iva numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL,
  pdf_url text,
  xml_url text,
  pdf_firmado_url text,
  estatus text DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','aprobada','programada','pagada','rechazada')),
  fecha_programada_pago date,
  notas text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE uno_cashflow.cuentas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  banco text NOT NULL,
  cuenta text NOT NULL,
  moneda text DEFAULT 'MXN',
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE uno_cashflow.saldos_bancarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id uuid REFERENCES uno_cashflow.cuentas_bancarias(id),
  fecha date NOT NULL,
  saldo numeric(14,2) NOT NULL,
  notas text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(cuenta_id, fecha)
);

CREATE TABLE uno_cashflow.pagos_programados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('nomina','renta','servicios','impuestos','otro')),
  es_fijo boolean DEFAULT true,
  monto numeric(12,2),
  monto_minimo numeric(12,2),
  monto_maximo numeric(12,2),
  frecuencia text NOT NULL CHECK (frecuencia IN ('unico','semanal','quincenal','mensual')),
  dia_del_mes integer,
  proxima_fecha date NOT NULL,
  cuenta_id uuid REFERENCES uno_cashflow.cuentas_bancarias(id),
  activo boolean DEFAULT true,
  notas text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE uno_cashflow.flujos_tentativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  descripcion text NOT NULL,
  monto numeric(12,2) NOT NULL,
  probabilidad integer DEFAULT 100 CHECK (probabilidad BETWEEN 0 AND 100),
  cuenta_id uuid REFERENCES uno_cashflow.cuentas_bancarias(id),
  realizado boolean DEFAULT false,
  monto_real numeric(12,2),
  notas text,
  created_at timestamptz DEFAULT now()
);

-- 5. Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('facturas-pdf', 'facturas-pdf', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('facturas-xml', 'facturas-xml', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('facturas-firmadas', 'facturas-firmadas', false) ON CONFLICT DO NOTHING;
