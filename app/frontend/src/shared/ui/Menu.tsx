import { useState, type ReactNode } from 'react'
import { Button, Popover } from '@heroui/react'

/** Disclosure menu (HeroUI Popover: button + popover of links/buttons). Closes on Escape (focus back to the button), click outside, or `close()`. */
export function Menu({ label, trigger, className, align = 'right', children }: {
  label: string
  trigger: ReactNode
  className?: string
  align?: 'left' | 'right'
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button variant="ghost" className={className} aria-label={label}>{trigger}</Button>
      <Popover.Content placement={align === 'right' ? 'bottom end' : 'bottom start'}>
        <Popover.Dialog aria-label={label} className="menu-pop">{children(() => setOpen(false))}</Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
