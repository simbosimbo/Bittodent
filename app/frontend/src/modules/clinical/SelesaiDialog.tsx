import { useState } from 'react'
import { ATTESTATION } from './api'

// Selesai = tanda tangan elektronik + tutup kunjungan (DEVIATIONS #55): what will be locked + the attestation + a PIN only when the
// clinic requires one. The server re-checks everything and stores its own copy of the attestation text.
export function SelesaiDialog({ lines, pinRequired, hasPin, busy, error, onConfirm, onClose }: {
  lines: string[]; pinRequired: boolean; hasPin: boolean; busy: boolean; error: string; onConfirm: (pin?: string) => void; onClose: () => void
}) {
  const [checked, setChecked] = useState(false)
  const [pin, setPin] = useState('')
  const needPin = pinRequired && hasPin
  const ready = checked && !busy && (!pinRequired || (hasPin && /^\d{6}$/.test(pin)))
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card dialog" role="dialog" aria-modal="true" aria-labelledby="selesai-title" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (ready) onConfirm(needPin ? pin : undefined) }}>
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
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={!ready}>{busy ? 'Menyimpan…' : 'Selesai'}</button>
        </div>
      </form>
    </div>
  )
}
