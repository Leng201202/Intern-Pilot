import {
  ArrowLeft,
  Copy,
  ExternalLink,
  MessageSquareText,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

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
  useApplication,
  useApplicationHistory,
  useDeleteApplication,
} from '@/features/applications/application-data'
import {
  formatDate,
  statusLabel,
} from '@/features/applications/application-utils'

function safeJobUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export default function ApplicationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const applicationQuery = useApplication(id)
  const historyQuery = useApplicationHistory(id)
  const deleteMutation = useDeleteApplication()
  const [showDraft, setShowDraft] = useState(false)

  if (applicationQuery.isPending)
    return <p className="text-muted-foreground">Loading application…</p>
  if (applicationQuery.isError || !applicationQuery.data)
    return (
      <p className="text-destructive">The application could not be loaded.</p>
    )

  const application = applicationQuery.data
  const jobUrl = safeJobUrl(application.job_url)

  async function handleDelete() {
    if (!id) return
    const confirmed = window.confirm(
      'Delete this application and its related history? This cannot be undone.',
    )
    if (!confirmed) return
    await deleteMutation.mutateAsync(id)
    void navigate('/applications')
  }

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost">
        <Link to="/applications">
          <ArrowLeft aria-hidden="true" className="size-4" /> Applications
        </Link>
      </Button>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {application.position_title}
            </h1>
            <Badge>{statusLabel(application.status)}</Badge>
          </div>
          <p className="text-muted-foreground mt-2">
            {application.company_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={`/applications/${id}/edit`}>
              <Pencil aria-hidden="true" className="size-4" /> Edit
            </Link>
          </Button>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => void handleDelete()}
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" className="size-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Core application information.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {[
              ['Application date', formatDate(application.application_date)],
              ['Deadline', formatDate(application.application_deadline)],
              ['Method', application.application_method ?? 'Not set'],
              ['Location', application.location ?? 'Not set'],
              ['Closed', formatDate(application.closed_at)],
              ['Archived', formatDate(application.archived_at)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {label}
                </p>
                <p className="mt-1 text-sm">{value}</p>
              </div>
            ))}
            {jobUrl ? (
              <div className="sm:col-span-2">
                <a
                  className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                  href={jobUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open job listing{' '}
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Notes
              </p>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
                {application.notes ?? 'No notes added.'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status history</CardTitle>
            <CardDescription>Trusted database audit entries.</CardDescription>
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
      <Card>
        <CardHeader>
          <CardTitle>Follow-up draft</CardTitle>
          <CardDescription>
            Generate a local template for your review. InternPilot never sends
            email automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => setShowDraft((current) => !current)}
            type="button"
            variant="outline"
          >
            <MessageSquareText aria-hidden="true" className="size-4" />
            {showDraft ? 'Hide draft' : 'Generate local draft'}
          </Button>
          {showDraft ? (
            <div className="bg-muted/60 space-y-3 rounded-xl p-4">
              <p className="text-sm leading-6 whitespace-pre-wrap">
                {`Hello,\n\nI’m following up on my application for the ${application.position_title} position at ${application.company_name}. I remain interested in the opportunity and would appreciate any update you can share about the next steps.\n\nThank you for your time.`}
              </p>
              <Button
                onClick={() =>
                  void navigator.clipboard.writeText(
                    `Hello,\n\nI’m following up on my application for the ${application.position_title} position at ${application.company_name}. I remain interested in the opportunity and would appreciate any update you can share about the next steps.\n\nThank you for your time.`,
                  )
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                <Copy aria-hidden="true" className="size-4" /> Copy draft
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
