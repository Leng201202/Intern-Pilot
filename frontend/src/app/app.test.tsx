import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { App } from '@/app/app'

afterEach(() => {
  cleanup()
  window.history.pushState({}, '', '/')
})

describe('application routing', () => {
  it('fails closed to setup guidance when Supabase is not configured', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'InternPilot AI' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Supabase setup required')).toBeInTheDocument()
  })

  it('protects nested routes when no authenticated owner is present', async () => {
    window.history.pushState({}, '', '/applications')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'InternPilot AI' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/sign-in')
  })
})
