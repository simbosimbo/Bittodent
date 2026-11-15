import { cloneElement, useEffect, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { createPatient, getKtpPhoto, saveKtp, uploadKtpPhoto } from './api'
import { maskNik, nikMismatches, type KtpField } from './nik'
import type { OcrFlag } from './ocr/parseKtp'
import './ktp.css'

type Form = Record<'name' | 'dob' | 'sex' | 'nik' | 'phone' | 'address' | 'payer_type' | 'payer_name' | 'payer_member_no'
  | 'province_code' | 'regency_code' | 'district_code', string>
const EMPTY: Form = { name: '', dob: '', sex: '', nik: '', phone: '', address: '', payer_type: 'umum', payer_name: '', payer_member_no: '',
  province_code: '', regency_code: '', district_code: '' }
const KTP_CODES = ['province_code', 'regency_code', 'district_code'] as const
type Tab = 'daftar' | 'profil'
type Saved = { id: string; name: string; nikMasked: string; photoId?: string }
type FormKey = keyof Form

const FLAG_KEY: Record<string, FormKey | 'nik'> = {
  name: 'name', nik: 'nik', address: 'address', dob: 'dob', sex: 'sex',
  province: 'province_code', regency: 'regency_code', district: 'district_code',
}

// Mirrors StorePatientRequest; the server stays the source of truth.
export function validate(f: Form): Partial<Form> {
  const e: Partial<Form> = {}
  if (!f.name.trim()) e.name = 'Nama lengkap wajib diisi.'
  else if (!/\p{L}/u.test(f.name)) e.name = 'Nama harus mengandung huruf.'
  if (f.dob && f.dob > new Date().toISOString().slice(0, 10)) e.dob = 'Tanggal lahir tidak boleh di masa depan.'
  if (f.nik && !/^\d{16}$/.test(f.nik.replace(/[\s.-]/g, ''))) e.nik = 'NIK harus 16 angka.'
  if (f.phone && !/^\+?[0-9][0-9 -]{7,18}$/.test(f.phone)) e.phone = 'Nomor HP tidak valid.'
  if (f.payer_type === 'asuransi' && !f.payer_name.trim()) e.payer_name = 'Nama asuransi wajib diisi.'
  for (const k of KTP_CODES) if (f[k] && !/^\d{1,2}$/.test(f[k])) e[k] = '2 angka.'
  return e
}

async function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function Eye({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn ktp-reveal" aria-pressed={on} aria-label={on ? 'Sembunyikan NIK' : 'Tampilkan NIK'} onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {on
          ? <><path d="M3 3l18 18" /><path d="M10.6 10.7a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.2 2.3-2.4 3.5" /><path d="M6.1 6.1C4.2 7.5 2.8 9.3 2 12c1 2.5 5 7 10 7 1.4 0 2.7-.3 3.9-.9" /></>
          : <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
      </svg>
    </button>
  )
}

function PhotoCard({ onPick, onShot, onOpen, fileName, scanning, progress, encrypted }: {
  onPick?: () => void; onShot?: () => void; onOpen?: () => void; fileName?: string
  scanning?: boolean; progress?: number; encrypted?: boolean
}) {
  return (
    <div className="ktp-att">
      <div className="ktp-att-meta">
        <strong>KTP</strong>
        {encrypted && <span className="chip ktp-enc">Terenkripsi</span>}
        {scanning && <span className="muted small" aria-live="polite">{Math.round((progress ?? 0) * 100)}%</span>}
        {fileName && !scanning && <span className="muted small">Foto dipilih</span>}
      </div>
      {onShot && <button type="button" className="btn" onClick={onShot}>Ambil</button>}
      {onPick && <button type="button" className="btn" onClick={onPick}>{fileName ? 'Ganti' : 'Pilih'}</button>}
      {onOpen && <button type="button" className="btn ktp-reveal" onClick={onOpen}>Buka</button>}
    </div>
  )
}

export default function PatientForm({ canKtp = false }: { canKtp?: boolean }) {
  const [f, setF] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Form>>({})
  const [error, setError] = useState<ReactNode>('')
  const [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [scan, setScan] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [ocrFlags, setOcrFlags] = useState<OcrFlag[]>([])
  const [scanned, setScanned] = useState<Set<FormKey>>(new Set())
  const [confirmed, setConfirmed] = useState<Set<FormKey>>(new Set())
  const [nikFocus, setNikFocus] = useState(false)
  const [nikOpen, setNikOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('daftar')
  const [saved, setSaved] = useState<Saved | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const shotRef = useRef<HTMLInputElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const bad = nikMismatches(f.nik, { dob: f.dob, sex: f.sex, province: f.province_code, regency: f.regency_code, district: f.district_code })
  const low = new Set(ocrFlags.filter((x) => x.kind === 'low').map((x) => FLAG_KEY[x.field] ?? x.field))
  const pending = [...scanned].filter((k) => !confirmed.has(k))
  const showNik = nikFocus || nikOpen || !f.nik ? f.nik : maskNik(f.nik)

  useEffect(() => {
    const dock = dockRef.current, form = formRef.current
    if (!dock || !form) return
    const apply = () => form.style.setProperty('--patient-dock-h', `${Math.ceil(dock.getBoundingClientRect().height)}px`)
    apply()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(apply)
    ro.observe(dock)
    return () => ro.disconnect()
  }, [tab, pending.length])

  const confirm = (k: FormKey) => setConfirmed((s) => new Set(s).add(k))
  const confirmAll = () => setConfirmed(new Set(scanned))
  const onFieldFocus = (k: FormKey) => (e: { currentTarget: HTMLElement }) => {
    e.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    if (scanned.has(k)) confirm(k)
  }
  const set = (k: FormKey) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    if (scanned.has(k)) confirm(k)
  }

  async function applyPhoto(file: File | null) {
    setPhoto(file)
    setOcrFlags([])
    setScanned(new Set())
    setConfirmed(new Set())
    if (!file) return
    setScanning(true)
    setScan(0)
    try {
      const { runKtpOcr } = await import('./ocr/runOcr')
      const { draft, flags } = await runKtpOcr(file, setScan)
      const next: Partial<Form> = {
        ...(draft.name ? { name: draft.name } : {}),
        ...(draft.nik ? { nik: draft.nik } : {}),
        ...(draft.dob ? { dob: draft.dob } : {}),
        ...(draft.sex ? { sex: draft.sex } : {}),
        ...(draft.address ? { address: draft.address } : {}),
        ...(draft.province ? { province_code: draft.province } : {}),
        ...(draft.regency ? { regency_code: draft.regency } : {}),
        ...(draft.district ? { district_code: draft.district } : {}),
      }
      setF((prev) => ({ ...prev, ...next }))
      setScanned(new Set(Object.keys(next) as FormKey[]))
      setConfirmed(new Set())
      setOcrFlags(flags)
      setNikOpen(false)
      setNikFocus(false)
    } catch {
      setOcrFlags([])
    } finally {
      setScanning(false)
    }
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (pending.length) return
    const errs = validate(f)
    setErrors(errs)
    setError('')
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const filled = Object.entries(f).filter(([, v]) => v.trim() !== '')
      const res = await createPatient(Object.fromEntries(filled.filter(([k]) => !k.endsWith('_code'))))
      const codes = Object.fromEntries(filled.filter(([k]) => k.endsWith('_code')))
      let photoId: string | undefined
      // KTP extras are a follow-up save; the patient already exists, so a failure here does not block the profil tab.
      if (photo || Object.keys(codes).length) {
        photoId = photo ? (await uploadKtpPhoto(photo)).id : undefined
        await saveKtp(res.id, { ...codes, ...(photoId ? { photo_id: photoId } : {}) }).catch(() => undefined)
      }
      const nikMasked = maskNik(f.nik)
      setSaved({ id: res.id, name: f.name, nikMasked, photoId })
      setF(EMPTY)
      setPhoto(null)
      setOcrFlags([])
      setScanned(new Set())
      setConfirmed(new Set())
      setNikOpen(false)
      setTab('profil')
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.data?.errors)
        setErrors(Object.fromEntries(Object.entries(e.data.errors as Record<string, string[]>).map(([k, v]) => [k, v[0]])))
      else if (e instanceof ApiError && e.status === 409)
        setError(<>Pasien dengan {e.data?.field === 'nik' ? 'NIK' : 'no. HP'} ini sudah terdaftar. <a href={'#/pasien/' + e.data?.id}>Buka data pasien</a></>)
      else setError(e instanceof ApiError && e.status === 422 ? e.data?.message : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const chip = (k: FormKey | 'nik', check?: KtpField) => (
    <>
      {check && bad.includes(check) && <span className="chip ktp-bad" data-field={check}>Tidak cocok</span>}
      {low.has(k) && <span className="chip ktp-warn" data-field={k}>Periksa</span>}
      {scanned.has(k as FormKey) && !confirmed.has(k as FormKey) && (
        <button type="button" className="chip ktp-draft" data-field={k} onClick={() => confirm(k as FormKey)}>Dari pindai</button>
      )}
    </>
  )
  const field = (k: FormKey, label: string, input: ReactElement, check?: KtpField) => (
    <div className={errors[k] ? 'has-error' : ''}>
      <div className="ktp-label">
        <label htmlFor={`f-${k}`}>{label}</label>
        {chip(k, check)}
      </div>
      {cloneElement(input as ReactElement<{ id?: string }>, { id: `f-${k}` })}
      {errors[k] && <span className="field-error" role="alert">{errors[k]}</span>}
    </div>
  )
  const code = (k: (typeof KTP_CODES)[number], label: string, check: KtpField) =>
    field(k, label, <input inputMode="numeric" maxLength={2} value={f[k]} onChange={set(k)} onFocus={onFieldFocus(k)} placeholder="00" />, check)

  const hasil = (
    <aside className="ktp-hasil" aria-label="Hasil">
      <div className="ktp-hasil-card">
        <div className="muted small">KTP</div>
        <strong>{(saved && tab === 'profil' ? saved.name : f.name) || '—'}</strong>
        <div className="mono small">{saved && tab === 'profil' ? saved.nikMasked : (f.nik ? maskNik(f.nik) : '')}</div>
      </div>
      {tab === 'daftar' && (
        <>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Foto KTP"
            onChange={(e) => { void applyPhoto(e.target.files?.[0] ?? null); e.target.value = '' }} />
          <input ref={shotRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden aria-label="Ambil foto KTP"
            onChange={(e) => { void applyPhoto(e.target.files?.[0] ?? null); e.target.value = '' }} />
          <PhotoCard fileName={photo?.name} scanning={scanning} progress={scan}
            onPick={() => fileRef.current?.click()} onShot={() => shotRef.current?.click()} />
        </>
      )}
    </aside>
  )

  return (
    <>
      <div className="page-head"><div><a href="#/pasien" className="muted small">← Daftar pasien</a><h1>Pasien baru</h1></div></div>
      <div className="patient-form-tabs" role="tablist" aria-label="Pindai KTP">
        <button type="button" role="tab" aria-selected={tab === 'daftar'} className={tab === 'daftar' ? 'is-on' : ''} onClick={() => setTab('daftar')}>Daftar</button>
        <button type="button" role="tab" aria-selected={tab === 'profil'} className={tab === 'profil' ? 'is-on' : ''} disabled={!saved} onClick={() => saved && setTab('profil')}>Profil</button>
      </div>

      {tab === 'profil' && saved && (
        <div className="ktp-daftar">
          {hasil}
          <div className="card">
            <dl className="details">
              <div><dt>Nama</dt><dd>{saved.name}</dd></div>
              <div><dt>NIK</dt><dd className="mono">{saved.nikMasked}</dd></div>
            </dl>
            {canKtp && saved.photoId && (
              <PhotoCard encrypted onOpen={() => getKtpPhoto(saved.id).then(openBlob, (e) => setError(errorText(e)))} />
            )}
            <p className="muted small"><a href={'#/pasien/' + saved.id}>Buka profil</a></p>
          </div>
        </div>
      )}

      {tab === 'daftar' && (
        <form ref={formRef} className="card form patient-form" onSubmit={submit} noValidate>
          <div className="ktp-daftar">
            {hasil}
            <div>
              <h2>Identitas</h2>
              <div className="grid-2">
                {field('name', 'Nama lengkap *', <input value={f.name} onChange={set('name')} onFocus={onFieldFocus('name')} maxLength={200} />)}
                {field('phone', 'No. HP', <input inputMode="tel" value={f.phone} onChange={set('phone')} onFocus={onFieldFocus('phone')} placeholder="08xx…" />)}
                {field('address', 'Alamat', <input value={f.address} onChange={set('address')} onFocus={onFieldFocus('address')} maxLength={500} />)}
              </div>
              <div className="ktp-head"><h2>KTP</h2></div>
              <div className="ktp">
                <div className={errors.nik ? 'has-error' : ''}>
                  <span className="ktp-label">NIK{chip('nik')}{errors.nik && <span className="field-error" role="alert">{errors.nik}</span>}</span>
                  <div className="ktp-nik-row">
                    <input aria-label="NIK" inputMode="numeric" value={showNik} autoComplete="off"
                      onFocus={(e) => { setNikFocus(true); onFieldFocus('nik')(e) }}
                      onBlur={() => setNikFocus(false)}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v.includes('*') && !nikFocus) return
                        setF((prev) => ({ ...prev, nik: v }))
                        if (scanned.has('nik')) confirm('nik')
                      }}
                      placeholder="16 angka" />
                    <Eye on={nikOpen} onClick={() => setNikOpen(!nikOpen)} />
                  </div>
                </div>
                {field('dob', 'Tanggal lahir', <input type="date" value={f.dob} onChange={set('dob')} onFocus={onFieldFocus('dob')} />, 'dob')}
                {field('sex', 'Jenis kelamin', (
                  <select value={f.sex} onChange={set('sex')} onFocus={onFieldFocus('sex')}><option value="">— Pilih —</option><option value="laki_laki">Laki-laki</option><option value="perempuan">Perempuan</option></select>
                ), 'sex')}
                <div className="ktp-codes">
                  {code('province_code', 'Prov', 'province')}
                  {code('regency_code', 'Kab/Kota', 'regency')}
                  {code('district_code', 'Kec', 'district')}
                </div>
              </div>
              <h2>Penjamin</h2>
              <div className="grid-2">
                {field('payer_type', 'Jenis penjamin', (
                  <select value={f.payer_type} onChange={set('payer_type')} onFocus={onFieldFocus('payer_type')}><option value="umum">Umum (bayar sendiri)</option><option value="asuransi">Asuransi swasta</option></select>
                ))}
                {f.payer_type === 'asuransi' && field('payer_name', 'Nama asuransi *', <input value={f.payer_name} onChange={set('payer_name')} onFocus={onFieldFocus('payer_name')} />)}
                {f.payer_type === 'asuransi' && field('payer_member_no', 'No. peserta', <input value={f.payer_member_no} onChange={set('payer_member_no')} onFocus={onFieldFocus('payer_member_no')} />)}
              </div>
            </div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div ref={dockRef} className="patient-form-dock">
            <a className="btn" href="#/pasien">Batal</a>
            {pending.length > 0 && <button type="button" className="btn" onClick={confirmAll}>Konfirmasi semua</button>}
            <button className="btn btn-primary" disabled={busy || pending.length > 0}>{busy ? 'Menyimpan…' : 'Verifikasi dan daftar'}</button>
          </div>
        </form>
      )}
    </>
  )
}
