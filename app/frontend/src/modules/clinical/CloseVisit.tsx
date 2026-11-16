import { useState } from 'react'
import { Button, buttonVariants, Card } from '@heroui/react'
import { ApiError, errorText } from '../../shared/api/http'
import { cancelAttendance, closeVisit } from './api'
import { Note } from '../../shared/ui/Note'

// Unit 4: close the active visit. Completed work needs an invoice line (server says invoice_required). Only when attendance was
// cancelled (appointment batal/tidak datang, or walk-in "Batalkan kehadiran") may it close without one, with a reason.
// #55: unsigned clinical work closes only through the DPJP's Selesai, so "Tutup kunjungan" is hidden then (server: 409 use_selesai).
export function CloseVisit({ visit, needsSelesai = false, canBilling, onDone }: {
  visit: { id: string; appointment_id: string | null; attendance_cancelled_at?: string | null }; needsSelesai?: boolean; canBilling: boolean; onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<unknown>) {
    setError('')
    setBusy(true)
    try {
      await fn()
      onDone()
    } catch (e) {
      setError(e instanceof ApiError && [409, 422].includes(e.status) ? e.data?.message ?? 'Tidak bisa diproses.' : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const walkIn = visit.appointment_id === null
  return (
    <Card>
      <div className="card-head"><h2>Tutup kunjungan</h2>{canBilling && <a className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`#/tagihan/${visit.id}`}>Lihat tagihan</a>}</div>
      <label>Alasan (wajib bila kehadiran dibatalkan)
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error} />
      </label>
      {needsSelesai && <p className="muted small">Catatan/tindakan belum Selesai: dokter penanggung jawab menekan Selesai (menutup kunjungan sekaligus).</p>}
      {error && <Note status="danger" role="alert">{error}</Note>}
      <div className="flex flex-wrap items-center gap-2">
        {walkIn && !visit.attendance_cancelled_at && (
          <Button variant="outline" isDisabled={busy} onPress={() => reason.trim().length < 10 ? setError('Isi alasan minimal 10 huruf.') : run(() => cancelAttendance(visit.id, reason.trim()))}>
            Batalkan kehadiran
          </Button>
        )}
        {!needsSelesai && <Button isDisabled={busy} onPress={() => run(() => closeVisit(visit.id, reason.trim()))}>Tutup kunjungan</Button>}
      </div>
    </Card>
  )
}
