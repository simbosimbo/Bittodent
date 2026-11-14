import type { CSSProperties } from 'react'
import type { DragEvent } from 'react'
import { BLOCKS, DAY_END, DAY_START, SLOT } from '../data/mock'
import type { Appt, ApptStatus } from '../data/types'
import { hhmm } from '../lib/format'
import { patientOf, useStore } from '../state/store'
import { Icon } from './Icon'

export const APPT_STATUS: Record<ApptStatus, string> = { terjadwal: 'Terjadwal', checkin: 'Check-in', merawat: 'Sedang merawat', selesai: 'Selesai', batal: 'Batal' }
const ROW = 52 // px per 30 menit (>=44px target sentuh)
const slots = Array.from({ length: (DAY_END - DAY_START) / SLOT }, (_, i) => DAY_START + i * SLOT)
const drag = (id: string) => (e: DragEvent) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move' }

export function ApptCard({ a, onOpen, moving, style }: { a: Appt; onOpen: (id: string) => void; moving?: boolean; style?: CSSProperties }) {
  const { s } = useStore()
  const p = patientOf(s, a.patientId)!
  const active = s.activeId === a.patientId
  return (
    <button
      className={`appt st-${a.status} ${active ? 'is-active' : ''} ${moving ? 'is-moving' : ''}`} style={style}
      draggable onDragStart={drag(a.id)} onClick={(e) => { e.stopPropagation(); onOpen(a.id) }}
      aria-label={`${p.name}, ${a.start != null ? hhmm(a.start) + ' WIB, ' : ''}${APPT_STATUS[a.status]}. Seret untuk memindahkan.`}
    >
      <span className="appt-top"><Icon name="grip" size={14} className="grip" /><strong>{p.name}</strong></span>
      <span className="appt-meta">{a.start != null && <>{hhmm(a.start)}–{hhmm(a.start + a.dur)} · </>}{a.label}</span>
      <span className="appt-status">{APPT_STATUS[a.status]}</span>
    </button>
  )
}

export function ScheduleGrid({ onSlot, onOpen, moving, onDropAppt }: { onSlot: (chairId: string, start: number) => void; onOpen: (id: string) => void; moving: string | null; onDropAppt: (id: string, chairId: string, start: number) => void }) {
  const { s } = useStore()
  const branch = s.branches.find((b) => b.id === s.branchId)!
  const top = (m: number) => ((m - DAY_START) / SLOT) * ROW
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const showNow = nowMin >= DAY_START && nowMin < DAY_END
  return (
    <div className="sched" style={{ ['--cols' as string]: branch.chairs.length }}>
      <div className="sched-head"><span className="sched-corner">WIB</span>{branch.chairs.map((c) => <span key={c.id} className="sched-chair">{c.name}</span>)}</div>
      <div className="sched-body">
        {showNow && <div className="now-line" style={{ top: top(nowMin) }}><span>Sekarang</span></div>}
        <div className="sched-times">{slots.map((t) => <span key={t} style={{ height: ROW }}>{t % 60 === 0 ? hhmm(t) : ''}</span>)}</div>
        {branch.chairs.map((c) => (
          <div key={c.id} className="sched-col" style={{ height: slots.length * ROW }}>
            {slots.map((t) => (
              <button
                key={t} className={`slot ${moving ? 'is-target' : ''}`} style={{ top: top(t), height: ROW }}
                aria-label={`${c.name} ${hhmm(t)} WIB, slot kosong`}
                onClick={() => onSlot(c.id, t)}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drop') }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drop')}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drop'); onDropAppt(e.dataTransfer.getData('text/plain'), c.id, t) }}
              />
            ))}
            {BLOCKS.filter((b) => b.branchId === s.branchId && (b.chairId === 'all' || b.chairId === c.id)).map((b, i) => (
              <div key={i} className="block-time" style={{ top: top(b.start), height: (b.dur / SLOT) * ROW }} aria-label={`Waktu blok: ${b.label}`}>
                <Icon name="lock" size={14} />{b.label}
              </div>
            ))}
            {s.appts.filter((a) => a.where === 'grid' && a.branchId === s.branchId && a.chairId === c.id).map((a) => (
              <ApptCard key={a.id} a={a} onOpen={onOpen} moving={moving === a.id} style={{ top: top(a.start!) + 2, height: (a.dur / SLOT) * ROW - 4 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Papan tunggu (pinboard) + daftar belum terjadwal. Bisa menerima seretan dari grid.
export function Waitboard({ onOpen, moving, onDropTo }: { onOpen: (id: string) => void; moving: string | null; onDropTo: (id: string, where: 'papan' | 'belum') => void }) {
  const { s } = useStore()
  const list = (where: 'papan' | 'belum') => s.appts.filter((a) => a.where === where && a.branchId === s.branchId)
  const zone = (where: 'papan' | 'belum', title: string, hint: string) => (
    <section
      className="wait-zone" aria-label={title}
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drop') }}
      onDragLeave={(e) => e.currentTarget.classList.remove('drop')}
      onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drop'); onDropTo(e.dataTransfer.getData('text/plain'), where) }}
    >
      <h3>{title} <span className="count">{list(where).length}</span></h3>
      <p className="muted small">{hint}</p>
      <div className="wait-list">
        {list(where).map((a) => <ApptCard key={a.id} a={a} onOpen={onOpen} moving={moving === a.id} />)}
        {!list(where).length && <div className="wait-empty">Seret janji ke sini</div>}
      </div>
    </section>
  )
  return (
    <aside className="waitboard">
      {zone('papan', 'Papan tunggu', 'Tempat sementara saat memindah janji. Seret ke kursi, atau ketuk lalu pilih slot.')}
      {zone('belum', 'Belum terjadwal', 'Pasien yang perlu dibuatkan janji.')}
    </aside>
  )
}
