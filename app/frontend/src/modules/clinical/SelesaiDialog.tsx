import { useState, useRef } from 'react'
import { useIsMobile } from '../../shared/useIsMobile'
import { useDialog } from '../../shared/ui/Sheet'
import { usePresenceClass } from '../../shared/ui/presence'
import { ATTESTATION } from './api'
import { WARNING_REASONS } from './quick'

// Selesai = tanda tangan elektronik + tutup kunjungan (DEVIATIONS #55): what will be locked + the attestation + a PIN only when the
// clinic requires one. The server re-checks everything and stores its own copy of the attestation text.
// #70: SignCheck warnings come back from the server; the dentist answers with a reason chip (or 10+ letters) and Selesai again.
export function SelesaiDialog({ lines, pinRequired, hasPin, busy, error, warnings, onConfirm, onClose }: {
  lines: string[]; pinRequired: boolean; hasPin: boolean; busy: boolean; error: string; warnings?: { message: string }[]
  onConfirm: (pin?: string, reason?: string) => void; onClose: () => void
}) {
  const [checked, setChecked] = useState(false)
  const [pin, setPin] = useState('')
  const [reason, setReason] = useState('')
  const needPin = pinRequired && hasPin
  const warned = !!warnings?.length
  const ready = checked && !busy && (!pinRequired || (hasPin && /^\d{6}$/.test(pin))) && (!warned || reason.trim().length >= 10)
  // Phone: bottom sheet (styles.css) with modal focus/Escape/scroll lock; desktop behaviour unchanged.
  const dlg = useRef<HTMLFormElement>(null)
  const phase = usePresenceClass()
  useDialog(dlg, onClose, useIsMobile())
  return (
    <div className={`overlay ${phase}`} onClick={onClose}>
      <form ref={dlg} className="card dialog" role="dialog" aria-modal="true" aria-labelledby="selesai-title" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (ready) onConfirm(needPin ? pin : undefined, warned ? reason.trim() : undefined) }}>
        <h2 id="selesai-title">Selesai: kunci rekam medis dan tutup kunjungan</h2>
        <p>Yang akan dikunci:</p>
        <ul className="sign-list">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <p className="muted small">Setelah Selesai, isi ini tidak bisa diubah. Perubahan hanya lewat koreksi dengan alasan; versi lama tetap tersimpan.</p>
        <label className="check"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> {ATTESTATION}</label>
        {pinRequired && (hasPin
          ? <label>PIN Selesai (6 angka)
              <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            </label>
          : <p className="notice notice-warn small" role="status">Klinik mewajibkan PIN saat Selesai. Atur PIN Anda dulu di <a href="#/pengaturan-rm">Pengaturan RM</a>.</p>)}
        {warned && (
          <div className="sign-warnings" role="alert">
            <p><strong>Peringatan</strong> · pilih alasan untuk tetap Selesai:</p>
            <ul>{warnings!.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
            <div className="soap-quick" role="group" aria-label="Alasan">
              {WARNING_REASONS.map((r) => <button key={r} type="button" className="btn chip-quick" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}
            </div>
            <label className="small">Alasan lain <input value={WARNING_REASONS.includes(reason) ? '' : reason} onChange={(e) => setReason(e.target.value)} /></label>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={!ready}>{busy ? 'Menyimpan…' : warned ? 'Selesai dengan alasan' : 'Selesai'}</button>
        </div>
      </form>
    </div>
  )
}
