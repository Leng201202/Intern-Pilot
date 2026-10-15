import {
  BriefcaseBusiness,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Plus,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  useAllHistory,
  useOpenFollowUps,
  useReviewItems,
  useSyncRuns,
} from '@/features/activity/activity-data'
import { useApplications } from '@/features/applications/application-data'
import {
  APPLICATION_STATUSES,
  CLOSED_STATUSES,
  formatDate,
  statusLabel,
} from '@/features/applications/application-utils'
import {
  useGmailConnection,
  useSyncEmails,
} from '@/features/settings/gmail-data'

export default function DashboardPage() {
  const applicationsQuery = useApplications()
  const reviewQuery = useReviewItems()
  const followUpsQuery = useOpenFollowUps()
  const historyQuery = useAllHistory()
  const syncRunsQuery = useSyncRuns()
  const gmailQuery = useGmailConnection()
  const syncEmails = useSyncEmails()
  const applications = applicationsQuery.data ?? []
  const active = applications.filter(
    (application) => !CLOSED_STATUSES.has(application.status),
  )
  const closed = applications.filter((application) =>
    CLOSED_STATUSES.has(application.status),
  )
  const waiting = active.filter((application) =>
    ['applied', 'assessment', 'interview', 'offer'].includes(
      application.status,
    ),
  )
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = active
    .filter((application) => application.application_deadline)
    .filter((application) => {
      const deadline = new Date(`${application.application_deadline}T00:00:00`)
      const days = (deadline.getTime() - today.getTime()) / 86_400_000
      return days >= 0 && days <= 14
    })
    .sort((a, b) =>
      (a.application_deadline ?? '').localeCompare(
        b.application_deadline ?? '',
      ),
    )
  const overdueCount = active.filter(
    (application) =>
      application.application_deadline &&
      new Date(`${application.application_deadline}T00:00:00`) < today,
  ).length
  const openReviewCount =
    reviewQuery.data?.filter((item) => item.state === 'open').length ?? 0
  const needsAttention =
    overdueCount + openReviewCount + (followUpsQuery.data?.length ?? 0)
  const byId = new Map(
    applications.map((application) => [application.id, application]),
  )
  const metrics = [
    {
      label: 'Active applications',
      value: active.length,
      icon: BriefcaseBusiness,
    },
    { label: 'Needs attention', value: needsAttention, icon: CircleAlert },
    {
      label: 'Waiting / in process',
      value: waiting.length,
      icon: CalendarClock,
    },
    { label: 'Closed', value: closed.length, icon: CircleCheck },
  ] as const

  return (
    <div className="space-y-8">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            {gmailQuery.data?.connected ? (
              <Button
                disabled={syncEmails.isPending}
                onClick={() => syncEmails.mutate()}
                type="button"
                variant="outline"
              >
                <CalendarClock aria-hidden="true" className="size-4" />
                {syncEmails.isPending ? 'Syncing…' : 'Sync emails'}
              </Button>
            ) : null}
            <Button asChild>
              <Link to="/applications/new">
                <Plus aria-hidden="true" className="size-4" /> Add application
              </Link>
            </Button>
          </div>
        }
        description="A focused view of applications, deadlines, and items that need a decision."
        eyebrow="Overview"
        title="Dashboard"
      />

      <section
        aria-label="Application metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {value}
                </p>
              </div>
              <div className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
                <Icon aria-hidden="true" className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Application pipeline</CardTitle>
                <CardDescription>
                  Current totals across every recruitment stage.
                </CardDescription>
              </div>
              <Badge variant="outline">{applications.length} total</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {applicationsQuery.isPending ? (
              <p className="text-muted-foreground text-sm">Loading pipeline…</p>
            ) : applicationsQuery.isError ? (
              <p className="text-destructive text-sm">
                Pipeline data could not be loaded.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {APPLICATION_STATUSES.map((status) => (
                  <div
                    className="bg-muted/60 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm"
                    key={status.value}
                  >
                    <span className="text-muted-foreground">
                      {status.label}
                    </span>
                    <span className="font-semibold">
                      {
                        applications.filter(
                          (application) => application.status === status.value,
                        ).length
                      }
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
            <CardDescription>Due in the next 14 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length ? (
              upcoming.slice(0, 5).map((application) => (
                <Link
                  className="bg-muted/60 hover:bg-muted flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-sm"
                  key={application.id}
                  to={`/applications/${application.id}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {application.position_title}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {application.company_name}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs">
                    {formatDate(application.application_deadline)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                No deadlines in the next 14 days.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Latest status changes recorded by trusted database logic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isPending ? (
            <p className="text-muted-foreground text-sm">Loading activity…</p>
          ) : historyQuery.data?.length ? (
            <div className="divide-border divide-y">
              {historyQuery.data.slice(0, 6).map((entry) => {
                const application = byId.get(entry.application_id)
                return (
                  <div
                    className="flex items-center justify-between gap-4 py-3 first:pt-0"
                    key={entry.id}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {application
                          ? `${application.company_name} · ${application.position_title}`
                          : 'Application update'}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {entry.old_status
                          ? `${statusLabel(entry.old_status)} → `
                          : ''}
                        {statusLabel(entry.new_status)}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(entry.changed_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No application activity yet.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Email synchronization</CardTitle>
              <CardDescription>
                Connection health and latest metadata-only run result.
              </CardDescription>
            </div>
            <Badge variant={gmailQuery.data?.connected ? 'default' : 'outline'}>
              {gmailQuery.data?.status ?? 'Not connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {syncRunsQuery.data?.[0] ? (
            <div className="flex flex-col justify-between gap-2 text-sm sm:flex-row">
              <span>
                Latest {syncRunsQuery.data[0].trigger_source} run:{' '}
                <strong>{syncRunsQuery.data[0].status}</strong>
              </span>
              <span className="text-muted-foreground">
                {formatDate(syncRunsQuery.data[0].started_at)} ·{' '}
                {syncRunsQuery.data[0].processed_count} processed ·{' '}
                {syncRunsQuery.data[0].review_count} review
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No synchronization runs recorded.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
