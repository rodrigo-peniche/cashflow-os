-- =============================================================
-- MIGRACIÓN: Políticas RLS para empresas y usuario_empresas
-- =============================================================
-- Problema: ambas tablas quedaron con RLS activo y CERO políticas.
-- PostgREST no devuelve error en ese caso: devuelve 0 filas. Por eso
-- empresa-context.tsx muestra "Tu usuario no tiene empresas asignadas"
-- aunque la fila exista en la tabla.
--
-- Las funciones usan SECURITY DEFINER para evitar la recursión infinita
-- (error 42P17) que provoca una política de usuario_empresas que se
-- consulta a sí misma.
--
-- Nombres prefijados con cashflow_ porque la base es compartida.
-- =============================================================

-- ============================================================
-- 1. Funciones helper (SECURITY DEFINER: se saltan RLS por dentro)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cashflow_mis_empresas()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $$
  SELECT empresa_id FROM public.usuario_empresas WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.cashflow_es_platform_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.cashflow_es_admin_de(p_empresa uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_empresas
    WHERE user_id = auth.uid() AND empresa_id = p_empresa AND rol = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.cashflow_es_admin_de_alguna()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_empresas
    WHERE user_id = auth.uid() AND rol = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.cashflow_mis_empresas(),
                            public.cashflow_es_platform_admin(),
                            public.cashflow_es_admin_de(uuid),
                            public.cashflow_es_admin_de_alguna() FROM public;
GRANT EXECUTE ON FUNCTION public.cashflow_mis_empresas(),
                          public.cashflow_es_platform_admin(),
                          public.cashflow_es_admin_de(uuid),
                          public.cashflow_es_admin_de_alguna() TO authenticated;

-- ============================================================
-- 2. usuario_empresas
-- ============================================================
ALTER TABLE public.usuario_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashflow_usuario_empresas_select ON public.usuario_empresas;
CREATE POLICY cashflow_usuario_empresas_select ON public.usuario_empresas
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR empresa_id IN (SELECT public.cashflow_mis_empresas())
    OR public.cashflow_es_platform_admin()
  );

DROP POLICY IF EXISTS cashflow_usuario_empresas_write ON public.usuario_empresas;
CREATE POLICY cashflow_usuario_empresas_write ON public.usuario_empresas
  FOR ALL TO authenticated
  USING (public.cashflow_es_platform_admin() OR public.cashflow_es_admin_de(empresa_id))
  WITH CHECK (public.cashflow_es_platform_admin() OR public.cashflow_es_admin_de(empresa_id));

-- ============================================================
-- 3. empresas
-- ============================================================
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashflow_empresas_select ON public.empresas;
CREATE POLICY cashflow_empresas_select ON public.empresas
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT public.cashflow_mis_empresas())
    OR public.cashflow_es_platform_admin()
  );

-- INSERT: la página /empresas permite crear empresas con el cliente del
-- navegador. Se restringe a quien ya es admin de alguna empresa.
DROP POLICY IF EXISTS cashflow_empresas_insert ON public.empresas;
CREATE POLICY cashflow_empresas_insert ON public.empresas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.cashflow_es_platform_admin()
    OR public.cashflow_es_admin_de_alguna()
  );

DROP POLICY IF EXISTS cashflow_empresas_update ON public.empresas;
CREATE POLICY cashflow_empresas_update ON public.empresas
  FOR UPDATE TO authenticated
  USING (public.cashflow_es_platform_admin() OR public.cashflow_es_admin_de(id))
  WITH CHECK (public.cashflow_es_platform_admin() OR public.cashflow_es_admin_de(id));

-- NOTA: no se crea política de DELETE para empresas. Borrar una empresa
-- queda solo para el service_role (rutas de servidor), que ignora RLS.
