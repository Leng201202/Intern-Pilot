import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { App } from '@/app/app'

afterEach(() => {
  cleanup()
  window.history.pushState({}, '', '/')
})

describe('application routing', () => {
  it('renders the dashboard at the root route', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Good morning' }),
    ).toBeInTheDocument()
  })

  it('renders a placeholder page on a nested route', async () => {
    window.history.pushState({}, '', '/applications')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Applications' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Planned for Phase 2')).toBeInTheDocument()
  })
})
