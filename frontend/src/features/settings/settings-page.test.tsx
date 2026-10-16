import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import SettingsPage from '@/features/settings/settings-page'

const { acknowledgeRisk } = vi.hoisted(() => ({
  acknowledgeRisk: vi.fn(),
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ user: { id: 'synthetic-owner' } }),
}))

vi.mock('@/features/settings/gmail-data', () => ({
  useConnectGmail: () => ({
    isError: false,
    isPending: false,
    mutate: vi.fn(),
  }),
  useDisconnectGmail: () => ({
    isError: false,
    isPending: false,
    mutate: vi.fn(),
  }),
  useGmailConnection: () => ({
    data: {
      connected: false,
      last_successful_sync_at: null,
      status: 'disconnected',
    },
    isPending: false,
  }),
  useSyncEmails: () => ({ isError: false, isPending: false, mutate: vi.fn() }),
}))

vi.mock('@/features/settings/settings-data', () => ({
  useProfile: () => ({
    data: {
      ai_risk_acknowledged_at: null,
      display_name: 'Synthetic Owner',
      timezone: 'Asia/Bangkok',
      university_deadline: null,
      updated_at: '2026-10-16T00:00:00.000Z',
    },
    isError: false,
    isPending: false,
  }),
  useSaveProfile: () => ({
    isError: false,
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useSetAiRiskAcknowledgement: () => ({
    isPending: false,
    mutate: acknowledgeRisk,
  }),
}))

afterEach(() => {
  cleanup()
  acknowledgeRisk.mockReset()
})

describe('Gemini consent disclosure', () => {
  it('names the recipient, explains residual risk, and requires affirmative consent', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByText(
        /send a minimal, locally filtered and sanitized excerpt/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/cannot guarantee complete privacy/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /Google API Services User Data Policy/,
      }),
    ).toHaveAttribute(
      'href',
      'https://developers.google.com/terms/api-services-user-data-policy',
    )

    const consent = screen.getByRole('checkbox')
    expect(consent).not.toBeChecked()
    fireEvent.click(consent)
    expect(acknowledgeRisk).toHaveBeenCalledWith(true)
  })
})
