import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import type { Me } from '../../shared/session'
import { getClinicSettings, saveClinicSettings, setSelesaiPin } from './api'

// Pengaturan RM (#54), minimal: owner toggles "PIN saat Selesai" (default off); whoever may press Selesai sets / changes their own PIN.
// The correction window (tenggat koreksi) stays on #/laporan for now.
export default function SettingsRmPage({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const canManage = me.permissions.includes('settings.manage')
  const canSign = me.permissions.includes('note.sign')
  return (
    <>
      <div className="page-head"><h1>Pengaturan RM</h1></div>
      {canManage && <PinRequirement onChanged={onChanged} />}
      {canSign && <OwnPin hasPin={!!me.selesai?.has_pin} required={!!me.selesai?.pin_required} onChanged={onChanged} />}
    </>
  )
}

function PinRequirement({ onChanged }: { onChanged: () => void }) {
  const [on, setOn] = useState<boolean | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { getClinicSettings().then((s) => setOn(s.selesai_pin_required), (e) => setMsg(errorText(e))) }, [])
  async function toggle(next: boolean) {
    setMsg('')
    try {
      setOn((await saveClinicSettings({ selesai_pin_required: next })).selesai_pin_required)
      setMsg('Pengaturan tersimpan.')
      onChanged()
    } catch (e) { setMsg(errorText(e)) }
  }
  return (
    <div className="card">
      <h2>PIN saat Selesai</h2>
      <label className="check"><input type="checkbox" disabled={on === null} checked={!!on} onChange={(e) => toggle(e.target.checked)} /> Wajibkan PIN saat Selesai</label>
      <p className="muted small">Bawaan: mati. Bila nyala, dokter memasukkan PIN 6 angka miliknya setiap menekan Selesai. Tenggat koreksi tindakan diatur di <a href="#/laporan">Laporan</a>.</p>
      {msg && <p className="notice" role="status">{msg}</p>}
    </div>
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
