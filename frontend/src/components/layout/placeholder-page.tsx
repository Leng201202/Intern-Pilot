import { Construction } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function PlaceholderPage({
  description,
  nextPhase,
  title,
}: {
  description: string
  nextPhase: string
  title: string
}) {
  return (
    <div className="space-y-8">
      <PageHeader description={description} eyebrow="Workspace" title={title} />

      <Card className="border-dashed">
        <CardHeader>
          <div className="bg-primary/10 text-primary mb-3 grid size-10 place-items-center rounded-xl">
            <Construction aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>Foundation ready</CardTitle>
          <CardDescription>
            This route is intentionally a placeholder in Phase 0.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="outline">Planned for {nextPhase}</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
