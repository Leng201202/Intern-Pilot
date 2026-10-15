import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase/client'

export type GmailConnectionStatus = {
  checkpoint_ready: boolean
  connected: boolean
  connected_at: string | null
  last_successful_sync_at: string | null
  status: 'connected' | 'reauthorization_required' | 'disabled' | 'disconnected'
}

const connectionKey = ['gmail-connection'] as const

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function integrationFailure(): Error {
  return new Error('The Gmail integration request failed.')
}

function isConnectionStatus(value: unknown): value is GmailConnectionStatus {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.checkpoint_ready === 'boolean' &&
    typeof candidate.connected === 'boolean' &&
    (candidate.connected_at === null ||
      typeof candidate.connected_at === 'string') &&
    (candidate.last_successful_sync_at === null ||
      typeof candidate.last_successful_sync_at === 'string') &&
    [
      'connected',
      'reauthorization_required',
      'disabled',
      'disconnected',
    ].includes(String(candidate.status))
  )
}

function authorizationUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const url = (value as Record<string, unknown>).authorization_url
  return typeof url === 'string' ? url : null
}

export function useGmailConnection() {
  return useQuery({
    queryKey: connectionKey,
    queryFn: async (): Promise<GmailConnectionStatus> => {
      const { data, error } = (await requireClient().functions.invoke(
        'gmail-connection',
        { method: 'GET' },
      )) as { data: unknown; error: unknown }
      if (error || !isConnectionStatus(data)) throw integrationFailure()
      return data
    },
  })
}

export function useConnectGmail() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { data, error } = (await requireClient().functions.invoke(
        'gmail-oauth-start',
        { method: 'POST' },
      )) as { data: unknown; error: unknown }
      const url = authorizationUrl(data)
      if (error || !url) throw integrationFailure()
      window.location.assign(url)
    },
  })
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = (await requireClient().functions.invoke(
        'gmail-connection',
        { method: 'DELETE' },
      )) as { error: unknown }
      if (error) throw integrationFailure()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: connectionKey })
    },
  })
}

export function useSyncEmails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = (await requireClient().functions.invoke('sync-emails', {
        method: 'POST',
      })) as { error: unknown }
      if (error) throw integrationFailure()
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: connectionKey }),
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
      ])
    },
  })
}
