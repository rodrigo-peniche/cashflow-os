-- Tabla de administradores de plataforma (super admins)
CREATE TABLE IF NOT EXISTS uno_cashflow.platform_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE uno_cashflow.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read their own record"
  ON uno_cashflow.platform_admins FOR SELECT
  USING (auth.uid() = user_id);

-- Agregar campo 'plan' y 'fecha_vencimiento_plan' a empresas para control de servicio
ALTER TABLE uno_cashflow.empresas
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial'
CHECK (plan IN ('trial', 'basico', 'profesional', 'enterprise'));

ALTER TABLE uno_cashflow.empresas
ADD COLUMN IF NOT EXISTS fecha_vencimiento_plan DATE;

ALTER TABLE uno_cashflow.empresas
ADD COLUMN IF NOT EXISTS max_usuarios INT NOT NULL DEFAULT 3;

ALTER TABLE uno_cashflow.empresas
ADD COLUMN IF NOT EXISTS notas_admin TEXT;

-- ============================================
-- IMPORTANTE: Después de ejecutar esta migración,
-- inserta tu user_id como platform admin:
--
-- INSERT INTO uno_cashflow.platform_admins (user_id)
-- VALUES ('TU-USER-ID-DE-SUPABASE');
--
-- Puedes encontrar tu user_id en la tabla auth.users
-- buscando por tu email.
-- ============================================
