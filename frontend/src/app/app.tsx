import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'
import { RouteLoading } from '@/components/layout/route-loading'

const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))
const ApplicationsPage = lazy(
  () => import('@/features/applications/applications-page'),
)
const ReviewPage = lazy(() => import('@/features/review/review-page'))
const ActivityPage = lazy(() => import('@/features/activity/activity-page'))
const ArchivePage = lazy(() => import('@/features/archive/archive-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))
const NotFoundPage = lazy(() => import('@/features/not-found/not-found-page'))

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="archive" element={<ArchivePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
