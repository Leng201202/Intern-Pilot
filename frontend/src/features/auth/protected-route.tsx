import { Navigate, Outlet } from 'react-router-dom'

import { RouteLoading } from '@/components/layout/route-loading'
import { useAuth } from '@/features/auth/auth-context'

export function ProtectedRoute() {
  const auth = useAuth()

  if (auth.status === 'loading') return <RouteLoading />
  if (auth.status !== 'authenticated') return <Navigate replace to="/sign-in" />

  return <Outlet />
}
