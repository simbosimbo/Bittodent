import { useState } from 'react'

// Deliberate signing: what will be locked + "I checked" + a re-entered TOTP code. The server re-checks all of it.
export function SignDialog({ lines, busy, error, onConfirm, onClose }: {
  lines: string[]; busy: boolean; error: string; onConfirm: (code: string) => void; onClose: () => void
}) {
  const [checked, setChecked] = useState(false)
  const [code, setCode] = useState('')
  const ready = checked && /^\d{6}$/.test(code) && !busy
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card dialog" role="dialog" aria-modal="true" aria-labelledby="sign-title" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (ready) onConfirm(code) }}>
        <h2 id="sign-title">Tanda tangani rekam medis</h2>
        <p>Yang akan dikunci:</p>
        <ul className="sign-list">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <p className="muted small">Setelah ditandatangani, isi ini tidak bisa diubah. Perubahan hanya lewat koreksi dengan alasan; versi lama tetap tersimpan.</p>
        <label className="check"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> Saya sudah memeriksa isi di atas dan bertanggung jawab atasnya.</label>
        <label>Kode autentikator (6 angka)
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={!ready}>{busy ? 'Menandatangani…' : 'Tanda Tangani'}</button>
        </div>
      </form>
    </div>
  )
}
