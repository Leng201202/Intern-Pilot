import { Download, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  useApplications,
  useRestoreApplication,
} from '@/features/applications/application-data'
import {
  downloadApplicationsCsv,
  formatDate,
  statusLabel,
} from '@/features/applications/application-utils'

export default function ArchivePage() {
  const applicationsQuery = useApplications()
  const restoreMutation = useRestoreApplication()
  const archived = (applicationsQuery.data ?? []).filter(
    (application) => application.archived_at,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button
            disabled={archived.length === 0}
            onClick={() =>
              downloadApplicationsCsv(archived, 'internpilot-archive.csv')
            }
            type="button"
            variant="outline"
          >
            <Download aria-hidden="true" className="size-4" /> Export CSV
          </Button>
        }
        description="Applications appear here after the documented six-month archival threshold. Restoring sets the application back to Applied and clears closure markers through trusted database logic."
        eyebrow="Retention"
        title="Archive"
      />
      <Card>
        <CardContent className="p-5">
          {applicationsQuery.isPending ? (
            <p className="text-muted-foreground text-sm">Loading archive…</p>
          ) : applicationsQuery.isError ? (
            <p className="text-destructive text-sm">
              Archive data could not be loaded.
            </p>
          ) : archived.length ? (
            <div className="divide-border divide-y">
              {archived.map((application) => (
                <div
                  className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  key={application.id}
                >
                  <Link
                    className="min-w-0 hover:underline"
                    to={`/applications/${application.id}`}
                  >
                    <p className="truncate font-semibold">
                      {application.position_title}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-sm">
                      {application.company_name} · Archived{' '}
                      {formatDate(application.archived_at)}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {statusLabel(application.status)}
                    </Badge>
                    <Button
                      disabled={restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate(application.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RotateCcw aria-hidden="true" className="size-4" />{' '}
                      Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No archived applications.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
