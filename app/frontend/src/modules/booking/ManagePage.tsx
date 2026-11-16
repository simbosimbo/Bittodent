import { useEffect, useState } from 'react'
import { Button, buttonVariants, Card } from '@heroui/react'
import { ApiError } from '../../shared/api/http'
import { cancelBooking, getBooking, rescheduleBooking, type Manage, type Slot } from './api'
import { Note } from '../../shared/ui/Note'
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

  if (gone) return <Page clinic="Bittodent"><Card className="bk-card bk-state" role="alert"><h1>{gone}</h1><a className={buttonVariants({ variant: 'primary' })} href={`#/book/${slug}`}>Buat booking baru</a></Card></Page>
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
        {error && <Note status="danger" role="alert">{error}</Note>}
        {notice && <Note status="success" role="status">{notice}</Note>}
      </div>
      {!data.can_change ? <Card className="bk-card"><p className="bk-muted">Booking ini tidak bisa diubah.</p></Card>
        : mode === 'cancel' ? (
          <Card className="bk-card">
            <h2 className="bk-card-title">Batalkan booking ini?</h2>
            <div className="bk-row">
              <Button variant="danger" isDisabled={busy} onPress={() => run(() => cancelBooking(slug, token), 'Booking dibatalkan.')}>Ya, batalkan</Button>
              <Button variant="secondary" onPress={() => setMode('view')}>Tidak</Button>
            </div>
          </Card>
        ) : mode === 'move' && data.dentist && data.service ? (
          <Card className="bk-card">
            <h2 className="bk-card-title">Jadwal baru</h2>
            <SlotPicker slug={slug} dentistId={data.dentist.id} serviceId={data.service.id} value={slot} onChange={setSlot} near={data.starts_at} />
            <div className="bk-row">
              <Button variant="primary" isDisabled={!slot || busy}
                onPress={() => run(() => rescheduleBooking(slug, token, slot!.starts_at), 'Jadwal diubah. Menunggu konfirmasi klinik.')}>Simpan jadwal</Button>
              <Button variant="secondary" onPress={() => setMode('view')}>Batal</Button>
            </div>
          </Card>
        ) : (
          <div className="bk-row">
            <Button variant="secondary" onPress={() => { setNotice(''); setMode('move') }}>Jadwal ulang</Button>
            <Button variant="danger-soft" onPress={() => { setNotice(''); setMode('cancel') }}>Batalkan</Button>
          </div>
        )}
    </Page>
  )
}
