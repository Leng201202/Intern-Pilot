import { describe, expect, it } from 'vitest'

import {
  buildApplicationsCsv,
  emptyApplicationForm,
  findDuplicate,
  validateApplication,
} from '@/features/applications/application-utils'
import type { Application } from '@/lib/supabase/database.types'

const application: Application = {
  application_date: '2026-10-01',
  application_deadline: null,
  application_method: null,
  archived_at: null,
  closed_at: null,
  company_name: 'Acme Labs',
  created_at: '2026-10-01T00:00:00Z',
  id: '11111111-1111-1111-1111-111111111111',
  job_url: null,
  location: null,
  notes: null,
  position_title: 'Software Intern',
  status: 'applied',
  updated_at: '2026-10-01T00:00:00Z',
  user_id: '22222222-2222-2222-2222-222222222222',
}

describe('application validation', () => {
  it('requires core fields and rejects unsafe URL schemes', () => {
    const values = {
      ...emptyApplicationForm(),
      applicationDate: '',
      jobUrl: 'javascript:alert(1)',
    }
    const errors = validateApplication(values)

    expect(errors.companyName).toBeDefined()
    expect(errors.positionTitle).toBeDefined()
    expect(errors.applicationDate).toBeDefined()
    expect(errors.jobUrl).toBeDefined()
  })

  it('warns on normalized company and position duplicates', () => {
    const values = {
      ...emptyApplicationForm(),
      companyName: '  ACME   LABS ',
      positionTitle: 'software intern',
    }

    expect(findDuplicate([application], values)?.id).toBe(application.id)
    expect(findDuplicate([application], values, application.id)).toBeUndefined()
  })
})

describe('CSV export', () => {
  it('escapes quotes and neutralizes spreadsheet formulas', () => {
    const csv = buildApplicationsCsv([
      {
        ...application,
        company_name: '=HYPERLINK("https://example.test")',
        notes: 'He said "hello"',
      },
    ])

    expect(csv).toContain(`"'=HYPERLINK(""https://example.test"")"`)
    expect(csv).toContain('"He said ""hello"""')
  })
})
