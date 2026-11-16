import { Alert } from '@heroui/react'
import type { ReactNode } from 'react'

type Status = 'accent' | 'danger' | 'warning' | 'success' | 'default'

/** A one-block notice on HeroUI Alert. Alert sets no role itself: pass status (news), alert (error) or note (hint). */
export function Note({ status = 'accent', role, className, children }: { status?: Status; role?: string; className?: string; children: ReactNode }) {
  return (
    <Alert status={status} role={role} className={className}>
      <Alert.Indicator />
      <Alert.Content><Alert.Description>{children}</Alert.Description></Alert.Content>
    </Alert>
  )
}
