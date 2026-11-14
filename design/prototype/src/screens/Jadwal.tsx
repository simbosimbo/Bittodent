import { useState } from 'react'
import { TODAY_LABEL } from '../data/mock'
import type { ApptStatus } from '../data/types'
import { hhmm } from '../lib/format'
import { go } from '../lib/router'
import { patientOf, useStore } from '../state/store'
import { APPT_STATUS, ScheduleGrid, Waitboard } from '../components/Schedule'
import { Badge, Button, Modal } from '../components/ui'

export function Jadwal({
  selectedId,
  onSelect,
  hideModal,
  compact,
}: {
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  hideModal?: boolean
  compact?: boolean
} = {}) {
  const { s, a } = useStore()
  const [internal, setInternal] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const controlled = onSelect !== undefined
  const open = controlled ? (selectedId ?? null) : internal
  const setOpen = (id: string | null) => {
    if (controlled) onSelect(id)
    else setInternal(id)
  }
  const branch = s.branches.find((b) => b.id === s.branchId)!
  const appt = s.appts.find((x) => x.id === open)
  const counts = (Object.keys(APPT_STATUS) as ApptStatus[]).map((k) => [k, s.appts.filter((x) => x.where === 'grid' && x.branchId === s.branchId && x.status === k).length] as const)

  const onSlot = (chairId: string, start: number) => {
    if (moving) { if (a.moveAppt(moving, 'grid', chairId, start)) setMoving(null); return }
    if (!s.activeId) { a.openSelector(true); a.toast('Pilih pasien aktif dulu, lalu ketuk slot lagi.'); return }
    a.book(s.activeId, chairId, start)
  }
  return (
    <div className={`screen jadwal-screen ${compact ? 'is-compact' : ''}`}>
      <div className="jadwal-toolbar">
        <Button size="sm" disabled title="Prototipe: hanya hari ini">Sebelumnya</Button>
        <Button size="sm" variant="primary">Hari ini</Button>
        <Button size="sm" disabled title="Prototipe: hanya hari ini">Berikutnya</Button>
        <strong>{TODAY_LABEL}</strong>
        <span className="muted">{branch.name} · waktu dalam WIB</span>
        <span className="spacer" />
        <div className="legend-row" aria-label="Status janji">
          {counts.map(([k, n]) => <span key={k} className={`status-key st-${k}`}><i aria-hidden />{APPT_STATUS[k]} <b>{n}</b></span>)}
          <span className="status-key blok"><i aria-hidden />Blok / istirahat</span>
        </div>
      </div>
      {moving && (
        <div className="callout info" role="status">
          Memindahkan janji {patientOf(s, s.appts.find((x) => x.id === moving)!.patientId)?.name}. Ketuk slot kosong di kursi tujuan.
          <Button size="sm" onClick={() => setMoving(null)}>Batal pindah</Button>
        </div>
      )}
      <p className="muted small hint-line">Ketuk slot kosong untuk memesan <strong>{patientOf(s, s.activeId)?.name ?? 'pasien aktif'}</strong>. Seret janji antara kursi dan papan tunggu.</p>
      <div className="jadwal-layout">
        <ScheduleGrid onSlot={onSlot} onOpen={setOpen} moving={moving} onDropAppt={(id, c, t) => a.moveAppt(id, 'grid', c, t)} />
        <Waitboard onOpen={setOpen} moving={moving} onDropTo={(id, w) => a.moveAppt(id, w)} />
      </div>

      {appt && !hideModal && (() => {
        const p = patientOf(s, appt.patientId)!
        return (
          <Modal title={`Janji: ${p.name}`} onClose={() => setOpen(null)} footer={<>
            <Button onClick={() => { setMoving(appt.id); setOpen(null) }}>Pindahkan (ketuk slot)</Button>
            {appt.where === 'grid' && <Button onClick={() => { a.moveAppt(appt.id, 'papan'); setOpen(null) }}>Ke papan tunggu</Button>}
            <Button variant="primary" onClick={() => { a.setActive(p.id); setOpen(null); go('/charting') }}>Jadikan pasien aktif & buka Charting</Button>
          </>}>
            <ApptFacts apptId={appt.id} />
          </Modal>
        )
      })()}
    </div>
  )
}

export function ApptFacts({ apptId }: { apptId: string }) {
  const { s, a } = useStore()
  const appt = s.appts.find((x) => x.id === apptId)
  if (!appt) return null
  const p = patientOf(s, appt.patientId)
  if (!p) return null
  const branch = s.branches.find((b) => b.id === s.branchId)
  return (
    <>
      <dl className="kv">
        <dt>No. RM</dt><dd>{p.rm}</dd>
        <dt>Waktu</dt><dd>{appt.start != null ? `${hhmm(appt.start)}–${hhmm(appt.start + appt.dur)} WIB` : appt.where === 'papan' ? 'Di papan tunggu' : 'Belum terjadwal'}</dd>
        <dt>Kursi</dt><dd>{branch?.chairs.find((c) => c.id === appt.chairId)?.name ?? '—'}</dd>
        <dt>Keperluan</dt><dd>{appt.label}</dd>
        <dt>Alergi</dt><dd>{p.allergies.length ? <Badge tone="danger">{p.allergies.join(', ')}</Badge> : 'Tidak ada alergi tercatat'}</dd>
      </dl>
      <fieldset className="status-pick">
        <legend>Ubah status</legend>
        {(Object.keys(APPT_STATUS) as ApptStatus[]).map((k) => (
          <button key={k} className={`status-btn st-${k} ${appt.status === k ? 'on' : ''}`} aria-pressed={appt.status === k} onClick={() => a.setApptStatus(appt.id, k)}>{APPT_STATUS[k]}</button>
        ))}
      </fieldset>
    </>
  )
}
