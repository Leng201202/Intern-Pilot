import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  ApplicationHistory,
  Database,
  Notification,
  ReviewItem,
} from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'

const activityKeys = {
  history: ['activity', 'history'] as const,
  notifications: ['activity', 'notifications'] as const,
  review: ['activity', 'review'] as const,
  followUps: ['activity', 'follow-ups'] as const,
  emailEvents: ['activity', 'email-events'] as const,
  syncRuns: ['activity', 'sync-runs'] as const,
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function dataFailure(): Error {
  return new Error('Activity data could not be loaded.')
}

export function useAllHistory() {
  return useQuery({
    queryKey: activityKeys.history,
    queryFn: async (): Promise<ApplicationHistory[]> => {
      const { data, error } = await requireClient()
        .from('application_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(50)
      if (error) throw dataFailure()
      return data
    },
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: activityKeys.notifications,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await requireClient()
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw dataFailure()
      return data
    },
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await requireClient()
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
      if (error) throw dataFailure()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: activityKeys.notifications,
      })
    },
  })
}

export function useReviewItems() {
  return useQuery({
    queryKey: activityKeys.review,
    queryFn: async (): Promise<ReviewItem[]> => {
      const { data, error } = await requireClient()
        .from('review_items')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw dataFailure()
      return data
    },
  })
}

export function useOpenFollowUps() {
  return useQuery({
    queryKey: activityKeys.followUps,
    queryFn: async () => {
      const { data, error } = await requireClient()
        .from('follow_ups')
        .select('*')
        .eq('state', 'open')
        .order('due_at', { ascending: true })
      if (error) throw dataFailure()
      return data
    },
  })
}

export function useEmailEvents() {
  return useQuery({
    queryKey: activityKeys.emailEvents,
    queryFn: async (): Promise<
      Database['public']['Tables']['email_events']['Row'][]
    > => {
      const { data, error } = await requireClient()
        .from('email_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100)
      if (error) throw dataFailure()
      return data
    },
  })
}

export function useSyncRuns() {
  return useQuery({
    queryKey: activityKeys.syncRuns,
    queryFn: async (): Promise<
      Database['public']['Tables']['sync_runs']['Row'][]
    > => {
      const { data, error } = await requireClient()
        .from('sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20)
      if (error) throw dataFailure()
      return data
    },
  })
}

export function useResolveReviewItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      action: 'confirm' | 'dismiss' | 'resolve'
      application_id?: string | null
      deadline?: string | null
      review_item_id: string
      status?: string | null
    }): Promise<void> => {
      const { error } = (await requireClient().functions.invoke(
        'review-action',
        {
          method: 'POST',
          body: input,
        },
      )) as { error: unknown }
      if (error) throw dataFailure()
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
        queryClient.invalidateQueries({ queryKey: ['applications'] }),
      ])
    },
  })
}

export function useUpdateFollowUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      state: 'completed' | 'cancelled'
    }): Promise<void> => {
      const { error } = await requireClient()
        .from('follow_ups')
        .update({ state: input.state })
        .eq('id', input.id)
      if (error) throw dataFailure()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: activityKeys.followUps })
    },
  })
}
