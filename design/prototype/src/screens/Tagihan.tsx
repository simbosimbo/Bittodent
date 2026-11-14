import { useState } from 'react'
import { BRANCHES, TODAY } from '../data/mock'
import type { PayMethod } from '../data/types'
import { dateLabel, maskPhone, nowLabel, rupiah } from '../lib/format'
import { ledgerTotals, useActive, useStore } from '../state/store'
import { Ledger } from '../components/Ledger'
import { NoPatient } from '../components/Chrome'
import { Badge, Button, Card, ClaimPendingBadge, Field, Input, Modal, QrisBadge, Seg } from '../components/ui'

const METHODS: { v: PayMethod; label: string }[] = [{ v: 'tunai', label: 'Tunai' }, { v: 'transfer', label: 'Transfer' }, { v: 'kartu', label: 'Kartu debit/kredit' }, { v: 'qris', label: 'QRIS' }]

export function Tagihan() {
  const { s, a } = useStore()
  const p = useActive()
  const [scope, setScope] = useState<'pasien' | 'keluarga'>('pasien')
  const [method, setMethod] = useState<PayMethod>('tunai')
  const [amt, setAmt] = useState<string>('')
  const [receipt, setReceipt] = useState(false)
  const [wa, setWa] = useState(false)
  if (!p) return <div className="screen"><h2>Tagihan</h2><NoPatient module="Tagihan" /></div>
  const fam = s.patients.filter((x) => x.familyId === p.familyId)
  const rows = s.ledger.filter((r) => scope === 'pasien' ? r.patientId === p.id : fam.some((f) => f.id === r.patientId))
  const own = s.ledger.filter((r) => r.patientId === p.id)
  const t = ledgerTotals(rows)
  const ownT = ledgerTotals(own)
  const claimedScope = new Set(rows.flatMap((r) => r.procIds ?? []))
  const claimedOwn = new Set(own.flatMap((r) => r.procIds ?? []))
  const estCover = (list: typeof rows, claimed: Set<string>) => list.filter((r) => r.kind === 'tindakan' && r.procId && !claimed.has(r.procId)).reduce((sum, r) => {
    const who = s.patients.find((x) => x.id === r.patientId)
    return sum + (who?.insurance ? Math.round(r.amount * who.insurance.coverPct / 100) : 0)
  }, 0)
  const unclaimedOwn = own.filter((r) => r.kind === 'tindakan' && r.procId && !claimedOwn.has(r.procId))
  const estInsurer = estCover(rows, claimedScope)
  const ownEstInsurer = estCover(own, claimedOwn)
  const ledgerDue = t.patientDue
  const estPatientDue = Math.max(0, ledgerDue - estInsurer)
  const payDue = Math.max(0, ownT.patientDue - ownEstInsurer)
  const value = amt === '' ? payDue : Number(amt.replace(/\D/g, ''))
  const effMethod = s.offline ? 'tunai' : method
  const todayRows = own.filter((r) => r.date === TODAY)
  return (
    <div className="screen">
      <div className="screen-head">
        <div><h2>Tagihan (Akun)</h2><p className="muted">Buku besar berjalan: tindakan, pembayaran, klaim asuransi. Tanpa diagnosis.</p></div>
        <Seg label="Cakupan buku besar" value={scope} onChange={setScope} options={[{ v: 'pasien', label: 'Pasien ini' }, { v: 'keluarga', label: `Seluruh keluarga (${fam.length})` }]} />
      </div>
      <div className="stats">
        <div className="stat"><small>Total tagihan</small><strong>{rupiah(t.charges)}</strong></div>
        <div className="stat"><small>Sudah dibayar</small><strong>{rupiah(t.paid)}</strong></div>
        <div className="stat"><small>Sudah ditanggung asuransi</small><strong>{rupiah(t.claimPaid)}</strong></div>
        {t.claimPending > 0 && <div className="stat"><small>Klaim menunggu</small><strong>{rupiah(t.claimPending)}</strong><ClaimPendingBadge /></div>}
        <div className="stat"><small>Sisa yang harus dibayar pasien</small><strong>{rupiah(ledgerDue)}</strong></div>
        {estInsurer > 0 && <div className="stat"><small>Estimasi ditanggung asuransi <span className="est-label">Estimasi</span></small><strong>{rupiah(estInsurer)}</strong></div>}
        {estInsurer > 0 && <div className="stat em"><small>Estimasi sisa yang harus dibayar pasien <span className="est-label">Estimasi</span></small><strong>{rupiah(estPatientDue)}</strong></div>}
      </div>
      <p className="muted small">Total tagihan − sudah dibayar − sudah ditanggung asuransi{t.claimPending ? ' − klaim menunggu' : ''} = sisa yang harus dibayar pasien ({rupiah(ledgerDue)}).</p>
      <div className="tagihan-layout">
        <Card title="Buku besar" actions={<><Button size="sm" icon="print" onClick={() => setReceipt(true)}>Cetak kwitansi</Button><Button size="sm" icon="chat" disabled={s.offline} title={s.offline ? 'WhatsApp tidak tersedia saat offline' : undefined} onClick={() => setWa(true)}>Kirim via WhatsApp</Button></>}>
          <Ledger rows={rows} patients={s.patients} showPatient={scope === 'keluarga'} highlight={s.lastAddedProc} />
          {s.offline && <p className="muted small pad">WhatsApp tidak tersedia saat offline.</p>}
        </Card>
        <div className="stack">
          {p.insurance && (
            <Card title="Asuransi swasta">
              <dl className="kv"><dt>Penjamin</dt><dd>{p.insurance.insurer}</dd><dt>No. polis</dt><dd>{p.insurance.policyNo}</dd><dt>Tanggungan</dt><dd>{p.insurance.coverPct}% (contoh)</dd></dl>
              <div className="split">
                <div><small>Estimasi ditanggung asuransi <span className="est-label">Estimasi</span></small><strong>{rupiah(ownEstInsurer)}</strong></div>
                <div><small>Estimasi sisa pasien <span className="est-label">Estimasi</span></small><strong>{rupiah(payDue)}</strong></div>
              </div>
              <p className="muted small">Sisa di buku besar pasien ini: {rupiah(ownT.patientDue)}. Estimasi belum merubah saldo sampai klaim diajukan dan dibayar.</p>
              <Button variant="secondary" className="block" disabled={!unclaimedOwn.length} onClick={() => a.claim(p.id)}>{unclaimedOwn.length ? `Ajukan klaim ${p.insurance.insurer} (${unclaimedOwn.length} tindakan)` : 'Semua tindakan sudah diklaim'}</Button>
            </Card>
          )}
          <Card title="Bayar sekarang">
            <fieldset className="methods">
              <legend className="sr-only">Metode bayar</legend>
              {METHODS.map((m) => {
                const off = s.offline && m.v !== 'tunai'
                return (
                  <label key={m.v} className={`method ${effMethod === m.v ? 'on' : ''} ${off ? 'is-disabled' : ''}`}>
                    <input type="radio" name="method" checked={effMethod === m.v} disabled={off} onChange={() => setMethod(m.v)} />
                    <span>{m.label}</span>
                    {m.v === 'qris' && <QrisBadge />}
                    {off && <small>Perlu koneksi</small>}
                  </label>
                )
              })}
            </fieldset>
            {s.offline && <p className="muted small">Offline: hanya tunai. Pembayaran dicatat lokal dan disinkronkan nanti.</p>}
            <Field label="Jumlah dibayar" hint={`Estimasi sisa yang harus dibayar pasien ${rupiah(payDue)}. Boleh bayar sebagian.`}>{(id) => <Input id={id} inputMode="numeric" value={amt === '' ? String(payDue) : amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ''))} />}</Field>
            {value > 0 && value < payDue && <p className="callout info">Bayar sebagian. Estimasi sisa setelah ini: <strong>{rupiah(payDue - value)}</strong></p>}
            <Button variant="primary" className="block" disabled={value <= 0} onClick={() => { a.pay(p.id, value, effMethod); setAmt(''); a.toast(`Pembayaran ${rupiah(value)} dicatat.`) }}>Catat pembayaran {rupiah(value)}</Button>
          </Card>
        </div>
      </div>

      {receipt && (
        <Modal title="Kwitansi" wide onClose={() => setReceipt(false)} footer={<><Button variant="ghost" onClick={() => setReceipt(false)}>Tutup</Button><Button variant="primary" icon="print" onClick={() => window.print()}>Cetak</Button></>}>
          <div className="receipt print-area">
            <header><strong>{BRANCHES.find((b) => b.id === s.branchId)!.name}</strong><span>Kwitansi · {nowLabel()}</span></header>
            <p>Diterima dari: <strong>{p.name}</strong> ({p.rm})</p>
            <table className="table">
              <thead><tr><th>Tanggal</th><th>Tindakan</th><th className="num">Jumlah</th></tr></thead>
              <tbody>{todayRows.filter((r) => r.kind === 'tindakan').map((r) => <tr key={r.id}><td>{dateLabel(r.date)}</td><td>{r.desc}</td><td className="num">{rupiah(r.amount)}</td></tr>)}</tbody>
              <tfoot>
                <tr><td colSpan={2}>Total tindakan hari ini</td><td className="num">{rupiah(todayRows.filter((r) => r.kind === 'tindakan').reduce((x, r) => x + r.amount, 0))}</td></tr>
                <tr><td colSpan={2}>Dibayar hari ini</td><td className="num">{rupiah(todayRows.filter((r) => r.kind === 'pembayaran').reduce((x, r) => x + r.amount, 0))}</td></tr>
                <tr><td colSpan={2}>Total tagihan (akun)</td><td className="num">{rupiah(ownT.charges)}</td></tr>
                <tr><td colSpan={2}>Sudah dibayar (akun)</td><td className="num">{rupiah(ownT.paid)}</td></tr>
                <tr><td colSpan={2}>Sudah ditanggung asuransi</td><td className="num">{rupiah(ownT.claimPaid)}</td></tr>
                {ownT.claimPending > 0 && <tr><td colSpan={2}>Klaim menunggu</td><td className="num">{rupiah(ownT.claimPending)}</td></tr>}
                <tr><td colSpan={2}>Sisa yang harus dibayar pasien</td><td className="num">{rupiah(ownT.patientDue)}</td></tr>
                {ownEstInsurer > 0 && <tr><td colSpan={2}>Estimasi ditanggung asuransi</td><td className="num">{rupiah(ownEstInsurer)}</td></tr>}
                {ownEstInsurer > 0 && <tr><td colSpan={2}><strong>Estimasi sisa yang harus dibayar pasien</strong></td><td className="num"><strong>{rupiah(payDue)}</strong></td></tr>}
              </tfoot>
            </table>
            <small className="muted">Kwitansi hanya memuat tindakan dan jumlah. Tanpa diagnosis.</small>
          </div>
        </Modal>
      )}
      {wa && (
        <Modal title="Kirim kwitansi via WhatsApp" onClose={() => setWa(false)} footer={<><Button variant="ghost" onClick={() => setWa(false)}>Batal</Button><Button variant="primary" icon="chat" onClick={() => { setWa(false); a.toast('Pesan masuk antrean kirim (simulasi).') }}>Kirim</Button></>}>
          <p>Ke: {maskPhone(p.phone)} {!p.consentRecallWa && <Badge tone="warning">Pasien belum memberi izin WhatsApp</Badge>}</p>
          <div className="wa-preview">Halo, terima kasih telah berkunjung ke Bitto Dental. Kwitansi pembayaran Anda tanggal 14 Nov 2026 tersedia di tautan aman berikut: bitto.contoh/k/•••• . Pesan ini tidak memuat informasi klinis.</div>
          <p className="muted small">Rincian tindakan tidak dikirim di isi pesan. Template perlu disetujui pemilik klinik.</p>
        </Modal>
      )}
    </div>
  )
}
