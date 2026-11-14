import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../shared/api/http'
import { getInfo, resendOtp, startBooking, verifyOtp, type Booked, type Challenge, type Info, type Slot } from './api'
import { apiMessage, longDate, Page, SlotPicker, StatusChip, Summary, timeRange } from './parts'

type Step = 'dokter' | 'layanan' | 'jadwal' | 'data' | 'otp' | 'selesai'
const STEPS: Step[] = ['dokter', 'layanan', 'jadwal', 'data', 'otp']
const TITLE: Record<Step, string> = { dokter: 'Pilih dokter', layanan: 'Pilih layanan', jadwal: 'Pilih jadwal', data: 'Data diri', otp: 'Kode verifikasi', selesai: 'Booking terkirim' }

export default function BookingPage({ slug }: { slug: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState<Step>('dokter')
  const [dentistId, setDentistId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [slot, setSlot] = useState<Slot | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', complaint: '' })
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(0)
  const [result, setResult] = useState<Booked | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => { getInfo(slug).then(setInfo, (e) => setLoadError(e instanceof ApiError && e.status === 404 ? 'Klinik tidak ditemukan.' : apiMessage(e))) }, [slug])
  useEffect(() => { heading.current?.focus() }, [step])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  if (loadError) return <Page clinic="Bittodent"><div className="bk-card" role="alert">{loadError}</div></Page>
  if (!info) return <Page clinic="Bittodent"><p className="bk-muted">Memuat…</p></Page>
  if (!info.clinic.online_booking_enabled)
    return <Page clinic={info.clinic.name}><div className="bk-card bk-state"><h1>Booking online belum dibuka</h1><p className="bk-muted">Hubungi klinik.</p></div></Page>

  const dentist = info.dentists.find((d) => d.id === dentistId)
  const service = info.services.find((s) => s.id === serviceId)
  const branch = info.branches.find((b) => b.id === slot?.branch_id)
  const go = (s: Step) => { setError(''); setStep(s) }
  const index = STEPS.indexOf(step)

  async function sendCode(ev: FormEvent) {
    ev.preventDefault()
    if (form.name.trim().length < 2) return setError('Isi nama.')
    if (form.phone.replace(/\D/g, '').length < 9) return setError('Isi nomor WhatsApp.')
    setBusy(true)
    setError('')
    try {
      const c = await startBooking(slug, { dentist_id: dentistId, service_id: serviceId, starts_at: slot!.starts_at, ...form })
      setChallenge(c)
      setWait(c.resend_in)
      setCode('')
      go('otp')
    } catch (e) {
      if (e instanceof ApiError && e.data?.error === 'slot_taken') { setSlot(null); setStep('jadwal') }
      setError(e instanceof ApiError && e.status === 422 ? (Object.values(e.data?.errors ?? {}).flat()[0] as string) ?? 'Data tidak valid.' : apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function verify(ev: FormEvent) {
    ev.preventDefault()
    if (!/^\d{6}$/.test(code)) return setError('Masukkan 6 angka.')
    setBusy(true)
    setError('')
    try {
      setResult(await verifyOtp(slug, challenge!.challenge_id, code))
      go('selesai')
    } catch (e) {
      if (e instanceof ApiError && e.data?.error === 'slot_taken') { setSlot(null); setStep('jadwal') }
      setError(e instanceof ApiError && e.data?.error === 'otp_wrong' ? `Kode salah. Sisa ${e.data.attempts_left} kali.` : apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError('')
    try {
      const r = await resendOtp(slug, challenge!.challenge_id)
      setWait(r.resend_in)
    } catch (e) {
      if (e instanceof ApiError && e.data?.retry_in) setWait(e.data.retry_in)
      setError(apiMessage(e))
    }
  }

  const summary = (
    <Summary rows={[
      ['Dokter', dentist?.name],
      ['Layanan', service && `${service.name} · ${service.duration_minutes} mnt`],
      ['Tanggal', slot && longDate(slot.starts_at)],
      ['Jam', slot && timeRange(slot.starts_at, slot.ends_at)],
      ['Cabang', branch?.name],
    ]} />
  )

  if (step === 'selesai' && result)
    return (
      <Page clinic={info.clinic.name} aside={summary}>
        <div className="bk-card bk-done">
          <h1 ref={heading} tabIndex={-1}>{TITLE.selesai}</h1>
          <StatusChip status={result.status} />
          <p className="bk-label">Kode booking</p>
          <p className="bk-code">{result.code}</p>
          <a className="bk-btn bk-btn-primary bk-btn-block" href={`#/book/${slug}/manage/${result.manage_token}`}>Kelola</a>
        </div>
      </Page>
    )

  return (
    <Page clinic={info.clinic.name} aside={step !== 'dokter' && summary}>
      <div className="bk-head">
        {index > 0 && step !== 'otp' && <button type="button" className="bk-btn bk-btn-ghost" onClick={() => go(STEPS[index - 1])}>‹ Kembali</button>}
        <p className="bk-step">Langkah {index + 1} dari {STEPS.length}</p>
        <h1 ref={heading} tabIndex={-1}>{TITLE[step]}</h1>
      </div>
      <div aria-live="assertive">{error && <p className="bk-error" role="alert">{error}</p>}</div>

      {step === 'dokter' && (
        <div className="bk-list">
          {info.dentists.length === 0 && <p className="bk-muted">Belum ada dokter.</p>}
          {info.dentists.map((d) => (
            <button key={d.id} type="button" className="bk-option" aria-pressed={d.id === dentistId} onClick={() => { setDentistId(d.id); setSlot(null); go('layanan') }}>
              <span className="bk-avatar" aria-hidden="true">{d.name.replace(/^drg\.\s*/, '').slice(0, 1)}</span>{d.name}
            </button>
          ))}
        </div>
      )}

      {step === 'layanan' && (
        <div className="bk-list">
          {info.services.map((s) => (
            <button key={s.id} type="button" className="bk-option" aria-pressed={s.id === serviceId} onClick={() => { setServiceId(s.id); setSlot(null); go('jadwal') }}>
              <span className="grow">{s.name}</span><small>{s.duration_minutes} mnt</small>
            </button>
          ))}
        </div>
      )}

      {step === 'jadwal' && (
        <div className="bk-card">
          <SlotPicker slug={slug} dentistId={dentistId} serviceId={serviceId} value={slot} onChange={setSlot} />
          <button type="button" className="bk-btn bk-btn-primary bk-btn-block" disabled={!slot} onClick={() => go('data')}>Lanjut</button>
        </div>
      )}

      {step === 'data' && (
        <form className="bk-card" onSubmit={sendCode} noValidate>
          <label className="bk-field">Nama lengkap<input autoComplete="name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="bk-field">Nomor WhatsApp<input type="tel" inputMode="tel" autoComplete="tel" required placeholder="08xx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="bk-field">Keluhan (opsional)<textarea rows={3} maxLength={200} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} /></label>
          <button className="bk-btn bk-btn-primary bk-btn-block" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim kode'}</button>
        </form>
      )}

      {step === 'otp' && challenge && (
        <form className="bk-card" onSubmit={verify} noValidate>
          <p className="bk-muted">Dikirim ke WhatsApp {challenge.phone_masked}</p>
          <label className="bk-field">Kode 6 angka
            <input className="bk-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </label>
          <button className="bk-btn bk-btn-primary bk-btn-block" disabled={busy}>{busy ? 'Memeriksa…' : 'Verifikasi'}</button>
          <div className="bk-row">
            <button type="button" className="bk-btn bk-btn-ghost" disabled={wait > 0} onClick={resend}>{wait > 0 ? `Kirim ulang (${wait})` : 'Kirim ulang'}</button>
            <button type="button" className="bk-btn bk-btn-ghost" onClick={() => go('data')}>Ganti nomor</button>
          </div>
        </form>
      )}
    </Page>
  )
}
