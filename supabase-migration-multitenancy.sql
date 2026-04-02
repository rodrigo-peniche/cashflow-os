-- Migration: Multi-tenancy support
-- Run this in Supabase SQL Editor AFTER supabase-migration-portal.sql

-- ============================================================
-- 1. Create empresas table
-- ============================================================
CREATE TABLE IF NOT EXISTS uno_cashflow.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rfc_empresa text,
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. Create usuario_empresas junction table
-- ============================================================
CREATE TABLE IF NOT EXISTS uno_cashflow.usuario_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES uno_cashflow.empresas(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('admin', 'editor', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_empresas_user ON uno_cashflow.usuario_empresas(user_id);
CREATE INDEX IF NOT EXISTS idx_usuario_empresas_empresa ON uno_cashflow.usuario_empresas(empresa_id);

-- ============================================================
-- 3. Add empresa_id to all 7 existing tables
-- ============================================================
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES uno_cashflow.empresas(id);
ALTER TABLE uno_cashflow.ordenes_compra ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES uno_cashflow.empresas(id);
ALTER TABLE uno_cashflow.facturas ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES uno_cashflow.empresas(id);
ALTER TABLE uno_cashflow.cuentas_bancarias ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES uno_cashflow.empresas(id);
ALTER TABLE uno_cashflow.saldos_bancarios ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES uno_cashflow.empresas(id);
ALTER TABLE uno_cashflow.pagos_programados ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES uno_cashflow.empresas(id);
ALTER TABLE uno_cashflow.flujos_tentativos ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES uno_cashflow.empresas(id);

-- ============================================================
-- 4. Create default empresa and backfill existing data
--    IMPORTANT: Run this block, then copy the generated UUID
--    and use it to create your admin user in usuario_empresas
-- ============================================================
DO $$
DECLARE
  default_empresa_id uuid;
BEGIN
  INSERT INTO uno_cashflow.empresas (nombre, rfc_empresa)
  VALUES ('Mi Empresa', NULL)
  RETURNING id INTO default_empresa_id;

  RAISE NOTICE 'Default empresa ID: %', default_empresa_id;

  UPDATE uno_cashflow.proveedores SET empresa_id = default_empresa_id WHERE empresa_id IS NULL;
  UPDATE uno_cashflow.ordenes_compra SET empresa_id = default_empresa_id WHERE empresa_id IS NULL;
  UPDATE uno_cashflow.facturas SET empresa_id = default_empresa_id WHERE empresa_id IS NULL;
  UPDATE uno_cashflow.cuentas_bancarias SET empresa_id = default_empresa_id WHERE empresa_id IS NULL;
  UPDATE uno_cashflow.saldos_bancarios SET empresa_id = default_empresa_id WHERE empresa_id IS NULL;
  UPDATE uno_cashflow.pagos_programados SET empresa_id = default_empresa_id WHERE empresa_id IS NULL;
  UPDATE uno_cashflow.flujos_tentativos SET empresa_id = default_empresa_id WHERE empresa_id IS NULL;
END $$;

-- ============================================================
-- 5. Make empresa_id NOT NULL after backfill
-- ============================================================
ALTER TABLE uno_cashflow.proveedores ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE uno_cashflow.ordenes_compra ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE uno_cashflow.facturas ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE uno_cashflow.cuentas_bancarias ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE uno_cashflow.saldos_bancarios ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE uno_cashflow.pagos_programados ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE uno_cashflow.flujos_tentativos ALTER COLUMN empresa_id SET NOT NULL;

-- ============================================================
-- 6. Fix UNIQUE constraints for multi-tenancy
--    Same RFC/OC can exist in different empresas
-- ============================================================
ALTER TABLE uno_cashflow.proveedores DROP CONSTRAINT IF EXISTS proveedores_rfc_key;
ALTER TABLE uno_cashflow.ordenes_compra DROP CONSTRAINT IF EXISTS ordenes_compra_numero_oc_key;

ALTER TABLE uno_cashflow.proveedores ADD CONSTRAINT proveedores_rfc_empresa_unique UNIQUE(rfc, empresa_id);
ALTER TABLE uno_cashflow.ordenes_compra ADD CONSTRAINT ordenes_compra_numero_oc_empresa_unique UNIQUE(numero_oc, empresa_id);

-- ============================================================
-- 7. Create indexes for empresa_id queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_proveedores_empresa ON uno_cashflow.proveedores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_empresa ON uno_cashflow.ordenes_compra(empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_empresa ON uno_cashflow.facturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_bancarias_empresa ON uno_cashflow.cuentas_bancarias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_saldos_bancarios_empresa ON uno_cashflow.saldos_bancarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pagos_programados_empresa ON uno_cashflow.pagos_programados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_flujos_tentativos_empresa ON uno_cashflow.flujos_tentativos(empresa_id);

-- ============================================================
-- 8. MANUAL STEP: Create your admin user
--    After running this migration:
--    1. Go to Supabase Dashboard > Authentication > Users
--    2. Click "Add user" > create with your email/password
--    3. Copy the user UUID
--    4. Run this (replace the UUIDs):
--
--    INSERT INTO uno_cashflow.usuario_empresas (user_id, empresa_id, rol)
--    VALUES ('YOUR_AUTH_USER_UUID', 'YOUR_EMPRESA_UUID', 'admin');
-- ============================================================
