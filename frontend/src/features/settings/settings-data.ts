import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Profile } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'

const profileKey = ['profile'] as const

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function profileFailure(): Error {
  return new Error('Profile settings could not be saved.')
}

export function useProfile() {
  return useQuery({
    queryKey: profileKey,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await requireClient()
        .from('profiles')
        .select('*')
        .maybeSingle()
      if (error) throw profileFailure()
      return data
    },
  })
}

export function useSaveProfile(userId: string, exists: boolean) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: {
      display_name: string | null
      timezone: string
      university_deadline: string | null
    }): Promise<void> => {
      const query = exists
        ? requireClient().from('profiles').update(values).eq('user_id', userId)
        : requireClient()
            .from('profiles')
            .insert({ ...values, user_id: userId })
      const { error } = await query
      if (error) throw profileFailure()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKey })
    },
  })
}

export function useSetAiRiskAcknowledgement(userId: string, exists: boolean) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (acknowledged: boolean): Promise<void> => {
      const value = acknowledged ? new Date().toISOString() : null
      const query = exists
        ? requireClient()
            .from('profiles')
            .update({ ai_risk_acknowledged_at: value })
            .eq('user_id', userId)
        : requireClient().from('profiles').insert({
            user_id: userId,
            ai_risk_acknowledged_at: value,
          })
      const { error } = await query
      if (error) throw profileFailure()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profileKey })
    },
  })
}
