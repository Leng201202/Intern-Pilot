import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CircleAlert,
  Inbox,
} from 'lucide-react'

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

const metrics = [
  { label: 'Active applications', value: '—', icon: BriefcaseBusiness },
  { label: 'Needs attention', value: '—', icon: CircleAlert },
  { label: 'Upcoming deadlines', value: '—', icon: CalendarClock },
  { label: 'Review queue', value: '—', icon: Inbox },
] as const

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        action={
          <Button disabled type="button">
            Add application
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Button>
        }
        description="A focused view of applications, deadlines, and items that need a decision. Data features arrive in later phases."
        eyebrow="Overview"
        title="Good morning"
      />

      <section
        aria-label="Application metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {value}
                </p>
              </div>
              <div className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
                <Icon aria-hidden="true" className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Application pipeline</CardTitle>
                <CardDescription>
                  Status totals will appear after the tracker is implemented.
                </CardDescription>
              </div>
              <Badge variant="outline">Phase 2</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border-border bg-muted/40 text-muted-foreground grid min-h-48 place-items-center rounded-xl border border-dashed px-6 text-center text-sm">
              No application data is loaded in Phase 0.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>
              Integration readiness at a glance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['Frontend foundation', 'Ready'],
              ['Supabase connection', 'Configuration only'],
              ['Gmail monitoring', 'Not enabled'],
              ['External AI', 'Not enabled'],
            ].map(([label, status]) => (
              <div
                className="bg-muted/60 flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-sm"
                key={label}
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground font-medium">{status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
