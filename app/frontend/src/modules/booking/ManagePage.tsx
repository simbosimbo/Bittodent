import { useEffect, useState } from 'react'
import { ApiError } from '../../shared/api/http'
import { cancelBooking, getBooking, rescheduleBooking, type Manage, type Slot } from './api'
import { apiMessage, longDate, Page, SlotPicker, StatusChip, Summary, timeRange } from './parts'

export default function ManagePage({ slug, token }: { slug: string; token: string }) {
  const [data, setData] = useState<Manage | null>(null)
  const [gone, setGone] = useState('')
  const [mode, setMode] = useState<'view' | 'cancel' | 'move'>('view')
  const [slot, setSlot] = useState<Slot | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getBooking(slug, token).then(setData, (e) => setGone(
      e instanceof ApiError && e.status === 410 ? 'Tautan sudah kedaluwarsa.' : e instanceof ApiError && e.status === 404 ? 'Tautan tidak berlaku.' : apiMessage(e)))
  }, [slug, token])

  if (gone) return <Page clinic="Bittodent"><div className="bk-card bk-state" role="alert"><h1>{gone}</h1><a className="bk-btn bk-btn-primary" href={`#/book/${slug}`}>Buat booking baru</a></div></Page>
  if (!data) return <Page clinic="Bittodent"><p className="bk-muted">Memuat…</p></Page>

  async function run(fn: () => Promise<Manage>, done: string) {
    setBusy(true)
    setError('')
    try {
      setData(await fn())
      setMode('view')
      setSlot(null)
      setNotice(done)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page clinic={data.clinic.name} aside={
      <Summary title="Janji temu" rows={[
        ['Kode', <span className="bk-mono">{data.code}</span>],
        ['Status', <StatusChip status={data.status} />],
        ['Dokter', data.dentist?.name],
        ['Layanan', data.service?.name],
        ['Tanggal', longDate(data.starts_at)],
        ['Jam', timeRange(data.starts_at, data.ends_at)],
        ['Cabang', data.branch.name],
      ]} />
    }>
      <div className="bk-head"><h1>Kelola booking</h1></div>
      <div aria-live="polite">
        {error && <p className="bk-error" role="alert">{error}</p>}
        {notice && <p className="bk-notice">{notice}</p>}
      </div>
      {!data.can_change ? <div className="bk-card"><p className="bk-muted">Booking ini tidak bisa diubah.</p></div>
        : mode === 'cancel' ? (
          <div className="bk-card">
            <h2 className="bk-card-title">Batalkan booking ini?</h2>
            <div className="bk-row">
              <button type="button" className="bk-btn bk-btn-danger" disabled={busy} onClick={() => run(() => cancelBooking(slug, token), 'Booking dibatalkan.')}>Ya, batalkan</button>
              <button type="button" className="bk-btn" onClick={() => setMode('view')}>Tidak</button>
            </div>
          </div>
        ) : mode === 'move' && data.dentist && data.service ? (
          <div className="bk-card">
            <h2 className="bk-card-title">Jadwal baru</h2>
            <SlotPicker slug={slug} dentistId={data.dentist.id} serviceId={data.service.id} value={slot} onChange={setSlot} near={data.starts_at} />
            <div className="bk-row">
              <button type="button" className="bk-btn bk-btn-primary" disabled={!slot || busy}
                onClick={() => run(() => rescheduleBooking(slug, token, slot!.starts_at), 'Jadwal diubah. Menunggu konfirmasi klinik.')}>Simpan jadwal</button>
              <button type="button" className="bk-btn" onClick={() => setMode('view')}>Batal</button>
            </div>
          </div>
        ) : (
          <div className="bk-row">
            <button type="button" className="bk-btn" onClick={() => { setNotice(''); setMode('move') }}>Jadwal ulang</button>
            <button type="button" className="bk-btn bk-btn-danger" onClick={() => { setNotice(''); setMode('cancel') }}>Batalkan</button>
          </div>
        )}
    </Page>
  )
}
