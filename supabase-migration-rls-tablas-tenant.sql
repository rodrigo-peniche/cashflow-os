-- =============================================================
-- MIGRACIÓN: Políticas RLS para el resto de las tablas del tenant
-- =============================================================
-- Mismo problema que empresas/usuario_empresas: RLS activo con cero
-- políticas. Los datos existen (140 proveedores, 83 facturas,
-- 155 ingresos_diarios...) pero la app los lee vacíos.
--
-- Requiere haber corrido supabase-migration-rls-empresas.sql antes:
-- usa las funciones cashflow_mis_empresas() y cashflow_es_platform_admin().
--
-- La lista de tablas es EXPLÍCITA a propósito. El schema public es
-- compartido con otras aplicaciones; nada fuera de esta lista se toca.
-- =============================================================

DO $do$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'proveedores', 'ordenes_compra', 'facturas', 'cuentas_bancarias',
    'saldos_bancarios', 'pagos_programados', 'flujos_tentativos',
    'socios', 'aportaciones', 'gastos_personales',
    'sucursales', 'canales_ingreso', 'ingresos_diarios',
    'creditos', 'credito_pagos'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    -- La tabla puede no existir en todos los despliegues
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'omitida (no existe): %', t;
      CONTINUE;
    END IF;

    -- Sin empresa_id no se puede aislar por tenant: mejor avisar que adivinar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'empresa_id'
    ) THEN
      RAISE WARNING 'omitida (sin empresa_id): %', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Políticas permisivas de migraciones viejas (USING (true)): quitarlas,
    -- en una base compartida dejan la tabla abierta a cualquier sesión.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'cashflow_' || t || '_tenant', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL TO authenticated
        USING (
          empresa_id IN (SELECT public.cashflow_mis_empresas())
          OR public.cashflow_es_platform_admin()
        )
        WITH CHECK (
          empresa_id IN (SELECT public.cashflow_mis_empresas())
          OR public.cashflow_es_platform_admin()
        )
    $f$, 'cashflow_' || t || '_tenant', t);

    RAISE NOTICE 'politica OK: %', t;
  END LOOP;
END
$do$;

-- ============================================================
-- factura_distribuciones: no tiene empresa_id, hereda de su factura
-- ============================================================
DO $do$
BEGIN
  IF to_regclass('public.factura_distribuciones') IS NULL THEN
    RAISE NOTICE 'omitida (no existe): factura_distribuciones';
    RETURN;
  END IF;

  ALTER TABLE public.factura_distribuciones ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS cashflow_factura_distribuciones_tenant ON public.factura_distribuciones;
  CREATE POLICY cashflow_factura_distribuciones_tenant ON public.factura_distribuciones
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.facturas f
        WHERE f.id = factura_distribuciones.factura_id
          AND (f.empresa_id IN (SELECT public.cashflow_mis_empresas())
               OR public.cashflow_es_platform_admin())
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.facturas f
        WHERE f.id = factura_distribuciones.factura_id
          AND (f.empresa_id IN (SELECT public.cashflow_mis_empresas())
               OR public.cashflow_es_platform_admin())
      )
    );
END
$do$;
