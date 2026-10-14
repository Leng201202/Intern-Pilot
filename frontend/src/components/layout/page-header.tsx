import type { ReactNode } from 'react'

export function PageHeader({
  description,
  eyebrow,
  title,
  action,
}: {
  description: string
  eyebrow: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
          {eyebrow}
        </p>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
          {description}
        </p>
      </div>
      {action}
    </div>
  )
}
