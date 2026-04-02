-- Migration: Supplier portal enhancements
-- Run this in Supabase SQL Editor

-- 1. Add password to proveedores
ALTER TABLE uno_cashflow.proveedores ADD COLUMN IF NOT EXISTS password_hash text;

-- 2. Add comprobante de pago to facturas
ALTER TABLE uno_cashflow.facturas ADD COLUMN IF NOT EXISTS comprobante_pago_url text;

-- 3. Add observaciones field to facturas (admin comments visible to supplier)
ALTER TABLE uno_cashflow.facturas ADD COLUMN IF NOT EXISTS observaciones text;

-- 4. Create storage bucket for comprobantes
INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes-pago', 'comprobantes-pago', false) ON CONFLICT DO NOTHING;
