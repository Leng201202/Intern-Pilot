import { ExternalLink } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  useEmailEvents,
  useResolveReviewItem,
  useReviewItems,
} from '@/features/activity/activity-data'
import { useApplications } from '@/features/applications/application-data'
import {
  APPLICATION_STATUSES,
  formatDate,
} from '@/features/applications/application-utils'
import type {
  Application,
  ApplicationStatus,
  Database,
  ReviewItem,
} from '@/lib/supabase/database.types'

const controlClass =
  'border-border bg-background focus-visible:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2'

function reasonLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function ReviewCard({
  applications,
  event,
  item,
}: {
  applications: ReadonlyArray<Application>
  event: Database['public']['Tables']['email_events']['Row'] | undefined
  item: ReviewItem
}) {
  const resolveReview = useResolveReviewItem()
  const [applicationId, setApplicationId] = useState(
    item.application_id ?? applications[0]?.id ?? '',
  )
  const [status, setStatus] = useState<ApplicationStatus>(
    item.suggested_status ?? 'applied',
  )
  const [deadline, setDeadline] = useState(item.suggested_deadline ?? '')

  return (
    <div className="space-y-4 py-5 first:pt-0">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{reasonLabel(item.reason_code)}</p>
            <Badge variant="warning">Needs review</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Created {formatDate(item.created_at)}
            {event?.email_category
              ? ` · ${reasonLabel(event.email_category)}`
              : ''}
          </p>
        </div>
        {event ? (
          <Button asChild size="sm" variant="outline">
            <a
              href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(event.gmail_message_id)}`}
              rel="noreferrer"
              target="_blank"
            >
              Open in Gmail{' '}
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm leading-6">
        InternPilot stores only this reason and safe identifiers. Review the
        original message in Gmail before confirming an update.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          aria-label="Application"
          className={controlClass}
          onChange={(event) => setApplicationId(event.target.value)}
          value={applicationId}
        >
          <option value="">Choose application</option>
          {applications.map((application) => (
            <option key={application.id} value={application.id}>
              {application.company_name} — {application.position_title}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          className={controlClass}
          onChange={(event) =>
            setStatus(event.target.value as ApplicationStatus)
          }
          value={status}
        >
          {APPLICATION_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          aria-label="Deadline"
          className={controlClass}
          onChange={(event) => setDeadline(event.target.value)}
          type="date"
          value={deadline}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!applicationId || resolveReview.isPending}
          onClick={() =>
            resolveReview.mutate({
              action: 'confirm',
              application_id: applicationId,
              deadline: deadline || null,
              review_item_id: item.id,
              status,
            })
          }
          size="sm"
          type="button"
        >
          Confirm update
        </Button>
        <Button
          disabled={resolveReview.isPending}
          onClick={() =>
            resolveReview.mutate({
              action: 'resolve',
              review_item_id: item.id,
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          Resolve without change
        </Button>
        <Button
          disabled={resolveReview.isPending}
          onClick={() =>
            resolveReview.mutate({
              action: 'dismiss',
              review_item_id: item.id,
            })
          }
          size="sm"
          type="button"
          variant="ghost"
        >
          Ignore
        </Button>
      </div>
      {resolveReview.isError ? (
        <p className="text-destructive text-sm">
          This review action could not be applied safely.
        </p>
      ) : null}
    </div>
  )
}

export default function ReviewPage() {
  const reviewQuery = useReviewItems()
  const eventsQuery = useEmailEvents()
  const applicationsQuery = useApplications()
  const openItems =
    reviewQuery.data?.filter((item) => item.state === 'open') ?? []
  const eventsById = new Map(
    (eventsQuery.data ?? []).map((event) => [event.id, event]),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        description="Decide safe, minimal-metadata cases without storing email content in InternPilot."
        eyebrow="Safety queue"
        title="Manual review"
      />
      <Card>
        <CardContent className="p-5">
          {reviewQuery.isPending || applicationsQuery.isPending ? (
            <p className="text-muted-foreground text-sm">
              Loading review queue…
            </p>
          ) : reviewQuery.isError || applicationsQuery.isError ? (
            <p className="text-destructive text-sm">
              Review items could not be loaded.
            </p>
          ) : openItems.length ? (
            <div className="divide-border divide-y">
              {openItems.map((item) => (
                <ReviewCard
                  applications={applicationsQuery.data ?? []}
                  event={eventsById.get(item.email_event_id)}
                  item={item}
                  key={item.id}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="font-semibold">Review queue is clear</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Privacy blocks and ambiguous recruitment messages will appear
                here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
