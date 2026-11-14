import { useState } from 'react'
import tokens from '../../../tokens.json'
import { IMAGES, STAFF } from '../data/mock'
import { dateLabel, rupiah } from '../lib/format'
import { go } from '../lib/router'
import { patientOf, useActive, useStore } from '../state/store'
import { NoPatient, FlowStepper } from '../components/Chrome'
import { Legend } from '../components/Odontogram'
import { Badge, Button, Card, ClaimPendingBadge, DraftAiBadge, Field, Input, LockedBadge, OfflineBadge, QrisBadge, Select, Switch, UnsyncedBadge } from '../components/ui'

// Gambar placeholder: SVG buatan sendiri, bukan citra pasien.
function FakeXray({ kind }: { kind: string }) {
  const n = kind === 'Panoramik' ? 12 : kind === 'Bitewing' ? 4 : 3
  return (
    <svg viewBox="0 0 160 100" className="xray" role="img" aria-label={`Gambar contoh ${kind}`}>
      <rect width="160" height="100" fill={kind === 'Foto intraoral' ? '#5b3a3a' : '#1b2228'} />
      {Array.from({ length: n }, (_, i) => {
        const w = 140 / n, x = 10 + i * w
        return <g key={i} opacity={0.85}><rect x={x + 2} y={18} width={w - 6} height={34} rx={6} fill="#cfd6da" /><path d={`M${x + 5} 50 L${x + w / 2 - 1} 88 L${x + w - 7} 50`} fill="#9aa5ab" /></g>
      })}
      <text x="6" y="12" fontSize="8" fill="#9fb">CONTOH</text>
    </svg>
  )
}

