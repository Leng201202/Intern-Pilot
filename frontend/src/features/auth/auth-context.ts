import { createContext, useContext } from 'react'

export type AuthUser = {
  email: string | null
  id: string
}

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'unconfigured'; user: null }
  | { status: 'signed-out'; user: null }
  | { status: 'unauthorized'; user: AuthUser }
  | { status: 'authenticated'; user: AuthUser }

export type AuthContextValue = AuthState & {
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
