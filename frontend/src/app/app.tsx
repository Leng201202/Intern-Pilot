import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'
import { RouteLoading } from '@/components/layout/route-loading'
import { AuthProvider } from '@/features/auth/auth-provider'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { queryClient } from '@/lib/query-client'

const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))
const ApplicationsPage = lazy(
  () => import('@/features/applications/applications-page'),
)
const ApplicationEditorPage = lazy(
  () => import('@/features/applications/application-editor-page'),
)
const ApplicationDetailPage = lazy(
  () => import('@/features/applications/application-detail-page'),
)
const SignInPage = lazy(() => import('@/features/auth/sign-in-page'))
const ReviewPage = lazy(() => import('@/features/review/review-page'))
const ActivityPage = lazy(() => import('@/features/activity/activity-page'))
const ArchivePage = lazy(() => import('@/features/archive/archive-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))
const NotFoundPage = lazy(() => import('@/features/not-found/not-found-page'))

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="sign-in" element={<SignInPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="applications" element={<ApplicationsPage />} />
                  <Route
                    path="applications/new"
                    element={<ApplicationEditorPage />}
                  />
                  <Route
                    path="applications/:id/edit"
                    element={<ApplicationEditorPage />}
                  />
                  <Route
                    path="applications/:id"
                    element={<ApplicationDetailPage />}
                  />
                  <Route path="review" element={<ReviewPage />} />
                  <Route path="activity" element={<ActivityPage />} />
                  <Route path="archive" element={<ArchivePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
