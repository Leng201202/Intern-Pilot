import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import {
  useApplication,
  useApplications,
  useCreateApplication,
  useUpdateApplication,
} from '@/features/applications/application-data'
import { ApplicationForm } from '@/features/applications/application-form'
import {
  applicationToForm,
  emptyApplicationForm,
  type ApplicationFormValues,
} from '@/features/applications/application-utils'
import { useAuth } from '@/features/auth/auth-context'

function nullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

function toDatabaseValues(values: ApplicationFormValues) {
  return {
    application_date: values.applicationDate,
    application_deadline: nullable(values.applicationDeadline),
    application_method: nullable(values.applicationMethod),
    company_name: values.companyName.trim(),
    job_url: nullable(values.jobUrl),
    location: nullable(values.location),
    notes: nullable(values.notes),
    position_title: values.positionTitle.trim(),
    status: values.status,
  }
}

export default function ApplicationEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const applicationsQuery = useApplications()
  const applicationQuery = useApplication(id)
  const createMutation = useCreateApplication(auth.user?.id ?? '')
  const updateMutation = useUpdateApplication(id ?? '')
  const isEditing = Boolean(id)

  if (auth.status !== 'authenticated') return null
  if (isEditing && applicationQuery.isPending)
    return <p className="text-muted-foreground">Loading application…</p>
  if (isEditing && (applicationQuery.isError || !applicationQuery.data))
    return (
      <p className="text-destructive">The application could not be loaded.</p>
    )

  const initialValues = applicationQuery.data
    ? applicationToForm(applicationQuery.data)
    : emptyApplicationForm()

  async function handleSubmit(values: ApplicationFormValues) {
    const application = isEditing
      ? await updateMutation.mutateAsync(toDatabaseValues(values))
      : await createMutation.mutateAsync(toDatabaseValues(values))
    void navigate(`/applications/${application.id}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          isEditing
            ? 'Update application details and status.'
            : 'Record an internship application manually.'
        }
        eyebrow="Tracker"
        title={isEditing ? 'Edit application' : 'Add application'}
      />
      <ApplicationForm
        applications={applicationsQuery.data ?? []}
        currentId={id}
        initialValues={initialValues}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => {
          void navigate(isEditing ? `/applications/${id}` : '/applications')
        }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
