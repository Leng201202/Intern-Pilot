import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardHeader>
        <p className="text-primary text-sm font-semibold">404</p>
        <CardTitle className="text-xl">Page not found</CardTitle>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/">Return to dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
