-- Add cuenta_bancaria_id to aportaciones
ALTER TABLE uno_cashflow.aportaciones
ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID REFERENCES uno_cashflow.cuentas_bancarias(id);
