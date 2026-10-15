import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  Application,
  ApplicationHistory,
  Database,
} from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'

const applicationKeys = {
  all: ['applications'] as const,
  detail: (id: string) => ['applications', id] as const,
  history: (id: string) => ['applications', id, 'history'] as const,
}

function databaseFailure(): Error {
  return new Error('The application data request failed. Please try again.')
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export function useApplications() {
  return useQuery({
    queryKey: applicationKeys.all,
    queryFn: async (): Promise<Application[]> => {
      const { data, error } = await requireClient()
        .from('applications')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw databaseFailure()
      return data
    },
  })
}

export function useApplication(id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: applicationKeys.detail(id ?? ''),
    queryFn: async (): Promise<Application> => {
      const { data, error } = await requireClient()
        .from('applications')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw databaseFailure()
      return data
    },
  })
}

export function useApplicationHistory(id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: applicationKeys.history(id ?? ''),
    queryFn: async (): Promise<ApplicationHistory[]> => {
      const { data, error } = await requireClient()
        .from('application_history')
        .select('*')
        .eq('application_id', id!)
        .order('changed_at', { ascending: false })
      if (error) throw databaseFailure()
      return data
    },
  })
}

export function useCreateApplication(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      values: Omit<
        Database['public']['Tables']['applications']['Insert'],
        'user_id'
      >,
    ): Promise<Application> => {
      const { data, error } = await requireClient()
        .from('applications')
        .insert({ ...values, user_id: userId })
        .select('*')
        .single()
      if (error) throw databaseFailure()
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationKeys.all })
    },
  })
}

export function useUpdateApplication(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      values: Database['public']['Tables']['applications']['Update'],
    ): Promise<Application> => {
      const { data, error } = await requireClient()
        .from('applications')
        .update(values)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw databaseFailure()
      return data
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
        queryClient.invalidateQueries({ queryKey: applicationKeys.detail(id) }),
        queryClient.invalidateQueries({
          queryKey: applicationKeys.history(id),
        }),
      ])
    },
  })
}

export function useDeleteApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await requireClient()
        .from('applications')
        .delete()
        .eq('id', id)
      if (error) throw databaseFailure()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationKeys.all })
    },
  })
}

export function useRestoreApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await requireClient()
        .from('applications')
        .update({ status: 'applied' })
        .eq('id', id)
      if (error) throw databaseFailure()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: applicationKeys.all })
    },
  })
}
