-- Migration: Créditos module
-- Tables for tracking company credits/loans and their payments

CREATE TABLE IF NOT EXISTS creditos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'credito',
  institucion VARCHAR(255),
  monto_original NUMERIC(14,2) NOT NULL,
  saldo_actual NUMERIC(14,2) NOT NULL,
  tasa_interes NUMERIC(6,4),
  fecha_inicio DATE,
  fecha_vencimiento DATE,
  pago_mensual NUMERIC(14,2),
  dia_pago INTEGER,
  estatus VARCHAR(20) NOT NULL DEFAULT 'activo',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credito_pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credito_id UUID NOT NULL REFERENCES creditos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  monto_capital NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_interes NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_total NUMERIC(14,2) NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE credito_pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view creditos of their empresa"
  ON creditos FOR SELECT
  USING (empresa_id IN (
    SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert creditos for their empresa"
  ON creditos FOR INSERT
  WITH CHECK (empresa_id IN (
    SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update creditos of their empresa"
  ON creditos FOR UPDATE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete creditos of their empresa"
  ON creditos FOR DELETE
  USING (empresa_id IN (
    SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view credito_pagos of their empresa"
  ON credito_pagos FOR SELECT
  USING (credito_id IN (
    SELECT id FROM creditos WHERE empresa_id IN (
      SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert credito_pagos for their empresa"
  ON credito_pagos FOR INSERT
  WITH CHECK (credito_id IN (
    SELECT id FROM creditos WHERE empresa_id IN (
      SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can update credito_pagos of their empresa"
  ON credito_pagos FOR UPDATE
  USING (credito_id IN (
    SELECT id FROM creditos WHERE empresa_id IN (
      SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete credito_pagos of their empresa"
  ON credito_pagos FOR DELETE
  USING (credito_id IN (
    SELECT id FROM creditos WHERE empresa_id IN (
      SELECT empresa_id FROM usuario_empresa WHERE user_id = auth.uid()
    )
  ));
