import { createServerSupabase } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/get-empresa'
import { NextResponse } from 'next/server'
import { addDays, addWeeks, format, isSameDay, parseISO } from 'date-fns'
import type { FlujoDiario, FlujoDiarioItem } from '@/lib/types'

function getRecurrences(
  proximaFecha: string,
  frecuencia: string,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const dates: Date[] = []
  let current = parseISO(proximaFecha)

  // Generate occurrences within the 15-day range
  for (let i = 0; i < 60; i++) {
    if (current > rangeEnd) break
    if (current >= rangeStart) {
      dates.push(current)
    }

    switch (frecuencia) {
      case 'unico':
        return dates
      case 'semanal':
        current = addWeeks(current, 1)
        break
      case 'quincenal':
        current = addWeeks(current, 2)
        break
      case 'mensual':
        current = addDays(current, 30)
        break
      default:
        return dates
    }
  }
  return dates
}

export async function GET() {
  const supabase = createServerSupabase()

  let empresaId: string
  try {
    empresaId = getEmpresaId()
  } catch {
    return NextResponse.json({ error: 'No empresa selected' }, { status: 400 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const days: FlujoDiario[] = []

  // Fetch all required data in parallel
  const [
    { data: facturasPendientes },
    { data: facturasVencidas },
    { data: facturasProgramadas },
    { data: pagos },
    { data: flujos },
    { data: cuentas },
  ] = await Promise.all([
    supabase
      .from('facturas')
      .select('*, proveedores(nombre_empresa)')
      .eq('empresa_id', empresaId)
      .in('estatus', ['pendiente', 'aprobada'])
      .gte('fecha_vencimiento', format(today, 'yyyy-MM-dd'))
      .lte('fecha_vencimiento', format(addDays(today, 14), 'yyyy-MM-dd')),
    supabase
      .from('facturas')
      .select('*, proveedores(nombre_empresa)')
      .eq('empresa_id', empresaId)
      .in('estatus', ['pendiente', 'aprobada'])
      .lt('fecha_vencimiento', format(today, 'yyyy-MM-dd')),
    supabase
      .from('facturas')
      .select('*, proveedores(nombre_empresa)')
      .eq('empresa_id', empresaId)
      .eq('estatus', 'programada')
      .gte('fecha_programada_pago', format(today, 'yyyy-MM-dd'))
      .lte('fecha_programada_pago', format(addDays(today, 14), 'yyyy-MM-dd')),
    supabase
      .from('pagos_programados')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('activo', true),
    supabase
      .from('flujos_tentativos')
      .select('*')
      .eq('empresa_id', empresaId)
      .gte('fecha', format(today, 'yyyy-MM-dd'))
      .lte('fecha', format(addDays(today, 14), 'yyyy-MM-dd')),
    supabase
      .from('cuentas_bancarias')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('activa', true),
  ])

  // Get opening balance: sum of most recent saldo from each active account
  let openingBalance = 0
  if (cuentas) {
    const balancePromises = cuentas.map(async (c) => {
      const { data } = await supabase
        .from('saldos_bancarios')
        .select('saldo')
        .eq('cuenta_id', c.id)
        .order('fecha', { ascending: false })
        .limit(1)
        .single()
      return data?.saldo || 0
    })
    const balances = await Promise.all(balancePromises)
    openingBalance = balances.reduce((sum, b) => sum + Number(b), 0)
  }

  // Combine pending/approved + programmed facturas
  const facturas = [...(facturasPendientes || []), ...(facturasProgramadas || [])]

  const rangeEnd = addDays(today, 14)

  for (let i = 0; i < 15; i++) {
    const date = addDays(today, i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const items: FlujoDiarioItem[] = []

    let ingreso_real = 0
    let ingreso_estimado = 0
    let egreso_real = 0
    let egreso_estimado = 0

    // --- INVOICES ---
    facturas.forEach((f) => {
      // Programadas use fecha_programada_pago, others use fecha_vencimiento
      const fechaRelevante = f.estatus === 'programada' && f.fecha_programada_pago
        ? f.fecha_programada_pago
        : f.fecha_vencimiento
      if (fechaRelevante !== dateStr) return
      const provNombre = (f as unknown as Record<string, Record<string, string>>).proveedores?.nombre_empresa || f.numero_factura

      if (f.estatus === 'aprobada' || f.estatus === 'programada') {
        egreso_real += Number(f.total)
        items.push({
          tipo: 'egreso_real',
          descripcion: provNombre,
          monto: Number(f.total),
          origen: 'factura',
        })
      } else if (f.estatus === 'pendiente') {
        egreso_estimado += Number(f.total)
        items.push({
          tipo: 'egreso_estimado',
          descripcion: provNombre,
          monto: Number(f.total),
          origen: 'factura',
        })
      }
    })

    // --- SCHEDULED PAYMENTS ---
    pagos?.forEach((p) => {
      const occurrences = getRecurrences(p.proxima_fecha, p.frecuencia, today, rangeEnd)
      occurrences.forEach((occ) => {
        if (!isSameDay(occ, date)) return

        if (p.es_fijo && p.monto) {
          egreso_real += Number(p.monto)
          items.push({
            tipo: 'egreso_real',
            descripcion: p.nombre,
            monto: Number(p.monto),
            origen: 'pago_programado',
          })
        } else if (p.monto_minimo && p.monto_maximo) {
          const avg = (Number(p.monto_minimo) + Number(p.monto_maximo)) / 2
          egreso_estimado += avg
          items.push({
            tipo: 'egreso_estimado',
            descripcion: `${p.nombre} (aprox.)`,
            monto: avg,
            origen: 'pago_programado',
          })
        }
      })
    })

    // --- TENTATIVE FLOWS ---
    flujos?.forEach((f) => {
      if (f.fecha !== dateStr) return

      if (f.tipo === 'ingreso') {
        if (f.probabilidad === 100 && f.realizado) {
          const amount = Number(f.monto_real || f.monto)
          ingreso_real += amount
          items.push({
            tipo: 'ingreso_real',
            descripcion: f.descripcion,
            monto: amount,
            origen: 'flujo_tentativo',
          })
        } else {
          ingreso_estimado += Number(f.monto)
          items.push({
            tipo: 'ingreso_estimado',
            descripcion: f.descripcion,
            monto: Number(f.monto),
            origen: 'flujo_tentativo',
          })
        }
      } else {
        // egreso
        if (f.probabilidad < 100) {
          egreso_estimado += Number(f.monto)
          items.push({
            tipo: 'egreso_estimado',
            descripcion: f.descripcion,
            monto: Number(f.monto),
            origen: 'flujo_tentativo',
          })
        } else {
          egreso_real += Number(f.monto)
          items.push({
            tipo: 'egreso_real',
            descripcion: f.descripcion,
            monto: Number(f.monto),
            origen: 'flujo_tentativo',
          })
        }
      }
    })

    const saldo_inicial = i === 0 ? openingBalance : days[i - 1].saldo_final
    const saldo_final = saldo_inicial + ingreso_real + ingreso_estimado - egreso_real - egreso_estimado

    days.push({
      fecha: dateStr,
      saldo_inicial,
      ingreso_real,
      ingreso_estimado,
      egreso_real,
      egreso_estimado,
      saldo_final,
      items,
    })
  }

  // Build overdue items
  const overdueItems: FlujoDiarioItem[] = []
  let overdueTotal = 0
  facturasVencidas?.forEach((f) => {
    const provNombre = (f as unknown as Record<string, Record<string, string>>).proveedores?.nombre_empresa || f.numero_factura
    const monto = Number(f.total)
    overdueTotal += monto
    overdueItems.push({
      tipo: 'egreso_estimado',
      descripcion: provNombre,
      monto,
      origen: 'factura',
    })
  })

  return NextResponse.json({
    days,
    overdue: {
      total: overdueTotal,
      items: overdueItems,
    },
  })
}
