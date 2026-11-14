import { useEffect, useState } from 'react'
import { getAlerts, type Alerts } from './api'

// Medical-alert ribbon under the top bar: shown on every screen while a patient is active.
// Premedication and the urgent note come first and are highlighted.
export const ALERTS_CHANGED = 'ehr:alerts-changed'

type Chip = { type: 'premedikasi' | 'catatan_penting' | 'alergi' | 'penyakit' | 'obat' | 'kosong'; text: string }

export function alertChips(a: Alerts): Chip[] {
  if (a.version === null) return [{ type: 'kosong', text: 'Riwayat medis belum diisi' }]
  return [
    ...(a.premedication_required ? [{ type: 'premedikasi', text: 'Perlu premedikasi' } as Chip] : []),
    ...(a.has_urgent_note ? [{ type: 'catatan_penting', text: a.urgent_note ? 'Penting: ' + a.urgent_note : 'Ada catatan penting (tanyakan dokter)' } as Chip] : []),
    ...(a.allergies.length ? a.allergies.map((t): Chip => ({ type: 'alergi', text: 'Alergi: ' + t })) : [{ type: 'kosong', text: 'Tidak ada alergi tercatat' } as Chip]),
    ...(a.problems ?? []).map((t): Chip => ({ type: 'penyakit', text: 'Kondisi: ' + t })),
    ...(a.medications ?? []).map((t): Chip => ({ type: 'obat', text: 'Obat: ' + t })),
  ]
}

const ICON: Record<Chip['type'], string> = { premedikasi: '⚠', catatan_penting: '❗', alergi: '⚠', penyakit: '♥', obat: '℞', kosong: '' }

// Collapsed (compact) hides only conditions/medications; premed, urgent note, allergies and empty states always show.
const MINOR: Chip['type'][] = ['penyakit', 'obat']

export function AlertRibbon({ patientId, compactDefault = false, label = 'Peringatan medis pasien aktif', className = '' }: { patientId: string; compactDefault?: boolean; label?: string; className?: string }) {
  // User override resets when the route default changes (chart vs other pages).
  const [pickOpen, setPickOpen] = useState<{ base: boolean; v: boolean } | null>(null)
  const open = pickOpen?.base === compactDefault ? pickOpen.v : !compactDefault
  const [state, setState] = useState<{ id: string; alerts: Alerts | null; error: string } | null>(null)
  useEffect(() => {
    let live = true
    const load = () => getAlerts(patientId).then(
      (alerts) => live && setState({ id: patientId, alerts, error: '' }),
      () => live && setState({ id: patientId, alerts: null, error: 'Peringatan medis gagal dimuat — cek riwayat medis sebelum tindakan.' }))
    load()
    addEventListener(ALERTS_CHANGED, load)
    return () => { live = false; removeEventListener(ALERTS_CHANGED, load) }
  }, [patientId])

  const s = state?.id === patientId ? state : null
  const chips = s?.alerts ? alertChips(s.alerts) : []
  const minor = chips.filter((c) => MINOR.includes(c.type)).length
  return (
    <div className={'alert-ribbon' + (open ? '' : ' is-compact') + (className ? ' ' + className : '')} role="region" aria-label={label}>
      {s?.error ? <span className="alert-chip alert-catatan_penting" role="alert">{s.error}</span>
        : !s?.alerts ? <span className="muted small">Memuat peringatan medis…</span>
        : chips.filter((c) => open || !MINOR.includes(c.type)).map((c, i) => (
          <span key={i} className={'alert-chip alert-' + c.type} data-type={c.type}>
            {ICON[c.type] && <span aria-hidden="true">{ICON[c.type]}</span>}{c.text}
          </span>
        ))}
      {minor > 0 && (
        <button type="button" className="alert-toggle" aria-expanded={open} onClick={() => setPickOpen({ base: compactDefault, v: !open })}>
          {open ? 'Ciutkan' : `Selengkapnya (+${minor} lainnya)`}
        </button>
      )}
      {s?.alerts?.full && <a className="alert-link" href={'#/riwayat-medis/' + patientId}>Riwayat medis →</a>}
    </div>
  )
}
