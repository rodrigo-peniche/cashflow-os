-- =============================================================
-- MIGRACIÓN: Mover todas las tablas de uno_cashflow a public
-- =============================================================
-- Motivo: PostgREST no reconoce el schema uno_cashflow a pesar
-- de estar configurado como exposed. Mover a public resuelve esto.
-- =============================================================

-- Paso 1: Mover tablas que NO tienen foreign keys a otras tablas
ALTER TABLE IF EXISTS uno_cashflow.empresas SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.platform_admins SET SCHEMA public;

-- Paso 2: Tablas con FKs simples
ALTER TABLE IF EXISTS uno_cashflow.usuario_empresas SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.cuentas_bancarias SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.proveedores SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.sucursales SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.socios SET SCHEMA public;

-- Paso 3: Tablas que dependen de las anteriores
ALTER TABLE IF EXISTS uno_cashflow.saldos_bancarios SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.ordenes_compra SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.facturas SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.pagos_programados SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.flujos_tentativos SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.aportaciones SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.gastos_personales SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.canales_ingreso SET SCHEMA public;
ALTER TABLE IF EXISTS uno_cashflow.ingresos_diarios SET SCHEMA public;

-- Verificar que todo se movió
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'uno_cashflow';
-- ^ Esto debería retornar 0 filas
