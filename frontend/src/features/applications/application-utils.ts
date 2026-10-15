import type {
  Application,
  ApplicationStatus,
} from '@/lib/supabase/database.types'

export const APPLICATION_STATUSES: ReadonlyArray<{
  label: string
  value: ApplicationStatus
}> = [
  { value: 'interested', label: 'Interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

export const CLOSED_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'accepted',
  'rejected',
  'withdrawn',
])

export type ApplicationFormValues = {
  applicationDate: string
  applicationDeadline: string
  applicationMethod: string
  companyName: string
  jobUrl: string
  location: string
  notes: string
  positionTitle: string
  status: ApplicationStatus
}

export function emptyApplicationForm(): ApplicationFormValues {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60_000
  return {
    applicationDate: new Date(today.getTime() - offset)
      .toISOString()
      .slice(0, 10),
    applicationDeadline: '',
    applicationMethod: '',
    companyName: '',
    jobUrl: '',
    location: '',
    notes: '',
    positionTitle: '',
    status: 'applied',
  }
}

export function applicationToForm(
  application: Application,
): ApplicationFormValues {
  return {
    applicationDate: application.application_date,
    applicationDeadline: application.application_deadline ?? '',
    applicationMethod: application.application_method ?? '',
    companyName: application.company_name,
    jobUrl: application.job_url ?? '',
    location: application.location ?? '',
    notes: application.notes ?? '',
    positionTitle: application.position_title,
    status: application.status,
  }
}

export function validateApplication(
  values: ApplicationFormValues,
): Record<string, string> {
  const errors: Record<string, string> = {}
  const companyName = values.companyName.trim()
  const positionTitle = values.positionTitle.trim()

  if (!companyName) errors.companyName = 'Company name is required.'
  else if (companyName.length > 200)
    errors.companyName = 'Use 200 characters or fewer.'

  if (!positionTitle) errors.positionTitle = 'Position title is required.'
  else if (positionTitle.length > 200)
    errors.positionTitle = 'Use 200 characters or fewer.'

  if (!values.applicationDate)
    errors.applicationDate = 'Application date is required.'
  if (values.applicationMethod.length > 200)
    errors.applicationMethod = 'Use 200 characters or fewer.'
  if (values.location.length > 300)
    errors.location = 'Use 300 characters or fewer.'
  if (values.notes.length > 10_000)
    errors.notes = 'Use 10,000 characters or fewer.'

  if (values.jobUrl) {
    try {
      const url = new URL(values.jobUrl)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      errors.jobUrl = 'Enter a valid HTTP or HTTPS URL.'
    }
  }

  return errors
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function findDuplicate(
  applications: ReadonlyArray<Application>,
  values: ApplicationFormValues,
  currentId?: string,
): Application | undefined {
  const company = normalized(values.companyName)
  const position = normalized(values.positionTitle)
  if (!company || !position) return undefined

  return applications.find(
    (application) =>
      application.id !== currentId &&
      normalized(application.company_name) === company &&
      normalized(application.position_title) === position,
  )
}

export function statusLabel(status: ApplicationStatus): string {
  return (
    APPLICATION_STATUSES.find((option) => option.value === status)?.label ??
    status
  )
}

export function formatDate(value: string | null): string {
  if (!value) return 'Not set'
  const date =
    value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function csvCell(value: string | null): string {
  const safe = value ?? ''
  const neutralized = /^[=+\-@\t\r]/.test(safe) ? `'${safe}` : safe
  return `"${neutralized.replaceAll('"', '""')}"`
}

export function buildApplicationsCsv(
  applications: ReadonlyArray<Application>,
): string {
  const rows = applications.map((application) =>
    [
      application.company_name,
      application.position_title,
      statusLabel(application.status),
      application.application_date,
      application.application_deadline,
      application.application_method,
      application.location,
      application.job_url,
      application.notes,
      application.closed_at,
      application.archived_at,
    ]
      .map(csvCell)
      .join(','),
  )

  return [
    [
      'Company',
      'Position',
      'Status',
      'Application date',
      'Deadline',
      'Method',
      'Location',
      'Job URL',
      'Notes',
      'Closed at',
      'Archived at',
    ]
      .map(csvCell)
      .join(','),
    ...rows,
  ].join('\n')
}

export function downloadApplicationsCsv(
  applications: ReadonlyArray<Application>,
  filename: string,
): void {
  const blob = new Blob([buildApplicationsCsv(applications)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
