import { Bell, Check, Clock3, History, RefreshCw, X } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useAllHistory,
  useMarkNotificationRead,
  useNotifications,
  useOpenFollowUps,
  useSyncRuns,
  useUpdateFollowUp,
} from '@/features/activity/activity-data'
import {
  formatDate,
  statusLabel,
} from '@/features/applications/application-utils'

export default function ActivityPage() {
  const notificationsQuery = useNotifications()
  const historyQuery = useAllHistory()
  const markRead = useMarkNotificationRead()
  const followUpsQuery = useOpenFollowUps()
  const syncRunsQuery = useSyncRuns()
  const updateFollowUp = useUpdateFollowUp()

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review in-app notifications and the trusted application status audit trail."
        eyebrow="Workspace"
        title="Activity"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell aria-hidden="true" className="size-4" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notificationsQuery.isPending ? (
              <p className="text-muted-foreground text-sm">
                Loading notifications…
              </p>
            ) : notificationsQuery.isError ? (
              <p className="text-destructive text-sm">
                Notifications could not be loaded.
              </p>
            ) : notificationsQuery.data?.length ? (
              <ul className="divide-border divide-y">
                {notificationsQuery.data.map((notification) => (
                  <li className="py-4 first:pt-0" key={notification.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">
                            {notification.title}
                          </p>
                          {!notification.is_read ? <Badge>New</Badge> : null}
                        </div>
                        {notification.message ? (
                          <p className="text-muted-foreground mt-1 text-sm leading-6">
                            {notification.message}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground mt-2 text-xs">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                      {!notification.is_read ? (
                        <Button
                          aria-label={`Mark ${notification.title} as read`}
                          disabled={markRead.isPending}
                          onClick={() => markRead.mutate(notification.id)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Check aria-hidden="true" className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                No notifications yet.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History aria-hidden="true" className="size-4" /> Status history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyQuery.isPending ? (
              <p className="text-muted-foreground text-sm">Loading history…</p>
            ) : historyQuery.isError ? (
              <p className="text-destructive text-sm">
                History could not be loaded.
              </p>
            ) : historyQuery.data?.length ? (
              <ol className="space-y-4">
                {historyQuery.data.map((entry) => (
                  <li className="border-border border-l-2 pl-4" key={entry.id}>
                    <p className="text-sm font-medium">
                      {entry.old_status
                        ? `${statusLabel(entry.old_status)} → `
                        : ''}
                      {statusLabel(entry.new_status)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatDate(entry.changed_at)} · {entry.change_source}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm">
                No status changes recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 aria-hidden="true" className="size-4" /> Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {followUpsQuery.isPending ? (
              <p className="text-muted-foreground text-sm">
                Loading follow-ups…
              </p>
            ) : followUpsQuery.data?.length ? (
              <ul className="divide-border divide-y">
                {followUpsQuery.data.map((followUp) => (
                  <li
                    className="flex items-center justify-between gap-3 py-3 first:pt-0"
                    key={followUp.id}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {followUp.kind.replaceAll('_', ' ')}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Due {formatDate(followUp.due_at)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        aria-label="Complete follow-up"
                        disabled={updateFollowUp.isPending}
                        onClick={() =>
                          updateFollowUp.mutate({
                            id: followUp.id,
                            state: 'completed',
                          })
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Check aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        aria-label="Dismiss follow-up"
                        disabled={updateFollowUp.isPending}
                        onClick={() =>
                          updateFollowUp.mutate({
                            id: followUp.id,
                            state: 'cancelled',
                          })
                        }
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                No open follow-ups.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw aria-hidden="true" className="size-4" /> Email sync
              runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {syncRunsQuery.isPending ? (
              <p className="text-muted-foreground text-sm">
                Loading sync activity…
              </p>
            ) : syncRunsQuery.data?.length ? (
              <ul className="divide-border divide-y">
                {syncRunsQuery.data.map((run) => (
                  <li
                    className="flex items-center justify-between gap-3 py-3 first:pt-0"
                    key={run.id}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {run.trigger_source === 'manual'
                          ? 'Manual sync'
                          : 'Scheduled sync'}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDate(run.started_at)} · {run.processed_count}{' '}
                        processed · {run.review_count} review
                      </p>
                    </div>
                    <Badge
                      variant={run.status === 'failed' ? 'warning' : 'outline'}
                    >
                      {run.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                No email sync runs yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
