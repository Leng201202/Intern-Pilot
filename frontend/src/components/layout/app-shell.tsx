import {
  Archive,
  BellRing,
  BriefcaseBusiness,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { isSupabaseConfigured } from '@/lib/supabase/client'

const navigation: ReadonlyArray<{
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}> = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Applications', to: '/applications', icon: BriefcaseBusiness },
  { label: 'Review', to: '/review', icon: ClipboardCheck },
  { label: 'Activity', to: '/activity', icon: BellRing },
  { label: 'Archive', to: '/archive', icon: Archive },
  { label: 'Settings', to: '/settings', icon: Settings },
]

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      aria-label={mobile ? 'Mobile navigation' : 'Primary navigation'}
      className={cn(
        mobile ? 'flex gap-1 overflow-x-auto px-4 pb-3' : 'space-y-1 px-3',
      )}
    >
      {navigation.map(({ end, icon: Icon, label, to }) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
          end={end}
          key={to}
          to={to}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  return (
    <div className="bg-muted/40 min-h-svh">
      <aside className="border-border bg-background fixed inset-y-0 left-0 z-20 hidden w-64 border-r md:flex md:flex-col">
        <div className="flex h-20 items-center gap-3 px-6">
          <div className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-xl shadow-sm">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="font-semibold tracking-tight">InternPilot AI</p>
            <p className="text-muted-foreground text-xs">Private workspace</p>
          </div>
        </div>

        <Navigation />

        <div className="border-border mt-auto border-t p-4">
          <div className="bg-muted rounded-xl p-3">
            <p className="text-foreground text-xs font-semibold">Phase 0</p>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              Foundation only. Live data and integrations are not enabled.
            </p>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="md:hidden">
              <p className="font-semibold tracking-tight">InternPilot AI</p>
              <p className="text-muted-foreground text-xs">Private workspace</p>
            </div>
            <div className="hidden md:block">
              <p className="text-muted-foreground text-sm">
                Internship application workspace
              </p>
            </div>
            <Badge variant={isSupabaseConfigured ? 'default' : 'warning'}>
              {isSupabaseConfigured ? 'Supabase configured' : 'Local setup'}
            </Badge>
          </div>
          <div className="md:hidden">
            <Navigation mobile />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
