-- Migration: Add proveedor_id to pagos_programados
ALTER TABLE uno_cashflow.pagos_programados
ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES uno_cashflow.proveedores(id);
