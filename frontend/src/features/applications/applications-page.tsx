import { Download, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useApplications } from '@/features/applications/application-data'
import {
  APPLICATION_STATUSES,
  downloadApplicationsCsv,
  formatDate,
  statusLabel,
} from '@/features/applications/application-utils'
import type { ApplicationStatus } from '@/lib/supabase/database.types'

export default function ApplicationsPage() {
  const applicationsQuery = useApplications()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ApplicationStatus | 'all'>('all')
  const visibleApplications = useMemo(() => {
    const applications = applicationsQuery.data ?? []
    const needle = search.trim().toLocaleLowerCase()
    return applications.filter(
      (application) =>
        !application.archived_at &&
        (status === 'all' || application.status === status) &&
        (!needle ||
          application.company_name.toLocaleLowerCase().includes(needle) ||
          application.position_title.toLocaleLowerCase().includes(needle)),
    )
  }, [applicationsQuery.data, search, status])

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button asChild>
            <Link to="/applications/new">
              <Plus aria-hidden="true" className="size-4" /> Add application
            </Link>
          </Button>
        }
        description="Search, filter, and manage the internships you entered manually."
        eyebrow="Tracker"
        title="Applications"
      />
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Search applications</span>
              <Search
                aria-hidden="true"
                className="text-muted-foreground absolute top-3 left-3 size-4"
              />
              <input
                className="border-border bg-background focus-visible:ring-ring h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search company or position"
                type="search"
                value={search}
              />
            </label>
            <select
              aria-label="Filter by status"
              className="border-border bg-background focus-visible:ring-ring h-10 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2"
              onChange={(event) =>
                setStatus(event.target.value as ApplicationStatus | 'all')
              }
              value={status}
            >
              <option value="all">All statuses</option>
              {APPLICATION_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              disabled={visibleApplications.length === 0}
              onClick={() =>
                downloadApplicationsCsv(
                  visibleApplications,
                  'internpilot-applications.csv',
                )
              }
              type="button"
              variant="outline"
            >
              <Download aria-hidden="true" className="size-4" /> Export CSV
            </Button>
          </div>
          {applicationsQuery.isPending ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Loading applications…
            </p>
          ) : applicationsQuery.isError ? (
            <p className="text-destructive py-10 text-center text-sm">
              Applications could not be loaded. Please refresh and try again.
            </p>
          ) : visibleApplications.length === 0 ? (
            <div className="border-border rounded-xl border border-dashed px-6 py-12 text-center">
              <p className="font-semibold">No matching applications</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Add an application or adjust the current filters.
              </p>
            </div>
          ) : (
            <div className="divide-border divide-y">
              {visibleApplications.map((application) => (
                <Link
                  className="hover:bg-muted/60 -mx-2 flex flex-col gap-3 rounded-lg px-3 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
                  key={application.id}
                  to={`/applications/${application.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {application.position_title}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-sm">
                      {application.company_name}
                      {application.location ? ` · ${application.location}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">Applied</p>
                      <p>{formatDate(application.application_date)}</p>
                    </div>
                    <Badge>{statusLabel(application.status)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