export function Gambar() {
  const { s } = useStore()
  const p = useActive()
  const [sel, setSel] = useState<string | null>(null)
  if (!p) return <div className="screen"><h2>Gambar / Rontgen</h2><NoPatient module="Gambar / Rontgen" /></div>
  const imgs = IMAGES.filter((i) => i.patientId === p.id)
  const cur = imgs.find((i) => i.id === sel) ?? imgs[0]
  return (
    <div className="screen">
      <div className="screen-head">
        <div><h2>Gambar / Rontgen</h2><p className="muted">Gambar contoh (placeholder). Disimpan terenkripsi di penyimpanan di Indonesia.</p></div>
        <Button icon="upload" disabled={s.offline} title={s.offline ? 'Unggah perlu koneksi' : undefined}>Unggah gambar</Button>
      </div>
      {!imgs.length ? <Card><p className="muted pad">Belum ada gambar untuk pasien ini.</p></Card> : (
        <div className="gambar-layout">
          <Card className="viewer" title={`${cur.kind} · ${dateLabel(cur.date)}`} actions={<Badge>Gigi {cur.tooth}</Badge>}>
            <FakeXray kind={cur.kind} />
            <p className="muted small pad">{cur.note}. Alat ukur & anotasi belum ada di prototipe.</p>
          </Card>
          <Card title={`Semua gambar (${imgs.length})`}>
            <ul className="thumbs">
              {imgs.map((i) => (
                <li key={i.id}><button className={i.id === cur.id ? 'on' : ''} onClick={() => setSel(i.id)} aria-pressed={i.id === cur.id}>
                  <FakeXray kind={i.kind} /><span><strong>{i.kind}</strong><small>{dateLabel(i.date)} · gigi {i.tooth}</small></span>
                </button></li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

export function Kelola() {
  const { s, a } = useStore()
  const today = s.ledger.filter((r) => r.date === '2026-11-14')
  const income = today.filter((r) => r.kind === 'pembayaran').reduce((x, r) => x + r.amount, 0)
  const byMethod = ['tunai', 'transfer', 'kartu', 'qris'].map((m) => [m, today.filter((r) => r.method === m).reduce((x, r) => x + r.amount, 0)] as const)
  const max = Math.max(1, ...byMethod.map(([, v]) => v))
  const visits = s.appts.filter((x) => x.where === 'grid' && x.branchId === s.branchId)
  return (
    <div className="screen">
      <div className="screen-head"><div><h2>Kelola</h2><p className="muted">Pengaturan klinik dan laporan ringkas.</p></div></div>
      <div className="stats">
        <div className="stat"><small>Kunjungan hari ini</small><strong>{visits.length}</strong></div>
        <div className="stat"><small>Selesai</small><strong>{visits.filter((v) => v.status === 'selesai').length}</strong></div>
        <div className="stat"><small>Pendapatan hari ini</small><strong>{rupiah(income)}</strong></div>
        <div className="stat"><small>Klaim menunggu</small><strong>{s.ledger.filter((r) => r.claimStatus === 'menunggu').length}</strong><ClaimPendingBadge /></div>
      </div>
      <div className="grid-2">
        <Card title="Pendapatan per metode (hari ini)">
          <ul className="bars">{byMethod.map(([m, v]) => <li key={m}><span>{m === 'qris' ? 'QRIS' : m[0].toUpperCase() + m.slice(1)}</span><i style={{ width: `${(v / max) * 100}%` }} /><b>{rupiah(v)}</b></li>)}</ul>
        </Card>
        <Card title="Kursi di cabang ini">
          <p className="muted small">Pengaturan sederhana: cukup nama kursi. Tidak ada konfigurasi rumit per dokter atau ruang.</p>
          <ul className="chair-setup">
            {s.branches.find((b) => b.id === s.branchId)!.chairs.map((c) => (
              <li key={c.id}>
                <Input aria-label={`Nama ${c.name}`} value={c.name} onChange={(e) => a.renameChair(s.branchId, c.id, e.target.value)} />
                <Button size="sm" variant="ghost" disabled={s.branches.find((b) => b.id === s.branchId)!.chairs.length <= 1} onClick={() => a.removeChair(s.branchId, c.id)}>Hapus</Button>
              </li>
            ))}
          </ul>
          <Button size="sm" icon="plus" onClick={() => a.addChair(s.branchId)}>Tambah kursi</Button>
          <p className="muted small">Cabang lain: {s.branches.filter((b) => b.id !== s.branchId).map((b) => `${b.name} (${b.chairs.length} kursi)`).join(' · ')}</p>
          <Switch checked={s.simple} onChange={a.setSimple} label="Mode sederhana (praktik mandiri)" />
        </Card>
        <Card title="Pengguna & keamanan">
          <table className="table"><thead><tr><th>Nama</th><th>Peran</th><th>TOTP</th></tr></thead>
            <tbody><tr><td>{STAFF.dokter}</td><td>Dokter gigi</td><td><Badge tone="success">Aktif</Badge></td></tr><tr><td>{STAFF.resepsionis}</td><td>Resepsionis</td><td><Badge tone="success">Aktif</Badge></td></tr></tbody></table>
          <p className="muted small pad">Kode autentikator (TOTP) wajib untuk semua peran. "Ingat saya" tidak tersedia.</p>
        </Card>
        <Card title="Template pengingat WhatsApp">
          <Field label="Template kontrol" hint="Tanpa isi klinis. Perlu disetujui pemilik klinik.">{(id) => <Input id={id} readOnly value="Halo {nama}, saatnya kontrol gigi di Bitto Dental. Balas YA untuk membuat janji." />}</Field>
          <Badge tone="warning">Menunggu persetujuan pemilik</Badge>
        </Card>
        <Card title="Odontogram"><Legend /></Card>
        <Card title="Perangkat offline">
          <Field label="Perangkat cabang terdaftar">{(id) => <Select id={id}><option>Tablet resepsionis — Menteng</option></Select>}</Field>
          <p className="muted small">PIN 6 angka, data maks 12 jam, hanya data hari ini per cabang. 5x salah = data lokal dihapus.</p>
          <Button onClick={() => go('/pin')}>Pratinjau layar PIN</Button>
        </Card>
      </div>
    </div>
  )
}

const flat = (o: object, pre = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => k.startsWith('$') ? [] : typeof v === 'object' ? flat(v, `${pre}${k}-`) : [[pre + k, String(v)]])
export function Desain() {
  const colors = flat(tokens.color)
  return (
    <div className="screen">
      <div className="screen-head"><div><h2>Sistem desain</h2><p className="muted">Sumber: design/tokens.json → src/styles/tokens.css</p></div></div>
      <Card title="Warna">
        <div className="swatches">{colors.map(([k, v]) => <div key={k} className="swatch"><i style={{ background: v }} /><code>{k}</code><small>{v}</small></div>)}</div>
      </Card>
      <div className="grid-2">
        <Card title="Skala huruf">
          {Object.entries(tokens.font.size).map(([k, v]) => <p key={k} style={{ fontSize: v, margin: '4px 0' }}><code>{k} · {v}</code> Pasien aktif Siti</p>)}
          <p className="muted small">Font: {tokens.font.family.sans}. Teks isi 14px desktop, 16px tablet.</p>
        </Card>
        <Card title="Spasi & radius">
          {Object.entries(tokens.space).map(([k, v]) => <div key={k} className="space-row"><code>space-{k}</code><i style={{ width: v }} /><small>{v}</small></div>)}
          <div className="row gap wrap pad">{Object.entries(tokens.radius).map(([k, v]) => <div key={k} className="radius-box" style={{ borderRadius: v }}>{k}<br />{v}</div>)}</div>
          <div className="row gap wrap pad">{Object.keys(tokens.shadow).filter((k) => k !== 'focus').map((k) => <div key={k} className="radius-box" style={{ boxShadow: `var(--shadow-${k})` }}>shadow-{k}</div>)}</div>
        </Card>
        <Card title="Tombol">
          <div className="row gap wrap"><Button variant="primary">Utama</Button><Button>Sekunder</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Bahaya</Button><Button variant="primary" disabled>Nonaktif</Button><Button size="sm">Kecil</Button></div>
        </Card>
        <Card title="Input">
          <Field label="Nama" hint="Teks bantuan">{(id) => <Input id={id} placeholder="Placeholder" />}</Field>
          <Field label="Dengan galat" error="Wajib diisi">{(id) => <Input id={id} aria-invalid />}</Field>
          <Field label="Pilihan">{(id) => <Select id={id}><option>Opsi</option></Select>}</Field>
        </Card>
        <Card title="Lencana">
          <div className="row gap wrap"><DraftAiBadge /><LockedBadge /><OfflineBadge /><UnsyncedBadge /><ClaimPendingBadge /><QrisBadge /><Badge tone="success">Selesai</Badge><Badge tone="danger">Alergi</Badge></div>
        </Card>
        <Card title="Tabel">
          <table className="table"><thead><tr><th>Tindakan</th><th className="num">Biaya</th></tr></thead><tbody><tr><td>Tambalan komposit</td><td className="num">{rupiah(450000)}</td></tr><tr><td>Scaling</td><td className="num">{rupiah(350000)}</td></tr></tbody></table>
        </Card>
      </div>
    </div>
  )
}

export function Alur({ path }: { path: string }) {
  const { s, a } = useStore()
  const active = patientOf(s, s.activeId)
  return (
    <div className="screen">
      <div className="screen-head"><div><h2>Alur kunjungan pertama</h2><p className="muted">Setiap langkah membuka modul asli untuk pasien yang sama. Bukan wizard terpisah.</p></div></div>
      <FlowStepper path={path} inline />
      <div className="row gap wrap">
        <Button variant="primary" onClick={() => { a.setActive(null); a.startFlow(null); go('/keluarga/baru') }}>Mulai dengan pasien baru</Button>
        {active && <Button onClick={() => { a.startFlow(active.id); go('/jadwal') }}>Jalankan untuk {active.name}</Button>}
        {s.flow.active && <Button variant="ghost" onClick={a.stopFlow}>Hentikan alur</Button>}
      </div>
      <Card title="Langkah">
        <ol className="flow-explain">
          <li><strong>Registrasi</strong> — Keluarga/Profil: isi data + persetujuan UU PDP; pasien jadi pasien aktif.</li>
          <li><strong>Jadwal</strong> — ketuk slot kosong di kursi untuk memesan pasien aktif.</li>
          <li><strong>Pemeriksaan + odontogram</strong> — Charting: tandai temuan (draf), tambah tindakan cepat.</li>
          <li><strong>Tanda tangan SOAP</strong> — Charting › SOAP: dokter meninjau draf AI, menandatangani, catatan terkunci.</li>
          <li><strong>Bayar</strong> — Tagihan: tindakan sudah ada di buku besar; catat pembayaran, cetak kwitansi.</li>
        </ol>
      </Card>
    </div>
  )
}
