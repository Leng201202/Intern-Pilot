import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-context'

export default function SignInPage() {
  const auth = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (auth.status === 'authenticated') return <Navigate replace to="/" />

  const isUnconfigured = auth.status === 'unconfigured'

  async function handleSignIn() {
    setError(null)
    setIsSubmitting(true)
    try {
      await auth.signIn()
    } catch {
      setError(
        'Sign-in could not start. Check the Supabase Auth configuration.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <main className="bg-muted/40 grid min-h-svh place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-3 grid size-12 place-items-center rounded-2xl">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </div>
          <CardTitle className="text-xl">InternPilot AI</CardTitle>
          <CardDescription>
            Sign in to your private application workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isUnconfigured ? (
            <div className="border-border bg-muted rounded-xl border p-4 text-sm">
              <p className="font-semibold">Supabase setup required</p>
              <p className="text-muted-foreground mt-1 leading-6">
                Add the public Supabase URL and publishable key to your local
                environment, then enable the Google Auth provider in Supabase.
              </p>
            </div>
          ) : null}
          {auth.status === 'unauthorized' ? (
            <div className="border-warning bg-warning/10 rounded-xl border p-4 text-sm">
              <p className="font-semibold">Owner access required</p>
              <p className="text-muted-foreground mt-1 leading-6">
                This account is signed in but is missing the server-managed
                InternPilot owner claim.
              </p>
            </div>
          ) : null}
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button
            className="w-full"
            disabled={
              isUnconfigured || isSubmitting || auth.status === 'loading'
            }
            onClick={() => void handleSignIn()}
            type="button"
          >
            {isSubmitting ? 'Redirecting…' : 'Continue with Google'}
          </Button>
          {auth.status === 'unauthorized' ? (
            <Button
              className="w-full"
              onClick={() => void auth.signOut()}
              type="button"
              variant="outline"
            >
              Sign out
            </Button>
          ) : null}
          <p className="text-muted-foreground text-center text-xs leading-5">
            This sign-in grants application access only. Gmail authorization is
            separate and is not enabled in this phase.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
