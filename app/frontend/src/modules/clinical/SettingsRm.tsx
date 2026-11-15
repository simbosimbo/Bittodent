import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import type { Me } from '../../shared/session'
import { getClinicSettings, saveClinicSettings, setSelesaiPin } from './api'

// Pengaturan RM (#55): the one place for the owner's clinic settings (GET/PUT /api/settings/clinic, settings.manage): tenggat koreksi
// (jam) + "Wajibkan PIN saat Selesai". Whoever may press Selesai sets / changes their own PIN here too (no reporting.read needed).
export default function SettingsRmPage({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const canManage = me.permissions.includes('settings.manage')
  const canSign = me.permissions.includes('note.sign')
  return (
    <>
      <div className="page-head"><h1>Pengaturan RM</h1></div>
      {canManage && <ClinicSettingsForm onChanged={onChanged} />}
      {canSign && <OwnPin hasPin={!!me.selesai?.has_pin} required={!!me.selesai?.pin_required} onChanged={onChanged} />}
    </>
  )
}

function ClinicSettingsForm({ onChanged }: { onChanged: () => void }) {
  const [hours, setHours] = useState('')
  const [pin, setPin] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    getClinicSettings().then((s) => { setHours(String(s.correction_window_hours)); setPin(s.selesai_pin_required); setLoaded(true) }, (e) => setError(errorText(e)))
  }, [])
  async function save(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    const n = Number(hours)
    if (!Number.isInteger(n) || n < 1 || n > 720) return setError('Tenggat koreksi 1–720 jam.')
    try {
      const s = await saveClinicSettings({ correction_window_hours: n, selesai_pin_required: pin })
      setHours(String(s.correction_window_hours))
      setPin(s.selesai_pin_required)
      setError('')
      setMsg('Pengaturan tersimpan.')
      onChanged()
    } catch (err) { setError(errorText(err)) }
  }
  return (
    <form className="card" onSubmit={save} noValidate>
      <h2>Pengaturan klinik</h2>
      <label>Tenggat koreksi bebas (jam) <input type="number" min={1} max={720} disabled={!loaded} value={hours} onChange={(e) => setHours(e.target.value)} /></label>
      <p className="muted small">Bawaan 48 jam (2×24 jam) sejak tindakan difinalkan. Lewat tenggat, koreksi menunggu persetujuan pemilik. Setiap koreksi disimpan sebagai versi baru dengan alasannya; versi lama tetap tersimpan.</p>
      <label className="check"><input type="checkbox" disabled={!loaded} checked={pin} onChange={(e) => setPin(e.target.checked)} /> Wajibkan PIN saat Selesai</label>
      <p className="muted small">Bawaan: mati. Bila nyala, dokter memasukkan PIN 6 angka miliknya setiap menekan Selesai.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {msg && <p className="notice" role="status">{msg}</p>}
      <div className="toolbar"><button className="btn btn-primary" disabled={!loaded}>Simpan pengaturan</button></div>
    </form>
  )
}

function OwnPin({ hasPin, required, onChanged }: { hasPin: boolean; required: boolean; onChanged: () => void }) {
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    setError('')
    try {
      await setSelesaiPin(pin, hasPin ? current : undefined)
      setPin('')
      setCurrent('')
      setMsg(hasPin ? 'PIN diubah.' : 'PIN tersimpan.')
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError && [403, 422].includes(err.status) ? err.data?.message ?? 'PIN tidak valid.' : errorText(err))
    }
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2>PIN Selesai saya</h2>
      <p className="muted small">{hasPin ? 'PIN sudah diatur.' : 'Belum ada PIN.'} {required ? 'Klinik ini mewajibkan PIN saat Selesai.' : 'Klinik ini belum mewajibkan PIN.'}</p>
      {hasPin && <label>PIN lama <input type="password" inputMode="numeric" autoComplete="off" value={current} onChange={(e) => setCurrent(digits(e.target.value))} /></label>}
      <label>PIN baru (6 angka) <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(digits(e.target.value))} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {msg && <p className="notice" role="status">{msg}</p>}
      <div className="toolbar"><button className="btn btn-primary" disabled={pin.length !== 6 || (hasPin && current.length !== 6)}>{hasPin ? 'Ubah PIN' : 'Simpan PIN'}</button></div>
    </form>
  )
}
