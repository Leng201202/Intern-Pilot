import { Link2, RefreshCw, Save, ShieldCheck, Unplug } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-context'
import {
  useConnectGmail,
  useDisconnectGmail,
  useGmailConnection,
  useSyncEmails,
} from '@/features/settings/gmail-data'
import {
  useProfile,
  useSaveProfile,
  useSetAiRiskAcknowledgement,
} from '@/features/settings/settings-data'
import { formatDate } from '@/features/applications/application-utils'
import type { Profile } from '@/lib/supabase/database.types'

const controlClass =
  'border-border bg-background focus-visible:ring-ring h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2'

function ProfileForm({ profile }: { profile: Profile | null }) {
  const auth = useAuth()
  const saveProfile = useSaveProfile(auth.user?.id ?? '', Boolean(profile))
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'Asia/Bangkok')
  const [universityDeadline, setUniversityDeadline] = useState(
    profile?.university_deadline ?? '',
  )
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    await saveProfile.mutateAsync({
      display_name: displayName.trim() || null,
      timezone: timezone.trim(),
      university_deadline: universityDeadline || null,
    })
    setSaved(true)
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Used only inside your private workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="displayName">
              Display name
            </label>
            <input
              className={controlClass}
              id="displayName"
              maxLength={200}
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="timezone">
              Timezone
            </label>
            <input
              className={controlClass}
              id="timezone"
              maxLength={100}
              onChange={(event) => setTimezone(event.target.value)}
              required
              value={timezone}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="universityDeadline">
              University deadline
            </label>
            <input
              className={controlClass}
              id="universityDeadline"
              onChange={(event) => setUniversityDeadline(event.target.value)}
              type="date"
              value={universityDeadline}
            />
          </div>
          {saveProfile.isError ? (
            <p className="text-destructive text-sm">
              Settings could not be saved.
            </p>
          ) : null}
          {saved ? (
            <p className="text-primary text-sm">Settings saved.</p>
          ) : null}
          <Button disabled={saveProfile.isPending} type="submit">
            <Save aria-hidden="true" className="size-4" />{' '}
            {saveProfile.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}

export default function SettingsPage() {
  const auth = useAuth()
  const profileQuery = useProfile()
  const gmailQuery = useGmailConnection()
  const connectGmail = useConnectGmail()
  const disconnectGmail = useDisconnectGmail()
  const syncEmails = useSyncEmails()
  const acknowledgeRisk = useSetAiRiskAcknowledgement(
    auth.user?.id ?? '',
    Boolean(profileQuery.data),
  )
  const [searchParams] = useSearchParams()
  const gmailOutcome = searchParams.get('gmail')

  return (
    <div className="space-y-6">
      <PageHeader
        description="Manage workspace preferences and the read-only Gmail connection."
        eyebrow="Workspace"
        title="Settings"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {profileQuery.isPending ? (
          <p className="text-muted-foreground text-sm">Loading settings…</p>
        ) : profileQuery.isError ? (
          <p className="text-destructive text-sm">
            Settings could not be loaded.
          </p>
        ) : (
          <ProfileForm
            key={profileQuery.data?.updated_at ?? 'new-profile'}
            profile={profileQuery.data}
          />
        )}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Gmail connection</CardTitle>
                <Badge
                  variant={
                    gmailQuery.data?.status === 'connected'
                      ? 'default'
                      : 'outline'
                  }
                >
                  {gmailQuery.data?.status ?? 'Checking…'}
                </Badge>
              </div>
              <CardDescription>
                Separate read-only Gmail authorization. Existing messages are
                not processed when first connected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {gmailOutcome === 'success' ? (
                <p className="text-primary text-sm">Gmail connected.</p>
              ) : null}
              {gmailOutcome === 'error' ? (
                <p className="text-destructive text-sm">
                  Gmail authorization failed or expired. Try connecting again.
                </p>
              ) : null}
              {gmailQuery.data?.last_successful_sync_at ? (
                <p className="text-muted-foreground text-sm">
                  Last successful sync:{' '}
                  {formatDate(gmailQuery.data.last_successful_sync_at)}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {gmailQuery.data?.connected ? (
                  <>
                    <Button
                      disabled={syncEmails.isPending}
                      onClick={() => syncEmails.mutate()}
                      type="button"
                    >
                      <RefreshCw aria-hidden="true" className="size-4" />
                      {syncEmails.isPending ? 'Syncing…' : 'Sync emails now'}
                    </Button>
                    <Button
                      disabled={disconnectGmail.isPending}
                      onClick={() => disconnectGmail.mutate()}
                      type="button"
                      variant="outline"
                    >
                      <Unplug aria-hidden="true" className="size-4" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={connectGmail.isPending || gmailQuery.isPending}
                    onClick={() => connectGmail.mutate()}
                    type="button"
                  >
                    <Link2 aria-hidden="true" className="size-4" /> Connect
                    Gmail
                  </Button>
                )}
              </div>
              {connectGmail.isError ||
              disconnectGmail.isError ||
              syncEmails.isError ? (
                <p className="text-destructive text-sm">
                  The Gmail request could not be completed safely.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Privacy and integrations</CardTitle>
                <Badge variant="warning">Residual risk</Badge>
              </div>
              <CardDescription>
                Gemini processing is controlled by server-side release gates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6">
              <div className="bg-muted/60 flex gap-3 rounded-xl p-4">
                <ShieldCheck
                  aria-hidden="true"
                  className="text-primary mt-0.5 size-5 shrink-0"
                />
                <p>
                  InternPilot never stores raw email bodies. Email processing
                  filters locally, removes personal and sensitive information,
                  and blocks uncertain sanitization for manual review.
                </p>
              </div>
              <p className="text-muted-foreground">
                Automated redaction is best-effort and cannot guarantee complete
                privacy. Gemini remains disabled unless all server-side release
                gates and this acknowledgement are enabled.
              </p>
              <label className="border-border flex items-start gap-3 rounded-xl border p-4">
                <input
                  checked={Boolean(profileQuery.data?.ai_risk_acknowledged_at)}
                  className="mt-1 size-4"
                  disabled={acknowledgeRisk.isPending || profileQuery.isPending}
                  onChange={(event) =>
                    acknowledgeRisk.mutate(event.target.checked)
                  }
                  type="checkbox"
                />
                <span>
                  I understand automated sanitization cannot guarantee complete
                  privacy and that permitted excerpts retain disclosure risk.
                  This acknowledgement alone does not enable Gemini.
                </span>
              </label>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
