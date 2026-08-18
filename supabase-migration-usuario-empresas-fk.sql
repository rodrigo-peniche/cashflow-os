-- =============================================================
-- MIGRACIÓN: Limpieza e integridad de usuario_empresas
-- =============================================================
-- usuario_empresas.user_id nunca tuvo foreign key contra auth.users,
-- así que aceptaba cualquier UUID. En producción quedaron filas con
-- user_id que no corresponde a ningún usuario, incluida una donde se
-- pegó el UUID de la empresa en la columna user_id (el paso 8 de
-- supabase-migration-multitenancy.sql pide copiar dos UUIDs a mano).
--
-- IMPORTANTE: revisa qué se va a borrar ANTES de correr el DELETE.
-- =============================================================

-- 1. Revisión previa: estas son las filas que el DELETE eliminará
SELECT ue.id, ue.user_id, ue.empresa_id, ue.rol, ue.created_at,
       (ue.user_id = ue.empresa_id) AS pego_el_uuid_de_la_empresa
FROM public.usuario_empresas ue
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ue.user_id);

-- 2. Borrar asignaciones que apuntan a usuarios inexistentes
DELETE FROM public.usuario_empresas ue
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ue.user_id);

-- 3. Impedir que vuelva a pasar
ALTER TABLE public.usuario_empresas
  DROP CONSTRAINT IF EXISTS usuario_empresas_user_id_fkey;

ALTER TABLE public.usuario_empresas
  ADD CONSTRAINT usuario_empresas_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
