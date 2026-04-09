'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BookOpen, Download, ExternalLink, ChevronDown, ChevronRight,
  LayoutDashboard, Users, FileText, Receipt, Building2, CalendarClock,
  DollarSign, TrendingUp, HandCoins, CreditCard, Settings, UserCog, Shield,
  Upload, Search, Filter, MousePointer,
} from 'lucide-react'

interface Section {
  id: string
  title: string
  icon: React.ReactNode
  adminOnly?: boolean
  platformOnly?: boolean
  content: React.ReactNode
}

function CollapsibleSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  return (
    <Card id={section.id}>
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="flex items-center gap-3 text-lg">
          {open ? <ChevronDown className="h-5 w-5 shrink-0" /> : <ChevronRight className="h-5 w-5 shrink-0" />}
          <span className="flex items-center gap-2">
            {section.icon}
            {section.title}
          </span>
          {section.adminOnly && <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">Admin</Badge>}
          {section.platformOnly && <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700">Plataforma</Badge>}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 prose prose-sm max-w-none">
          {section.content}
        </CardContent>
      )}
    </Card>
  )
}

export default function ManualPage() {
  const [allOpen, setAllOpen] = useState(false)

  const sections: Section[] = [
    {
      id: 'inicio',
      title: 'Primeros pasos',
      icon: <BookOpen className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Bienvenido a CashFlow OS</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CashFlow OS es un sistema de gestión de flujo de efectivo diseñado para empresas que necesitan controlar sus ingresos, egresos, facturas, proveedores y proyecciones financieras.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Crear cuenta</h4>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Ve a la página de <strong>Crear cuenta</strong> desde la pantalla de login</li>
              <li>Ingresa tu nombre, email, contraseña, nombre de empresa y RFC</li>
              <li>Se creará tu cuenta y tu empresa automáticamente</li>
              <li>Inicia sesión con tu email y contraseña</li>
            </ol>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Roles de usuario</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 shrink-0">Admin</Badge>
                <span className="text-muted-foreground">Acceso completo: crear, editar, eliminar datos. Gestionar usuarios y empresas.</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 shrink-0">Editor</Badge>
                <span className="text-muted-foreground">Puede crear y editar datos, pero no gestionar usuarios ni empresas.</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-gray-50 text-gray-700 shrink-0">Viewer</Badge>
                <span className="text-muted-foreground">Solo puede ver información, sin permisos de edición.</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Cambiar de empresa</h4>
            <p className="text-sm text-muted-foreground">
              Si tienes acceso a múltiples empresas, usa el <strong>selector de empresa</strong> en la parte superior de la barra lateral para cambiar entre ellas. Todos los datos se filtran automáticamente por la empresa seleccionada.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            El dashboard muestra una proyección de flujo de efectivo de <strong>15 días</strong>, combinando ingresos reales, ingresos estimados, egresos programados y egresos estimados.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Tarjetas resumen</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Saldo actual</strong> — Saldo bancario más reciente registrado</li>
              <li><strong>Egresos próx. 15 días</strong> — Total de pagos programados y estimados</li>
              <li><strong>Ingresos esperados</strong> — Total de ingresos reales y estimados</li>
              <li><strong>Saldo mínimo proyectado</strong> — El punto más bajo del saldo en los próximos 15 días</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Tabla de flujo</h4>
            <p className="text-sm text-muted-foreground">
              Muestra día por día: saldo inicial, ingresos reales, ingresos estimados, egresos programados, egresos estimados y saldo final. <strong>Pasa el mouse sobre cualquier monto</strong> para ver el desglose de qué facturas o conceptos lo componen.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Gráfica</h4>
            <p className="text-sm text-muted-foreground">
              Gráfica de barras apiladas con ingresos (positivos) y egresos (negativos), con una línea de tendencia del saldo proyectado.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'proveedores',
      title: 'Proveedores',
      icon: <Users className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Catálogo de proveedores con información bancaria, contacto y condiciones de pago.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Campos principales</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Nombre empresa, RFC, ID Banco</strong> — Identificación del proveedor</li>
              <li><strong>Contacto</strong> — Nombre, email, teléfono</li>
              <li><strong>Datos bancarios</strong> — Banco, CLABE, cuenta, titular, tipo de cuenta</li>
              <li><strong>Días crédito</strong> — Plazo de pago por defecto</li>
              <li><strong>Modalidad de pago</strong> — Factura primero o pago primero</li>
              <li><strong>Giro</strong> — Descripción del servicio/producto que ofrece</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> Carga masiva</h4>
            <p className="text-sm text-muted-foreground">
              Descarga la plantilla Excel, llénala con los datos de tus proveedores y súbela. El sistema detecta duplicados por RFC.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Portal de proveedores</h4>
            <p className="text-sm text-muted-foreground">
              Cada proveedor tiene un <strong>link único</strong> (token de acceso) para subir sus facturas directamente al sistema sin necesidad de crear una cuenta.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'ordenes',
      title: 'Órdenes de compra',
      icon: <FileText className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Registro de órdenes de compra vinculadas a proveedores. Permite dar seguimiento desde la emisión hasta el pago.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Estatus disponibles</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">Abierta</Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700">Recibida</Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700">Pagada</Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700">Cancelada</Badge>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Campos</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Número OC</strong> — Identificador único de la orden</li>
              <li><strong>Proveedor</strong> — Vinculado al catálogo de proveedores</li>
              <li><strong>Monto total, Descripción</strong></li>
              <li><strong>Fecha emisión y fecha esperada de entrega</strong></li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'facturas',
      title: 'Facturas',
      icon: <Receipt className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Control completo de facturas por pagar. Haz clic en cualquier fila para expandir el panel de detalle.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Panel de detalle (expandible)</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>IVA</strong> — Editable: 16%, 0%, Exento. Al cambiarlo se recalcula el total automáticamente</li>
              <li><strong>Días crédito</strong> — Editable: al cambiarlo se recalcula la fecha de vencimiento</li>
              <li><strong>Subtotal, Vencimiento, OC vinculada, Documentos</strong> (PDF, XML, Comprobante)</li>
              <li><strong>Situación</strong> — Vigente, Vence hoy, Vence en Xd, Vencida (Xd)</li>
              <li><strong>Estatus</strong> — Cambiar entre: Pendiente, Aprobada, Programada, Pagada, Rechazada</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Programar pago</h4>
            <p className="text-sm text-muted-foreground">
              Selecciona una fecha de las burbujas (hoy + 10 días) o usa el calendario para una fecha personalizada. Esto programa el pago y lo refleja en el dashboard.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Observaciones</h4>
            <p className="text-sm text-muted-foreground">
              Agrega notas a cada factura. Las observaciones se muestran en un recuadro azul visible al expandir la factura.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Asignar proveedor</h4>
            <p className="text-sm text-muted-foreground">
              Si una factura fue importada sin proveedor vinculado, puedes asignar uno existente o crear uno nuevo directamente desde el panel.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> Carga masiva</h4>
            <p className="text-sm text-muted-foreground">
              Importa facturas desde Excel. El sistema vincula automáticamente proveedores por ID Banco o nombre. Si no encuentra el proveedor, guarda el nombre en observaciones para asignación manual.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'bancos',
      title: 'Bancos',
      icon: <Building2 className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Administra tus cuentas bancarias y registra saldos periódicamente para alimentar las proyecciones del dashboard.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Cuentas bancarias</h4>
            <p className="text-sm text-muted-foreground">
              Registra cada cuenta con nombre, banco, número de cuenta y moneda. Las cuentas se usan como referencia en pagos programados y flujos tentativos.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Saldos bancarios</h4>
            <p className="text-sm text-muted-foreground">
              Registra el saldo de cada cuenta con fecha. El saldo más reciente se usa como <strong>saldo inicial</strong> en el dashboard. Es importante actualizarlo frecuentemente para proyecciones precisas.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'pagos-programados',
      title: 'Pagos programados',
      icon: <CalendarClock className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pagos recurrentes o únicos que se reflejan como egresos en el dashboard.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Categorías</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Nómina</Badge>
              <Badge variant="outline">Renta</Badge>
              <Badge variant="outline">Servicios</Badge>
              <Badge variant="outline">Impuestos</Badge>
              <Badge variant="outline">Otro</Badge>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Frecuencia</h4>
            <p className="text-sm text-muted-foreground">
              <strong>Único</strong> (una sola vez), <strong>Semanal</strong>, <strong>Quincenal</strong> o <strong>Mensual</strong>. Configura el día del mes para pagos mensuales.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Montos fijos vs. variables</h4>
            <p className="text-sm text-muted-foreground">
              Los pagos fijos tienen un monto exacto. Los variables tienen un rango (mínimo/máximo) y el sistema usa el promedio para proyecciones.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'ingresos',
      title: 'Ingresos diarios',
      icon: <DollarSign className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Registro de ingresos diarios por sucursal y canal de ingreso. Los ingresos alimentan la proyección del dashboard.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Configuración</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Sucursales</strong> — Crea las sucursales de tu empresa</li>
              <li><strong>Canales de ingreso</strong> — Efectivo, Tarjeta, Clip, TPV, Uber, Rappi, Transferencia, Cheque, MercadoPago, PayPal u Otro</li>
              <li><strong>Frecuencia</strong> — Diario, Semanal, Quincenal o Mensual</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Registro</h4>
            <p className="text-sm text-muted-foreground">
              Se muestra una tabla con días como columnas y canales por sucursal como filas. Haz clic en cualquier celda para ingresar el monto del día.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'flujos',
      title: 'Flujos tentativos',
      icon: <TrendingUp className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ingresos o egresos que <strong>podrían</strong> ocurrir pero no están confirmados. Se muestran con estilo punteado en el dashboard.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Campos</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Tipo</strong> — Ingreso o Egreso</li>
              <li><strong>Fecha, Descripción, Monto</strong></li>
              <li><strong>Probabilidad</strong> — De 0 a 100%. Afecta el peso en la proyección</li>
              <li><strong>Cuenta bancaria</strong> — Opcional, para vincular a una cuenta específica</li>
              <li><strong>Realizado</strong> — Marcar cuando se confirme el flujo</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'aportaciones',
      title: 'Aportaciones de socios',
      icon: <HandCoins className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Control de las aportaciones de capital que hacen los socios de la empresa.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Socios</h4>
            <p className="text-sm text-muted-foreground">
              Primero registra a los socios con nombre, email, teléfono y porcentaje de participación. Luego puedes registrar sus aportaciones.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Tipos de aportación</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">A cuenta</Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700">Efectivo</Badge>
              <Badge variant="outline" className="bg-gray-50 text-gray-700">Otro</Badge>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Estatus</h4>
            <p className="text-sm text-muted-foreground">
              Cada aportación puede estar <strong>Pendiente</strong> o <strong>Recibida</strong>. Las tarjetas de resumen muestran totales por socio y por estatus.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> Carga masiva</h4>
            <p className="text-sm text-muted-foreground">
              Importa aportaciones desde Excel. El sistema vincula cada fila con el socio correspondiente por nombre.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'gastos-tarjeta',
      title: 'Gastos tarjeta empresa',
      icon: <CreditCard className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Registro de gastos personales que los socios hacen con la tarjeta de crédito de la empresa, para descontarlos de su nómina a fin de mes.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Categorías</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Comida</Badge>
              <Badge variant="outline">Transporte</Badge>
              <Badge variant="outline">Entretenimiento</Badge>
              <Badge variant="outline">Compras</Badge>
              <Badge variant="outline">Servicios</Badge>
              <Badge variant="outline">Otro</Badge>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Vista mensual</h4>
            <p className="text-sm text-muted-foreground">
              Navega por mes para ver los gastos de cada socio. Las tarjetas de resumen muestran el total pendiente por descontar y el ya descontado.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Descontar</h4>
            <p className="text-sm text-muted-foreground">
              Marca gastos individuales como &quot;descontado&quot; o usa el botón <strong>&quot;Descontar todo&quot;</strong> por socio para marcar todos los gastos pendientes del mes de un solo clic.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'empresas',
      title: 'Gestión de empresas',
      icon: <Settings className="h-5 w-5" />,
      adminOnly: true,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Administra la configuración de tu empresa. Solo visible para usuarios con rol <strong>Admin</strong>.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Datos de empresa</h4>
            <p className="text-sm text-muted-foreground">
              Nombre, RFC y configuración general de la empresa.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'usuarios',
      title: 'Gestión de usuarios',
      icon: <UserCog className="h-5 w-5" />,
      adminOnly: true,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Invita y gestiona los usuarios que tienen acceso a tu empresa. Solo visible para <strong>Admin</strong>.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Crear usuario</h4>
            <p className="text-sm text-muted-foreground">
              Ingresa email y contraseña del nuevo usuario, asigna un rol (admin, editor, viewer) y se le dará acceso a la empresa actual.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Cambiar rol</h4>
            <p className="text-sm text-muted-foreground">
              Cambia el rol de cualquier usuario directamente desde la tabla.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'plataforma',
      title: 'Panel de plataforma',
      icon: <Shield className="h-5 w-5" />,
      platformOnly: true,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Panel de super administrador para gestionar todas las empresas registradas en la plataforma. Solo visible para <strong>administradores de plataforma</strong>.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Funciones</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><strong>Activar/Desactivar empresas</strong> — Bloquea acceso en caso de falta de pago</li>
              <li><strong>Plan</strong> — Asignar plan (trial, básico, profesional, enterprise)</li>
              <li><strong>Máximo de usuarios</strong> — Limitar cuántos usuarios puede tener cada empresa</li>
              <li><strong>Fecha de vencimiento</strong> — Controlar vigencia del servicio</li>
              <li><strong>Notas internas</strong> — Agregar notas administrativas sobre cada empresa</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'funciones-generales',
      title: 'Funciones generales',
      icon: <MousePointer className="h-5 w-5" />,
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> Importar desde Excel</h4>
            <p className="text-sm text-muted-foreground">
              Disponible en: Proveedores, Facturas, Órdenes de compra, Cuentas bancarias, Saldos, Pagos programados, Flujos tentativos, Aportaciones y Gastos personales.
            </p>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Haz clic en el botón <strong>&quot;Importar Excel&quot;</strong></li>
              <li>Descarga la plantilla con el botón correspondiente</li>
              <li>Llena la plantilla con tus datos (la primera fila es ejemplo, puedes borrarla)</li>
              <li>Sube el archivo .xlsx</li>
            </ol>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Download className="h-4 w-4" /> Exportar datos</h4>
            <p className="text-sm text-muted-foreground">
              En la mayoría de las páginas encontrarás un botón de exportar con dos opciones: <strong>Excel (.xlsx)</strong> y <strong>CSV</strong>. Se exportan los datos filtrados actualmente en pantalla.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros y búsqueda</h4>
            <p className="text-sm text-muted-foreground">
              Usa la barra de búsqueda para filtrar por texto y los selectores de estatus para filtrar por estado. Las columnas de las tablas son ordenables haciendo clic en los encabezados.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Search className="h-4 w-4" /> Ordenar columnas</h4>
            <p className="text-sm text-muted-foreground">
              Haz clic en el encabezado de cualquier columna para ordenar ascendente. Clic otra vez para descendente. Un tercer clic quita el ordenamiento.
            </p>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Manual de usuario
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setAllOpen(!allOpen)}>
            {allOpen ? 'Colapsar todo' : 'Expandir todo'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-2" /> Descargar PDF
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://docs.google.com/document/d/1placeholder" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> Ver en Google Docs
            </a>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Guía completa de todos los módulos de CashFlow OS. Haz clic en cada sección para expandirla.
      </p>

      {/* Table of contents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contenido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded hover:bg-muted"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                {s.icon}
                {s.title}
                {s.adminOnly && <Badge variant="outline" className="text-[10px] py-0 bg-blue-50 text-blue-700">Admin</Badge>}
                {s.platformOnly && <Badge variant="outline" className="text-[10px] py-0 bg-purple-50 text-purple-700">Plataforma</Badge>}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          allOpen ? (
            <Card key={section.id} id={section.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <span className="flex items-center gap-2">
                    {section.icon}
                    {section.title}
                  </span>
                  {section.adminOnly && <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">Admin</Badge>}
                  {section.platformOnly && <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700">Plataforma</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 prose prose-sm max-w-none">
                {section.content}
              </CardContent>
            </Card>
          ) : (
            <CollapsibleSection key={section.id} section={section} />
          )
        ))}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          nav, .sidebar, header, [data-sidebar], button { display: none !important; }
          .space-y-4 > div { break-inside: avoid; }
          * { color: black !important; background: white !important; }
        }
      `}</style>
    </div>
  )
}
