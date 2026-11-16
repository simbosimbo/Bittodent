import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import type { Me } from '../../shared/session'
import { getCatalog, getClinicSettings, saveClinicSettings, searchIcd10, setCatalogDiagnosis, setSelesaiPin, type CatalogRow } from './api'

// Pengaturan RM (#55): the one place for the owner's clinic settings (GET/PUT /api/settings/clinic, settings.manage): tenggat koreksi
// (jam) + "Wajibkan PIN saat Selesai" + "Mode Pemeriksaan awal". Whoever may press Selesai sets / changes their own PIN here too (no reporting.read needed).
export default function SettingsRmPage({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const canManage = me.permissions.includes('settings.manage')
  const canSign = me.permissions.includes('note.sign')
  return (
    <>
      <div className="page-head"><h1>Pengaturan RM</h1></div>
      {canManage && <ClinicSettingsForm onChanged={onChanged} />}
      {canSign && <OwnPin hasPin={!!me.selesai?.has_pin} required={!!me.selesai?.pin_required} onChanged={onChanged} />}
      {canSign && <DefaultDiagnoses />}
    </>
  )
}

// S8: a dentist pairs a default ICD-10 with each procedure; the server uses it when a procedure is saved without a diagnosis.
function DefaultDiagnoses() {
  const [rows, setRows] = useState<CatalogRow[] | null>(null)
  const [editing, setEditing] = useState('') // procedure_code whose search box is in use
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ code: string; display: string }[]>([])
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { getCatalog().then(setRows, (e) => setError(errorText(e))) }, [])
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    let live = true
    const t = setTimeout(() => searchIcd10(q.trim()).then((r) => { if (live) setHits(r) }, (e) => { if (live) setError(errorText(e)) }), 250)
    return () => { live = false; clearTimeout(t) }
  }, [q])
  async function pick(code: string, icd10: string | null) {
    setMsg('')
    setError('')
    try {
      const row = await setCatalogDiagnosis(code, icd10)
      setRows((rs) => rs && rs.map((r) => (r.procedure_code === code ? row : r)))
      setEditing('')
      setQ('')
      setMsg(icd10 ? `Diagnosis bawaan ${row.name} disimpan.` : `Diagnosis bawaan ${row.name} dihapus.`)
    } catch (err) { setError(errorText(err)) }
  }
  return (
    <section className="card">
      <h2>Diagnosis bawaan per tindakan</h2>
      <p className="muted small">Dipakai saat tindakan diisi tanpa diagnosis. Ditetapkan dokter gigi; dicatat di audit.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {msg && <p className="notice" role="status">{msg}</p>}
      {!rows ? <p className="muted">Memuat…</p> : (
        <div className="stack">
          {rows.map((r) => (
            <div key={r.procedure_code}>
              <strong>{r.name}</strong> <span className="muted small">{r.procedure_code}</span>
              <p className="small">
                {r.default_icd10 ? `${r.default_icd10} ${r.default_icd10_display ?? ''}` : <span className="muted">Belum ada</span>}
                {r.default_icd10 && <> <button type="button" className="btn-link" aria-label={`Hapus diagnosis bawaan ${r.name}`} onClick={() => pick(r.procedure_code, null)}>Hapus</button></>}
              </p>
              <input type="search" aria-label={`Cari ICD-10 untuk ${r.name}`} placeholder="Cari kode atau nama ICD-10"
                value={editing === r.procedure_code ? q : ''} onChange={(e) => { if (editing !== r.procedure_code) setHits([]); setEditing(r.procedure_code); setQ(e.target.value) }} />
              {editing === r.procedure_code && hits.length > 0 && (
                <div>
                  {hits.map((h) => <div key={h.code}><button type="button" className="btn-link" onClick={() => pick(r.procedure_code, h.code)}>{h.code} · {h.display}</button></div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ClinicSettingsForm({ onChanged }: { onChanged: () => void }) {
  const [hours, setHours] = useState('')
  const [pin, setPin] = useState(false)
  const [exam, setExam] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    getClinicSettings().then((s) => { setHours(String(s.correction_window_hours)); setPin(s.selesai_pin_required); setExam(s.odontogram_exam_enabled); setLoaded(true) }, (e) => setError(errorText(e)))
  }, [])
  async function save(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    const n = Number(hours)
    if (!Number.isInteger(n) || n < 1 || n > 720) return setError('Tenggat koreksi 1–720 jam.')
    try {
      const s = await saveClinicSettings({ correction_window_hours: n, selesai_pin_required: pin, odontogram_exam_enabled: exam })
      setHours(String(s.correction_window_hours))
      setPin(s.selesai_pin_required)
      setExam(s.odontogram_exam_enabled)
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
      <label className="check"><input type="checkbox" disabled={!loaded} checked={exam} onChange={(e) => setExam(e.target.checked)} /> Tampilkan mode Pemeriksaan awal di odontogram</label>
      <p className="muted small">Bawaan: nyala, tidak wajib. Bila mati, odontogram hanya diisi dari tindakan (mode Perawatan).</p>
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
