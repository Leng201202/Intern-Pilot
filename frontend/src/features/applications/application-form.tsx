import { AlertTriangle, Save } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  APPLICATION_STATUSES,
  findDuplicate,
  validateApplication,
  type ApplicationFormValues,
} from '@/features/applications/application-utils'
import type { Application } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'

const controlClass =
  'border-border bg-background text-foreground focus-visible:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 disabled:opacity-50'

function Field({
  children,
  error,
  htmlFor,
  label,
}: {
  children: ReactNode
  error?: string
  htmlFor: string
  label: string
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  )
}

export function ApplicationForm({
  applications,
  currentId,
  initialValues,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  applications: ReadonlyArray<Application>
  currentId?: string
  initialValues: ApplicationFormValues
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (values: ApplicationFormValues) => Promise<void>
}) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const duplicate = useMemo(
    () => findDuplicate(applications, values, currentId),
    [applications, currentId, values],
  )

  function update<Key extends keyof ApplicationFormValues>(
    key: Key,
    value: ApplicationFormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateApplication(values)
    setErrors(nextErrors)
    setSubmitError(null)
    if (Object.keys(nextErrors).length > 0) return

    try {
      await onSubmit(values)
    } catch {
      setSubmitError('The application could not be saved. Please try again.')
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <Card>
        <CardHeader>
          <CardTitle>Application details</CardTitle>
          <CardDescription>
            Required fields are marked with an asterisk. Status changes are
            recorded automatically in the audit history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {duplicate ? (
            <div className="border-warning bg-warning/10 flex gap-3 rounded-xl border p-4 text-sm">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div>
                <p className="font-semibold">Possible duplicate</p>
                <p className="text-muted-foreground mt-1">
                  An application for this company and position already exists.
                  You can still save if this is intentional.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              error={errors.companyName}
              htmlFor="companyName"
              label="Company name *"
            >
              <input
                className={controlClass}
                id="companyName"
                maxLength={200}
                onChange={(event) => update('companyName', event.target.value)}
                value={values.companyName}
              />
            </Field>
            <Field
              error={errors.positionTitle}
              htmlFor="positionTitle"
              label="Position title *"
            >
              <input
                className={controlClass}
                id="positionTitle"
                maxLength={200}
                onChange={(event) =>
                  update('positionTitle', event.target.value)
                }
                value={values.positionTitle}
              />
            </Field>
            <Field htmlFor="status" label="Status *">
              <select
                className={controlClass}
                id="status"
                onChange={(event) =>
                  update(
                    'status',
                    event.target.value as ApplicationFormValues['status'],
                  )
                }
                value={values.status}
              >
                {APPLICATION_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              error={errors.applicationDate}
              htmlFor="applicationDate"
              label="Application date *"
            >
              <input
                className={controlClass}
                id="applicationDate"
                onChange={(event) =>
                  update('applicationDate', event.target.value)
                }
                type="date"
                value={values.applicationDate}
              />
            </Field>
            <Field htmlFor="applicationDeadline" label="Deadline">
              <input
                className={controlClass}
                id="applicationDeadline"
                onChange={(event) =>
                  update('applicationDeadline', event.target.value)
                }
                type="date"
                value={values.applicationDeadline}
              />
            </Field>
            <Field
              error={errors.applicationMethod}
              htmlFor="applicationMethod"
              label="Application method"
            >
              <input
                className={controlClass}
                id="applicationMethod"
                maxLength={200}
                onChange={(event) =>
                  update('applicationMethod', event.target.value)
                }
                placeholder="Company site, referral, careers fair…"
                value={values.applicationMethod}
              />
            </Field>
            <Field error={errors.location} htmlFor="location" label="Location">
              <input
                className={controlClass}
                id="location"
                maxLength={300}
                onChange={(event) => update('location', event.target.value)}
                value={values.location}
              />
            </Field>
            <Field error={errors.jobUrl} htmlFor="jobUrl" label="Job URL">
              <input
                className={controlClass}
                id="jobUrl"
                maxLength={2048}
                onChange={(event) => update('jobUrl', event.target.value)}
                placeholder="https://…"
                type="url"
                value={values.jobUrl}
              />
            </Field>
          </div>
          <Field error={errors.notes} htmlFor="notes" label="Notes">
            <textarea
              className={cn(controlClass, 'min-h-32 resize-y py-3')}
              id="notes"
              maxLength={10_000}
              onChange={(event) => update('notes', event.target.value)}
              value={values.notes}
            />
          </Field>
          {submitError ? (
            <p className="text-destructive text-sm">{submitError}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              <Save aria-hidden="true" className="size-4" />
              {isSubmitting ? 'Saving…' : 'Save application'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
