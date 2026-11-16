import { Alert } from '@heroui/react'
import type { ReactNode } from 'react'

type Status = 'accent' | 'danger' | 'warning' | 'success' | 'default'

/** A one-block notice on HeroUI Alert. Alert sets no role itself: pass status (news), alert (error), note (hint) or alertdialog. */
export function Note({ status = 'accent', role, className, children, ...aria }: {
  status?: Status; role?: string; className?: string; children: ReactNode; 'aria-labelledby'?: string; 'aria-label'?: string
}) {
  return (
    <Alert status={status} role={role} className={className} {...aria}>
      <Alert.Indicator />
      <Alert.Content><Alert.Description>{children}</Alert.Description></Alert.Content>
    </Alert>
  )
}
