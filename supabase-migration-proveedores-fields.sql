-- Migration: Expand proveedores with additional fields
-- Run this in Supabase SQL Editor AFTER supabase-migration-multitenancy.sql

-- ============================================================
-- 1. Add new columns to proveedores
-- ============================================================

-- ID del portal bancario (ej: PROV016)
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS id_banco text;

-- Titular de la cuenta bancaria
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS titular text;

-- Tipo de cuenta (ej: Debito CLABE OB, Cheques, etc.)
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS tipo_cuenta text;

-- Moneda (MXP, USD, etc.)
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS moneda text DEFAULT 'MXP';

-- Días de crédito del proveedor
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS dias_credito integer DEFAULT 0;

-- Requiere concepto específico al pagar (true/false)
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS requiere_concepto boolean DEFAULT false;

-- Giro o descripción del proveedor (ej: PAN TORTILLA Y HARINA)
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS giro text;

-- Modalidad de pago: si primero factura o primero se paga
-- Valores: 'factura_primero' (SE PAGA CON FACTURA) | 'pago_primero' (SE PAGA SIN FACTURA)
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS modalidad_pago text DEFAULT 'factura_primero'
  CHECK (modalidad_pago IN ('factura_primero', 'pago_primero'));

-- ============================================================
-- 2. Add unique constraint for id_banco per empresa
-- ============================================================
ALTER TABLE uno_cashflow.proveedores
  ADD CONSTRAINT proveedores_id_banco_empresa_unique
  UNIQUE(id_banco, empresa_id);
