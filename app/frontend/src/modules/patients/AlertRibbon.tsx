import { useEffect, useState } from 'react'
import { buttonVariants } from '@heroui/react'
import { Sheet } from '../../shared/ui/Sheet'
import { getAlerts, type Alerts } from './api'

// Medical-alert ribbon under the top bar: shown on every screen while a patient is active.
// Premedication and the urgent note come first and are highlighted.
export const ALERTS_CHANGED = 'ehr:alerts-changed'

const PREFIX = 'Kondisi: '
type Chip = { type: 'premedikasi' | 'catatan_penting' | 'alergi' | 'penyakit' | 'obat' | 'kosong'; text: string }

export function alertChips(a: Alerts): Chip[] {
  if (a.version === null) return [{ type: 'kosong', text: 'Riwayat medis belum diisi' }]
  return [
    ...(a.premedication_required ? [{ type: 'premedikasi', text: 'Perlu premedikasi' } as Chip] : []),
    ...(a.has_urgent_note ? [{ type: 'catatan_penting', text: a.urgent_note ? 'Penting: ' + a.urgent_note : 'Ada catatan penting (tanyakan dokter)' } as Chip] : []),
    ...(a.allergies.length ? a.allergies.map((t): Chip => ({ type: 'alergi', text: 'Alergi: ' + t })) : [{ type: 'kosong', text: 'Tidak ada alergi tercatat' } as Chip]),
    ...(a.problems ?? []).map((t): Chip => ({ type: 'penyakit', text: PREFIX + t })),
    ...(a.medications ?? []).map((t): Chip => ({ type: 'obat', text: 'Obat: ' + t })),
  ]
}

const ICON: Record<Chip['type'], string> = { premedikasi: '⚠', catatan_penting: '❗', alergi: '⚠', penyakit: '♥', obat: '℞', kosong: '' }

// Collapsed (compact) hides only medications; premed, urgent note, allergies, conditions and empty states always show.
const MINOR: Chip['type'][] = ['obat']

/** The patient's alerts (reloaded on ALERTS_CHANGED); null while loading or for another patient. */
export function useAlerts(patientId: string) {
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
  return state?.id === patientId ? state : null
}

// `only`: restrict to these chip types (tooth-sheet strip shows the safety ones only).
export function AlertRibbon({ patientId, compactDefault = false, label = 'Peringatan medis pasien aktif', className = '', only }: { patientId: string; compactDefault?: boolean; label?: string; className?: string; only?: Chip['type'][] }) {
  // User override resets when the route default changes (chart vs other pages).
  const [pickOpen, setPickOpen] = useState<{ base: boolean; v: boolean } | null>(null)
  const open = pickOpen?.base === compactDefault ? pickOpen.v : !compactDefault
  const s = useAlerts(patientId)
  const chips = s?.alerts ? alertChips(s.alerts).filter((c) => !only || only.includes(c.type)) : []
  const minor = chips.filter((c) => MINOR.includes(c.type)).length
  return (
    <div className={'alert-ribbon' + (open ? '' : ' is-compact') + (className ? ' ' + className : '')} role="region" aria-label={label}>
      {s?.error ? <span className="alert-chip alert-catatan_penting" role="alert">{s.error}</span>
        : !s?.alerts ? <span className="muted small">Memuat peringatan medis…</span>
        : chips.filter((c) => open || !MINOR.includes(c.type)).map((c, i) => (
          <span key={i} className={'alert-chip alert-' + c.type} data-type={c.type}>
            {ICON[c.type] && <span aria-hidden="true">{ICON[c.type]}</span>}
            {/* Compact header shows the bare condition (as in the sketch); screen readers still hear the type. */}
            {!open && c.type === 'penyakit' ? <><span className="sr-only">{PREFIX}</span>{c.text.slice(PREFIX.length)}</> : c.text}
          </span>
        ))}
      {/* One actions row: inline on desktop (display: contents), its own row under the chips on a phone. */}
      {(minor > 0 || (s?.alerts?.full && !only)) && <span className="alert-actions">
        {minor > 0 && (
          <button type="button" className="alert-toggle" aria-expanded={open} onClick={() => setPickOpen({ base: compactDefault, v: !open })}>
            {open ? 'Sembunyikan obat' : `+${minor} obat`}
          </button>
        )}
        {s?.alerts?.full && !only && <a className="alert-link" href={'#/riwayat-medis/' + patientId}>Riwayat medis →</a>}
      </span>}
    </div>
  )
}

/**
 * Phone, chart scrolled past the patient header: one-line safety strip (premed, urgent note, allergies by name, "+n" for the rest).
 * Never hides allergies; the full list (with medications and the urgent note's text) opens in a sheet.
 */
export function AlertStrip({ patientId, onOpen }: { patientId: string; onOpen: () => void }) {
  const s = useAlerts(patientId)
  if (s?.error) return <p className="alert-strip-error" role="alert">{s.error}</p>
  if (!s?.alerts) return <span className="muted small">Memuat peringatan medis…</span>
  const a = s.alerts
  const rest = (a.problems ?? []).length + (a.medications ?? []).length
  const allergy = a.version === null ? 'Riwayat medis belum diisi' : a.allergies.length ? 'Alergi: ' + a.allergies.join(', ') : 'Tidak ada alergi tercatat'
  const spoken = [a.premedication_required && 'perlu premedikasi', a.has_urgent_note && 'ada catatan penting', allergy, rest > 0 && rest + ' lainnya'].filter(Boolean).join(', ')
  return (
    <button type="button" className="alert-strip" aria-haspopup="dialog" aria-label={'Peringatan medis: ' + spoken + '. Buka semua'} onClick={onOpen}>
        {a.premedication_required && <span className="alert-chip alert-premedikasi"><span aria-hidden="true">{ICON.premedikasi}</span>Premedikasi</span>}
        {a.has_urgent_note && <span className="alert-chip alert-catatan_penting"><span aria-hidden="true">{ICON.catatan_penting}</span>Penting</span>}
        <span className={'alert-chip ' + (a.allergies.length ? 'alert-alergi' : 'alert-kosong')}>{allergy}</span>
      {rest > 0 && <span className="alert-chip alert-strip-more">+{rest} ›</span>}
    </button>
  )
}

/** Every alert of the patient (medications and the urgent note's text included), opened from AlertStrip. Rendered outside the fixed strip so it sits above the bottom nav. */
export function AlertSheet({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const a = useAlerts(patientId)?.alerts
  return (
    <Sheet title="Peringatan medis" onClose={onClose} className="alert-sheet">
      {!a ? <p className="muted">Memuat peringatan medis…</p> : (
        <ul className="alert-sheet-list">
          {alertChips(a).map((c, i) => <li key={i} className={'alert-chip alert-' + c.type}>{ICON[c.type] && <span aria-hidden="true">{ICON[c.type]}</span>}{c.text}</li>)}
        </ul>
      )}
      {a?.full && <a className={buttonVariants({ variant: 'secondary', fullWidth: true }) + ' mt-2'} href={'#/riwayat-medis/' + patientId} onClick={onClose}>Riwayat medis lengkap →</a>}
    </Sheet>
  )
}
