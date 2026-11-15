import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { createPatient, saveKtp, uploadKtpPhoto } from './api'
import { nikMismatches, type KtpField } from './nik'
import './ktp.css'

type Form = Record<'name' | 'dob' | 'sex' | 'nik' | 'phone' | 'address' | 'payer_type' | 'payer_name' | 'payer_member_no'
  | 'province_code' | 'regency_code' | 'district_code', string>
const EMPTY: Form = { name: '', dob: '', sex: '', nik: '', phone: '', address: '', payer_type: 'umum', payer_name: '', payer_member_no: '',
  province_code: '', regency_code: '', district_code: '' }
const KTP_CODES = ['province_code', 'regency_code', 'district_code'] as const

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

export default function PatientForm() {
  const [f, setF] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Form>>({})
  const [error, setError] = useState<ReactNode>('')
  const [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const bad = nikMismatches(f.nik, { dob: f.dob, sex: f.sex, province: f.province_code, regency: f.regency_code, district: f.district_code })
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const errs = validate(f)
    setErrors(errs)
    setError('')
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const filled = Object.entries(f).filter(([, v]) => v.trim() !== '')
      const res = await createPatient(Object.fromEntries(filled.filter(([k]) => !k.endsWith('_code'))))
      const codes = Object.fromEntries(filled.filter(([k]) => k.endsWith('_code')))
      // KTP extras are a follow-up save; the patient already exists, so a failure here does not block the redirect.
      if (photo || Object.keys(codes).length)
        await saveKtp(res.id, { ...codes, ...(photo ? { photo_id: (await uploadKtpPhoto(photo)).id } : {}) }).catch(() => undefined)
      location.hash = '/pasien/' + res.id
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

  const field = (k: keyof Form, label: string, input: ReactElement, check?: KtpField) => (
    <label className={errors[k] ? 'has-error' : ''}>
      <span className="ktp-label">{label}{check && bad.includes(check) && <span className="chip ktp-bad" data-field={check}>Tidak cocok</span>}</span>
      {input}
      {errors[k] && <span className="field-error" role="alert">{errors[k]}</span>}
    </label>
  )
  const code = (k: (typeof KTP_CODES)[number], label: string, check: KtpField) =>
    field(k, label, <input inputMode="numeric" maxLength={2} value={f[k]} onChange={set(k)} placeholder="00" />, check)

  return (
    <>
      <div className="page-head"><div><a href="#/pasien" className="muted small">← Daftar pasien</a><h1>Pasien Baru</h1></div></div>
      <form className="card form patient-form" onSubmit={submit} noValidate>
        <h2>Identitas</h2>
        <div className="grid-2">
          {field('name', 'Nama lengkap *', <input value={f.name} onChange={set('name')} maxLength={200} />)}
          {field('phone', 'No. HP', <input inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="08xx…" />)}
          {field('address', 'Alamat', <input value={f.address} onChange={set('address')} maxLength={500} />)}
        </div>
        <h2>KTP</h2>
        <div className="ktp">
          {field('nik', 'NIK', <input inputMode="numeric" value={f.nik} onChange={set('nik')} placeholder="16 angka" />)}
          {field('dob', 'Tanggal lahir', <input type="date" value={f.dob} onChange={set('dob')} />, 'dob')}
          {field('sex', 'Jenis kelamin', (
            <select value={f.sex} onChange={set('sex')}><option value="">— Pilih —</option><option value="laki_laki">Laki-laki</option><option value="perempuan">Perempuan</option></select>
          ), 'sex')}
          <div className="ktp-codes">
            {code('province_code', 'Prov', 'province')}
            {code('regency_code', 'Kab/Kota', 'regency')}
            {code('district_code', 'Kec', 'district')}
          </div>
          <label className="ktp-photo">
            <span className="ktp-label">Foto KTP</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <h2>Penjamin</h2>
        <div className="grid-2">
          {field('payer_type', 'Jenis penjamin', (
            <select value={f.payer_type} onChange={set('payer_type')}><option value="umum">Umum (bayar sendiri)</option><option value="asuransi">Asuransi swasta</option></select>
          ))}
          {f.payer_type === 'asuransi' && field('payer_name', 'Nama asuransi *', <input value={f.payer_name} onChange={set('payer_name')} />)}
          {f.payer_type === 'asuransi' && field('payer_member_no', 'No. peserta', <input value={f.payer_member_no} onChange={set('payer_member_no')} />)}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <a className="btn" href="#/pasien">Batal</a>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pasien'}</button>
        </div>
      </form>
    </>
  )
}
