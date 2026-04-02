'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Building2,
  CalendarClock,
  TrendingUpDown,
  LogOut,
  Menu,
  X,
  Settings,
  UserCog,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { EmpresaProvider, useEmpresa } from '@/lib/contexts/empresa-context'
import { EmpresaSwitcher } from '@/components/shared/empresa-switcher'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/proveedores', label: 'Proveedores', icon: Users },
  { href: '/ordenes', label: 'Órdenes de compra', icon: FileText },
  { href: '/facturas', label: 'Facturas', icon: Receipt },
  { href: '/bancos', label: 'Bancos', icon: Building2 },
  { href: '/pagos-programados', label: 'Pagos programados', icon: CalendarClock },
  { href: '/flujos', label: 'Flujos tentativos', icon: TrendingUpDown },
]

const ADMIN_NAV_ITEMS = [
  { href: '/empresas', label: 'Empresas', icon: Settings },
  { href: '/usuarios', label: 'Usuarios', icon: UserCog },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth/login')
        return
      }
      setAuthenticated(true)
      setLoading(false)
    })
  }, [router])

  if (loading || !authenticated) {
    return (
      <div className="flex h-screen">
        <Skeleton className="w-64 h-full" />
        <div className="flex-1 p-6"><Skeleton className="h-full" /></div>
      </div>
    )
  }

  return (
    <EmpresaProvider>
      <AdminShell>{children}</AdminShell>
    </EmpresaProvider>
  )
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { userRole, loading: empresaLoading } = useEmpresa()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (empresaLoading) {
    return (
      <div className="flex h-screen">
        <Skeleton className="w-64 h-full" />
        <div className="flex-1 p-6"><Skeleton className="h-full" /></div>
      </div>
    )
  }

  const allNavItems = userRole === 'admin'
    ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS]
    : NAV_ITEMS

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col transition-transform duration-200",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-4 border-b flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-lg">
            CashFlow OS
          </Link>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3 border-b">
          <EmpresaSwitcher />
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-30 bg-background border-b p-3 lg:hidden">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
