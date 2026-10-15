import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from '@/features/auth/auth-context'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function readStringClaim(claims: unknown, key: string): string | null {
  const value = asRecord(claims)?.[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function hasOwnerClaim(claims: unknown): boolean {
  const appMetadata = asRecord(asRecord(claims)?.app_metadata)
  return appMetadata?.internpilot_owner === true
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() =>
    isSupabaseConfigured
      ? { status: 'loading', user: null }
      : { status: 'unconfigured', user: null },
  )

  const refreshAuth = useCallback(async () => {
    if (!supabase) {
      setAuthState({ status: 'unconfigured', user: null })
      return
    }

    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) {
      setAuthState({ status: 'signed-out', user: null })
      return
    }

    const id = readStringClaim(data.claims, 'sub')
    if (!id) {
      setAuthState({ status: 'signed-out', user: null })
      return
    }

    const user = { id, email: readStringClaim(data.claims, 'email') }
    setAuthState(
      hasOwnerClaim(data.claims)
        ? { status: 'authenticated', user }
        : { status: 'unauthorized', user },
    )
  }, [])

  useEffect(() => {
    if (!supabase) return

    const initialRefresh = window.setTimeout(() => void refreshAuth(), 0)
    const { data } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuth(), 0)
    })

    return () => {
      window.clearTimeout(initialRefresh)
      data.subscription.unsubscribe()
    }
  }, [refreshAuth])

  const signIn = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not configured.')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...authState, signIn, signOut }),
    [authState, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
