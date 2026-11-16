import { cloneElement, useState, type FormEvent, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { Select } from '../../shared/ui/Select'
import { Button, buttonVariants, Card } from '@heroui/react'
import { DateField } from '../../shared/ui/DateField'
import { ApiError, errorText } from '../../shared/api/http'
import { createPatient } from './api'
import { Note } from '../../shared/ui/Note'

type Form = Record<'name' | 'dob' | 'sex' | 'nik' | 'phone' | 'address' | 'payer_type' | 'payer_name' | 'payer_member_no', string>
const EMPTY: Form = { name: '', dob: '', sex: '', nik: '', phone: '', address: '', payer_type: 'umum', payer_name: '', payer_member_no: '' }

// Mirrors StorePatientRequest; the server stays the source of truth.
export function validate(f: Form): Partial<Form> {
  const e: Partial<Form> = {}
  if (!f.name.trim()) e.name = 'Nama lengkap wajib diisi.'
  else if (!/\p{L}/u.test(f.name)) e.name = 'Nama harus mengandung huruf.'
  if (f.dob && f.dob > new Date().toISOString().slice(0, 10)) e.dob = 'Tanggal lahir tidak boleh di masa depan.'
  if (f.nik && !/^\d{16}$/.test(f.nik.replace(/[\s.-]/g, ''))) e.nik = 'NIK harus 16 angka.'
  if (f.phone && !/^\+?[0-9][0-9 -]{7,18}$/.test(f.phone)) e.phone = 'Nomor HP tidak valid.'
  if (f.payer_type === 'asuransi' && !f.payer_name.trim()) e.payer_name = 'Nama asuransi wajib diisi.'
  return e
}

export default function PatientForm() {
  const [f, setF] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Partial<Form>>({})
  const [error, setError] = useState<ReactNode>('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const errs = validate(f)
    setErrors(errs)
    setError('')
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== ''))
      const res = await createPatient(body)
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

  // Audit P3-1: name = the visible label only (the error would otherwise join it); the error is the description.
  const field = (k: keyof Form, label: string, input: ReactElement<InputHTMLAttributes<HTMLElement>>) => (
    <label className={errors[k] ? 'has-error' : ''}>
      <span id={`pf-${k}`}>{label}</span>
      {cloneElement(input, { 'aria-labelledby': `pf-${k}`, 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `pf-${k}-error` : undefined })}
      {errors[k] && <span id={`pf-${k}-error`} className="pt-error" role="alert">{errors[k]}</span>}
    </label>
  )

  return (
    <>
      <div className="page-head"><div><a href="#/pasien" className="muted small">← Daftar pasien</a><h1 className="shell-dup-title">Pasien Baru</h1></div></div>
      <Card className="pt-card"><form className="form" onSubmit={submit} noValidate>
        <h2>Identitas</h2>
        <div className="grid-2">
          {field('name', 'Nama lengkap *', <input value={f.name} onChange={set('name')} maxLength={200} />)}
          {field('dob', 'Tanggal lahir', <DateField value={f.dob} onChange={set('dob')} />)}
          {field('sex', 'Jenis kelamin', (
            <Select value={f.sex} onChange={set('sex')}><option value="">— Pilih —</option><option value="laki_laki">Laki-laki</option><option value="perempuan">Perempuan</option></Select>
          ))}
          {field('nik', 'NIK', <input inputMode="numeric" value={f.nik} onChange={set('nik')} placeholder="16 angka" />)}
          {field('phone', 'No. HP', <input inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="08xx…" />)}
          {field('address', 'Alamat', <input value={f.address} onChange={set('address')} maxLength={500} />)}
        </div>
        <h2>Penjamin</h2>
        <div className="grid-2">
          {field('payer_type', 'Jenis penjamin', (
            <Select value={f.payer_type} onChange={set('payer_type')}><option value="umum">Umum (bayar sendiri)</option><option value="asuransi">Asuransi swasta</option></Select>
          ))}
          {f.payer_type === 'asuransi' && field('payer_name', 'Nama asuransi *', <input value={f.payer_name} onChange={set('payer_name')} />)}
          {f.payer_type === 'asuransi' && field('payer_member_no', 'No. peserta', <input value={f.payer_member_no} onChange={set('payer_member_no')} />)}
        </div>
        {error && <Note status="danger" role="alert">{error}</Note>}
        <div className="dialog-actions">
          <a className={buttonVariants({ variant: 'secondary' }) + ' pt-btn'} href="#/pasien">Batal</a>
          <Button type="submit" className="pt-btn" isDisabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pasien'}</Button>
        </div>
      </form></Card>
    </>
  )
}
