import { Button, Card } from '@heroui/react'
import type { ReactNode } from 'react'

/** Whole-page loading / empty / error state. With `error` it is announced and offers "Coba lagi" when `onRetry` is given. */
export function StateCard({ error, onRetry, children }: { error?: ReactNode; onRetry?: () => void; children?: ReactNode }) {
  if (!error) return <Card className="bt-state">{children}</Card>
  return (
    <Card className="bt-state is-error" role="alert">
      <p>{error}</p>
      {children}
      {onRetry && <Button variant="secondary" onPress={onRetry}>Coba lagi</Button>}
    </Card>
  )
}
