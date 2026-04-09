-- =============================================
-- Módulo de Socios: Aportaciones y Gastos Personales
-- =============================================

-- Tabla de socios
CREATE TABLE IF NOT EXISTS uno_cashflow.socios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES uno_cashflow.empresas(id),
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  porcentaje_participacion NUMERIC(5,2),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de aportaciones
CREATE TABLE IF NOT EXISTS uno_cashflow.aportaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES uno_cashflow.empresas(id),
  socio_id UUID NOT NULL REFERENCES uno_cashflow.socios(id),
  monto NUMERIC(14,2) NOT NULL,
  fecha DATE NOT NULL,
  concepto TEXT,
  estatus TEXT NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'recibida', 'cancelada')),
  metodo_pago TEXT,
  comprobante_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de gastos personales con tarjeta de empresa
CREATE TABLE IF NOT EXISTS uno_cashflow.gastos_personales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES uno_cashflow.empresas(id),
  socio_id UUID NOT NULL REFERENCES uno_cashflow.socios(id),
  monto NUMERIC(14,2) NOT NULL,
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT DEFAULT 'otro' CHECK (categoria IN ('comida', 'transporte', 'entretenimiento', 'compras', 'servicios', 'otro')),
  estatus TEXT NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'descontado')),
  mes_descuento TEXT, -- formato: '2026-04' (año-mes cuando se descontará)
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_socios_empresa ON uno_cashflow.socios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_aportaciones_empresa ON uno_cashflow.aportaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_aportaciones_socio ON uno_cashflow.aportaciones(socio_id);
CREATE INDEX IF NOT EXISTS idx_gastos_personales_empresa ON uno_cashflow.gastos_personales(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gastos_personales_socio ON uno_cashflow.gastos_personales(socio_id);
CREATE INDEX IF NOT EXISTS idx_gastos_personales_mes ON uno_cashflow.gastos_personales(mes_descuento);

-- RLS
ALTER TABLE uno_cashflow.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE uno_cashflow.aportaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE uno_cashflow.gastos_personales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage socios of their empresas" ON uno_cashflow.socios
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM uno_cashflow.usuario_empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage aportaciones of their empresas" ON uno_cashflow.aportaciones
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM uno_cashflow.usuario_empresas WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage gastos_personales of their empresas" ON uno_cashflow.gastos_personales
  FOR ALL USING (
    empresa_id IN (SELECT empresa_id FROM uno_cashflow.usuario_empresas WHERE user_id = auth.uid())
  );
