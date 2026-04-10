-- Migration: Add fecha_compromiso to aportaciones for tracking expected contribution dates
ALTER TABLE uno_cashflow.aportaciones
ADD COLUMN IF NOT EXISTS fecha_compromiso DATE;

-- Add comment
COMMENT ON COLUMN uno_cashflow.aportaciones.fecha_compromiso IS 'Fecha comprometida para realizar la aportación';
