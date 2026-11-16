import type { ReactNode } from 'react'
import { Icon, ICONS } from './Icon'

type Props = { title: ReactNode; sub?: ReactNode; media?: ReactNode; aside?: ReactNode; className?: string; 'aria-label'?: string }
  & ({ href: string; onPress?: never } | { onPress: () => void; href?: never })

/** "Open detail" row: the whole card is one target (link or button), chevron on the right. */
export function RowLink({ title, sub, media, aside, className, href, onPress, ...aria }: Props) {
  const cls = 'bt-row' + (className ? ' ' + className : '')
  const body = <>
    {media}
    <span className="bt-row-main"><strong>{title}</strong>{sub && <span className="bt-row-sub">{sub}</span>}</span>
    {aside && <span className="bt-row-aside">{aside}</span>}
    <span className="bt-row-chev" aria-hidden="true"><Icon d={ICONS.right} size={18} /></span>
  </>
  return href !== undefined
    ? <a className={cls} href={href} {...aria}>{body}</a>
    : <button type="button" className={cls} onClick={onPress} {...aria}>{body}</button>
}
