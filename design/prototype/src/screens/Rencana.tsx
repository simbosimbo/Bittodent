import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { rupiah } from '../lib/format'
import { go } from '../lib/router'
import { useActive, useStore, visitsOf } from '../state/store'
import { Odontogram } from '../components/Odontogram'
import { ProcedureList } from '../components/ProcedureList'
import { NoPatient } from '../components/Chrome'
import { Badge, Button, Card, Field, Input } from '../components/ui'

export function Rencana() {
  const { s, a } = useStore()
  const p = useActive()
  if (!p) return <div className="screen"><h2>Rencana Perawatan</h2><NoPatient module="Rencana Perawatan" /></div>
  const plan = s.procs.filter((x) => x.patientId === p.id && x.inPlan && x.status !== 'kondisi')
  const open = plan.filter((x) => x.status === 'direncanakan')
  const unbilled = plan.filter((x) => !x.billed)
  const total = open.reduce((t, x) => t + x.fee, 0)
  const ins = p.insurance ? Math.round(total * p.insurance.coverPct / 100) : 0
  return (
    <div className="screen">
      <div className="screen-head">
        <div><h2>Rencana Perawatan</h2><p className="muted">Bersumber dari tindakan yang ditambahkan di Charting.</p></div>
        <div className="row gap">
          {unbilled.length > 0 && <Button variant="primary" onClick={() => unbilled.forEach((x) => a.sendToLedger(x.id))}>Kirim semua ke tagihan ({unbilled.length})</Button>}
          <a className="btn btn-secondary" href="#/rencana/presentasi">Presentasi ke pasien</a>
          <a className="btn btn-secondary" href="#/charting">Tambah dari Charting</a>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><small>Tindakan rencana</small><strong>{open.length}</strong></div>
        <div className="stat"><small>Estimasi biaya</small><strong>{rupiah(total)}</strong></div>
        <div className="stat"><small>Estimasi asuransi</small><strong>{p.insurance ? rupiah(ins) : '—'}</strong>{p.insurance && <Badge tone="info">{p.insurance.insurer} {p.insurance.coverPct}%</Badge>}</div>
        <div className="stat em"><small>Estimasi porsi pasien</small><strong>{rupiah(total - ins)}</strong></div>
      </div>
      <Card title="Daftar rencana" actions={unbilled.length ? <Badge tone="warning">{unbilled.length} belum masuk tagihan</Badge> : <Badge tone="success">Semua sudah di tagihan</Badge>}>
        <ProcedureList procs={[...plan].reverse()} highlight={s.lastAddedProc} onBill={a.sendToLedger} onComplete={a.completeProc} empty="Belum ada rencana. Tambah tindakan dari Charting." />
      </Card>
    </div>
  )
}

// Tampilan tablet: sebelum/sesudah + total + tanda tangan persetujuan. Pelengkap, bukan acuan utama Charting.
export function PresentasiPasien() {
  const { s } = useStore()
  const p = useActive()
  const [name, setName] = useState(p?.name ?? '')
  const [drawn, setDrawn] = useState(false)
  const [done, setDone] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  if (!p) return <div className="screen"><h2>Presentasi ke pasien</h2><NoPatient module="Presentasi rencana" /></div>
  const visits = visitsOf(s, p.id)
  const prev = visits[visits.length - 2] ?? visits[0]
  const cur = visits[visits.length - 1]
  const open = s.procs.filter((x) => x.patientId === p.id && x.status === 'direncanakan')
  const planKeys = new Set(open.filter((x) => x.tooth).flatMap((x) => x.surfaces.length ? x.surfaces.map((sf) => `t${x.tooth}-${sf}`) : [`t${x.tooth}`]))
  const total = open.reduce((t, x) => t + x.fee, 0)
  const ins = p.insurance ? Math.round(total * p.insurance.coverPct / 100) : 0
  const startDraw = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current; if (!c) return
    const r = c.getBoundingClientRect()
    const ctx = c.getContext('2d')!
    ctx.strokeStyle = '#16212B'; ctx.lineWidth = 2; ctx.lineCap = 'round'
    const move = (ev: PointerEvent) => {
      ctx.lineTo(ev.clientX - r.left, ev.clientY - r.top); ctx.stroke(); setDrawn(true)
    }
    ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const canSign = name.trim().length > 2 && drawn
  if (done) {
    return (
      <div className="screen presentasi is-signed">
        <h2>Persetujuan rencana tersimpan</h2>
        <p>Ditandatangani <strong>{name}</strong> pada {new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB. Dokumen terkunci seperti catatan SOAP yang sudah ditandatangani.</p>
        <div className="row gap"><a className="btn btn-primary" href="#/rencana">Kembali ke Rencana</a><a className="btn btn-secondary" href="#/tagihan">Lanjut ke Tagihan</a></div>
      </div>
    )
  }
  return (
    <div className="screen presentasi">
      <div className="screen-head">
        <div><h2>Presentasi ke pasien</h2><p className="muted">Tampilan tablet: kunjungan lalu vs rencana, total biaya, lalu tanda tangan persetujuan.</p></div>
        <Button variant="ghost" onClick={() => go('/rencana')}>Tutup</Button>
      </div>
      <div className="compare presentasi-compare">
        <Card title="Kunjungan lalu"><Odontogram marks={prev.marks} dentition="permanen" label="Sebelum" idPrefix="pre-" compact /></Card>
        <Card title="Rencana sekarang"><Odontogram marks={cur.marks} plan={planKeys} layers dentition="permanen" label="Rencana" idPrefix="post-" compact /></Card>
      </div>
      <Card title="Ringkasan biaya">
        <table className="table">
          <thead><tr><th>Tindakan</th><th>Gigi</th><th className="num">Biaya</th></tr></thead>
          <tbody>
            {open.map((x) => <tr key={x.id}><td>{x.name}</td><td>{x.tooth ?? '—'}</td><td className="num">{rupiah(x.fee)}</td></tr>)}
            {!open.length && <tr><td colSpan={3} className="muted">Belum ada tindakan direncanakan.</td></tr>}
          </tbody>
        </table>
        <div className="grid-totals">
          <span>Total <strong>{rupiah(total)}</strong></span>
          {p.insurance && <span>Asuransi {p.insurance.insurer} ({p.insurance.coverPct}%) <strong>{rupiah(ins)}</strong></span>}
          <span className="em">Bagian pasien <strong>{rupiah(total - ins)}</strong></span>
        </div>
      </Card>
      <Card title="Tanda tangan persetujuan rencana">
        <p>Saya memahami rencana perawatan dan perkiraan biaya di atas. Tanda tangan di tablet ini dihitung sebagai persetujuan. Diagnosis tidak ditampilkan di ringkasan biaya.</p>
        <Field label="Nama lengkap (ketik)" required>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <p className="muted small">Gambar tanda tangan di kotak ini (jari atau stylus).</p>
        <canvas ref={canvas} width={640} height={180} className="sign-pad" onPointerDown={startDraw} aria-label="Kotak tanda tangan" />
        <div className="row gap end form-footer">
          <Button variant="ghost" onClick={() => { const c = canvas.current; c?.getContext('2d')?.clearRect(0, 0, 640, 180); setDrawn(false) }}>Hapus tanda tangan</Button>
          <Button variant="ghost" onClick={() => go('/rencana')}>Simpan draf</Button>
          <Button variant="primary" disabled={!canSign} onClick={() => setDone(true)}>Selesai & kunci persetujuan</Button>
        </div>
        {!canSign && <p className="muted small">Tombol selesai aktif setelah nama diisi dan tanda tangan digambar.</p>}
      </Card>
    </div>
  )
}
