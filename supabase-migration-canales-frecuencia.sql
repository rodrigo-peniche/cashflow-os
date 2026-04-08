-- Agregar frecuencia a canales_ingreso
ALTER TABLE uno_cashflow.canales_ingreso
ADD COLUMN IF NOT EXISTS frecuencia TEXT NOT NULL DEFAULT 'diario'
CHECK (frecuencia IN ('diario', 'semanal', 'quincenal', 'mensual'));
