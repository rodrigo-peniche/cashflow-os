-- Agregar sucursal_id a facturas (para asignación simple de una sola sucursal)
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);

-- Tabla de distribución para dividir facturas entre sucursales
CREATE TABLE IF NOT EXISTS factura_distribuciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES sucursales(id),
  monto NUMERIC(14,2) NOT NULL,
  porcentaje NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factura_distribuciones_factura ON factura_distribuciones(factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_distribuciones_sucursal ON factura_distribuciones(sucursal_id);
