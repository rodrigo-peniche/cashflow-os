-- Migration: Ingresos diarios por sucursal y canal
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. Sucursales (branches)
-- ============================================================
CREATE TABLE IF NOT EXISTS uno_cashflow.sucursales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES uno_cashflow.empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id, nombre)
);

ALTER TABLE uno_cashflow.sucursales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sucursales_all" ON uno_cashflow.sucursales FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Canales de ingreso (payment channels)
-- ============================================================
CREATE TABLE IF NOT EXISTS uno_cashflow.canales_ingreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES uno_cashflow.empresas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  dia_deposito text, -- 'lunes','martes','miercoles','jueves','viernes','sabado','domingo' or NULL
  monto_aproximado numeric, -- approximate deposit amount
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id, nombre)
);

ALTER TABLE uno_cashflow.canales_ingreso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canales_ingreso_all" ON uno_cashflow.canales_ingreso FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Ingresos diarios (daily income per branch + channel)
-- ============================================================
CREATE TABLE IF NOT EXISTS uno_cashflow.ingresos_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES uno_cashflow.empresas(id) ON DELETE CASCADE,
  sucursal_id uuid NOT NULL REFERENCES uno_cashflow.sucursales(id) ON DELETE CASCADE,
  canal_id uuid NOT NULL REFERENCES uno_cashflow.canales_ingreso(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sucursal_id, canal_id, fecha)
);

ALTER TABLE uno_cashflow.ingresos_diarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingresos_diarios_all" ON uno_cashflow.ingresos_diarios FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sucursales_empresa ON uno_cashflow.sucursales(empresa_id);
CREATE INDEX IF NOT EXISTS idx_canales_empresa ON uno_cashflow.canales_ingreso(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_empresa_fecha ON uno_cashflow.ingresos_diarios(empresa_id, fecha);
CREATE INDEX IF NOT EXISTS idx_ingresos_sucursal_fecha ON uno_cashflow.ingresos_diarios(sucursal_id, fecha);
