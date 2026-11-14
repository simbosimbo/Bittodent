import { useEffect, useState } from 'react'
import { CATALOG, CURRENT_USER, STAFF } from '../data/mock'
import type { ProcStatus, Surface } from '../data/types'
import { LEGEND, PROC_STATUSES, STATUS_MVP_NOTE, legendOf } from '../data/legend'
import { rupiah } from '../lib/format'
import { soapOf, useActive, useStore, visitsOf } from '../state/store'
import { Legend, Odontogram, isActiveMark, surfaceLetter, surfaceName, surfacesOf } from '../components/Odontogram'
import { Odontogram3D } from '../components/Odontogram3D'
import { ProcedureList } from '../components/ProcedureList'
import { SoapEditor, SoapHistory } from '../components/SoapEditor'
import { NoPatient } from '../components/Chrome'
import { Badge, Button, Card, DraftAiBadge, Field, LockedBadge, Modal, Seg, Switch, Textarea } from '../components/ui'

function Tabs({ soap }: { soap: boolean }) {
  return (
    <nav className="tabs" aria-label="Bagian Charting">
      <a href="#/charting" className={!soap ? 'on' : ''} aria-current={!soap ? 'page' : undefined}>Odontogram & tindakan</a>
      <a href="#/charting/soap" className={soap ? 'on' : ''} aria-current={soap ? 'page' : undefined}>Catatan SOAP</a>
    </nav>
  )
}

export function Charting({ soap }: { soap: boolean }) {
  const p = useActive()
  if (!p) return <div className="screen"><h2>Charting</h2><NoPatient module="Charting" /></div>
  return (
    <div className="screen">
      <div className="screen-head"><div><h2>Charting</h2><p className="muted">Odontogram di atas, daftar tindakan di bawah. SOAP ada di sini juga.</p></div></div>
      <Tabs soap={soap} />
      {soap ? <SoapPanel key={p.id} pid={p.id} /> : <ChartPanel key={p.id} pid={p.id} />}
    </div>
  )
}

function ChartPanel({ pid }: { pid: string }) {
  const { s, a } = useStore()
  const p = useActive()!
  const visits = visitsOf(s, pid)
  const [vi, setVi] = useState<number | null>(null) // null = kunjungan terbaru
  const [compare, setCompare] = useState(false)
  const [tooth, setTooth] = useState<number | null>(46)
  const [surfs, setSurfs] = useState<Surface[]>(['O', 'D'])
  const [procStatus, setProcStatus] = useState<ProcStatus>('direncanakan')
  const [dent, setDent] = useState<'permanen' | 'sulung' | 'campuran'>(p.dob > '2014-01-01' ? 'sulung' : 'permanen')
  const [showLegend, setShowLegend] = useState(true)
  const [tool, setTool] = useState<'pilih' | 'hapus'>('pilih')
  const viewKey = `bitto.chart.view:${CURRENT_USER.name}`
  const [view, setView] = useState<'2d' | '3d'>(() => (localStorage.getItem(viewKey) === '3d' ? '3d' : '2d'))
  useEffect(() => { localStorage.setItem(viewKey, view) }, [view, viewKey])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const idx = vi == null ? visits.length - 1 : Math.min(vi, visits.length - 1)
  const visit = visits[idx]
  const cur = visits[visits.length - 1]
  const prev = visits[visits.length - 2]
  const editable = idx === visits.length - 1 && visit.state === 'draft'
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return
      if (e.key === 'Escape') { setTooth(null); setSurfs([]); return }
      if (!tooth || !editable) return
      const k = e.key.toUpperCase()
      const map: Record<string, Surface> = { M: 'M', D: 'D', O: 'O', I: 'I', B: 'B', L: 'L', P: 'L' }
      const sf = map[k]
      if (sf && surfacesOf(tooth).includes(sf)) {
        e.preventDefault()
        setSurfs((prev) => prev.includes(sf) ? prev.filter((x) => x !== sf) : [...prev, sf])
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [tooth, editable])
  const procs = s.procs.filter((x) => x.patientId === pid)
  const keysOf = (list: typeof procs) => new Set(list.filter((x) => x.tooth).flatMap((x) => x.surfaces.length ? x.surfaces.map((sf) => `t${x.tooth}-${sf}`) : [`t${x.tooth}`]))
  const plan = keysOf(procs.filter((x) => x.status === 'direncanakan'))
  const done = keysOf(procs.filter((x) => x.status === 'selesai' || x.status === 'sudah_ada_sini'))
  const changed = new Set<number>()
  if (prev) for (const k of new Set([...Object.keys(prev.marks), ...Object.keys(cur.marks)])) if (prev.marks[k]?.cond !== cur.marks[k]?.cond) changed.add(Number(k.slice(1, 3)))
  const pickTooth = (t: number) => {
    if (tool === 'hapus' && editable) {
      const keys = [`t${t}`, ...surfacesOf(t).map((sf) => `t${t}-${sf}`)]
      a.setMark(pid, keys, 'sehat')
      return
    }
    setTooth(t); setSurfs([])
  }
  const pickSurface = (t: number, sf: Surface) => {
    if (tool === 'hapus' && editable) {
      a.setMark(pid, [`t${t}-${sf}`], 'sehat')
      return
    }
    setTooth(t)
    setSurfs((prev) => (t === tooth ? (prev.includes(sf) ? prev.filter((x) => x !== sf) : [...prev, sf]) : [sf]))
  }
  const applyCond = (key: (typeof LEGEND)[number]['key'], scope: (typeof LEGEND)[number]['scope']) => {
    if (!tooth || !editable) return
    const keys = scope === 'surface' ? surfs.map((sf) => `t${tooth}-${sf}`) : [`t${tooth}`]
    if (scope === 'surface' && !keys.length) { a.toast('Pilih permukaan dulu, lalu ketuk kondisi.'); return }
    a.setMark(pid, keys, key)
  }
  const tipFor = (t: number) => {
    const conds = Object.entries(visit.marks).filter(([k, m]) => isActiveMark(m) && (k === `t${t}` || k.startsWith(`t${t}-`))).map(([k, m]) => `${k.includes('-') ? surfaceLetter(t, k.split('-')[1] as 'M'|'D'|'O'|'I'|'B'|'L') : 'gigi'}: ${legendOf(m.cond).label}`)
    const planned = procs.filter((x) => x.tooth === t && x.status === 'direncanakan').map((x) => `Rencana: ${x.name}`)
    const finished = procs.filter((x) => x.tooth === t && (x.status === 'selesai' || x.status === 'sudah_ada_sini')).map((x) => `Selesai: ${x.name}`)
    const missing = visit.marks[`t${t}`]?.cond === 'hilang' || visit.marks[`t${t}`]?.cond === 'sisa_akar'
    return [`Gigi ${t}`, ...(missing ? ['Hilang/dicabut — tindakan lain disembunyikan'] : conds), ...planned, ...finished].join('\n') || `Gigi ${t}`
  }

  const toggleSurf = (sf: Surface) => setSurfs(surfs.includes(sf) ? surfs.filter((x) => x !== sf) : [...surfs, sf])
  const hasAi = Object.values(visit.marks).some((m) => m.ai && m.state === 'draft')

  return (
    <>
      <div className="chart-float-toolbar" role="toolbar" aria-label="Alat odontogram">
        <div className="tool-group">
          <Button size="sm" variant={tool === 'pilih' ? 'primary' : 'secondary'} onClick={() => setTool('pilih')}>Pilih</Button>
          <Button size="sm" variant={tool === 'hapus' ? 'primary' : 'secondary'} disabled={!editable} onClick={() => setTool('hapus')}>Hapus</Button>
        </div>
        <div className="tool-group">
          <Button size="sm" variant={showLegend ? 'primary' : 'secondary'} onClick={() => setShowLegend(!showLegend)}>Legenda</Button>
          <Seg label="Dentisi" value={dent} onChange={setDent} options={[{ v: 'permanen', label: 'Tetap' }, { v: 'sulung', label: 'Sulung' }, { v: 'campuran', label: 'Campuran' }]} />
        </div>
        <div className="tool-group">
          <Seg label="Tampilan" value={view} onChange={setView} options={[{ v: '2d', label: '2D' }, { v: '3d', label: '3D' }]} />
          <Button size="sm" icon="print" onClick={() => window.print()}>Cetak</Button>
        </div>
        <span className="spacer" />
        <label className="inline-field">Kunjungan
          <select className="input" value={idx} onChange={(e) => { const n = Number(e.target.value); setVi(n === visits.length - 1 ? null : n); setCompare(false) }}>
            {visits.map((v, i) => <option key={v.id} value={i}>{v.label} — {v.state === 'signed' ? 'terkunci' : 'draf'}</option>)}
          </select>
        </label>
        {prev && <Switch checked={compare} onChange={setCompare} label="Bandingkan" />}
        {visit.state === 'signed'
          ? <span className="row gap-s"><LockedBadge /><small className="muted">{visit.signer} · {visit.signedAt}</small></span>
          : <span className="row gap-s">{hasAi && <DraftAiBadge />}<Badge tone="draft">Draf</Badge></span>}
      </div>

      {compare && prev ? (
        <div className="compare">
          <Card title={<>Kunjungan sebelumnya · {prev.label} <LockedBadge /></>}><Odontogram marks={prev.marks} dentition={dent} label={`Odontogram ${prev.label}`} idPrefix="prev-" changed={changed} compact /></Card>
          <Card title={<>Sekarang · {cur.label} {cur.state === 'draft' ? <Badge tone="draft">Draf</Badge> : <LockedBadge />}</>}><Odontogram marks={cur.marks} dentition={dent} label={`Odontogram ${cur.label}`} changed={changed} compact /></Card>
          <p className="muted small span-2">Bingkai kuning = gigi yang berubah: {[...changed].sort().join(', ') || 'tidak ada'}.</p>
        </div>
      ) : (
        <div className="chart-layout" id="chart-print">
          <Card className="chart-card">
            {view === '3d' && (
              <div className="chart-3d">
                <Odontogram3D marks={visit.marks} plan={plan} done={done} dentition={dent} />
                <p className="muted small">Tampilan 3D hanya baca. Overlay kondisi mengikuti data bagan yang sama dan legenda internal (warna + bentuk). Ketuk gigi di bagan 2D di bawah untuk mengubah kondisi.</p>
              </div>
            )}
            <Odontogram marks={visit.marks} plan={plan} done={done} layers dentition={dent} selected={tooth} selectedSurfaces={surfs} onSelect={pickTooth} onSelectSurface={pickSurface} label={`Odontogram ${visit.label}`} changed={editable ? changed : undefined} tipFor={tipFor} compact={view === '3d'} />
            {showLegend && <Legend />}
          </Card>
          <Card className="tooth-panel" title={tooth ? `Gigi ${tooth}` : 'Pilih gigi'}>
            <div className="chart-summary" aria-live="polite">
              {tooth
                ? <>Gigi {tooth}{surfs.length ? ` · ${surfs.map((sf) => surfaceLetter(tooth, sf)).join(', ')}` : ' · pilih permukaan'} · ketuk kondisi</>
                : <>Pilih gigi, lalu permukaan, lalu ketuk kondisi.</>}
            </div>
            <p className="muted small">Alur: ketuk gigi → ketuk permukaan → satu ketukan pada chip kondisi. Urungkan lewat toast (kecuali tanda tangan). Pintasan: M D O I B L / P, Esc membatalkan pilih.</p>
            {!tooth ? <p className="muted">Ketuk gigi pada odontogram, atau ketuk langsung salah satu permukaannya.</p> : (
              <>
                <fieldset disabled={!editable}>
                  <legend>1. Pilih permukaan</legend>
                  <div className="surf-chips">
                    {surfacesOf(tooth).map((sf) => <button key={sf} type="button" className={`chip ${surfs.includes(sf) ? 'on' : ''}`} aria-pressed={surfs.includes(sf)} onClick={() => toggleSurf(sf)}><b>{surfaceLetter(tooth, sf)}</b> {surfaceName(tooth, sf)}</button>)}
                  </div>
                </fieldset>
                <fieldset disabled={!editable}>
                  <legend>2. Kondisi temuan — satu ketukan</legend>
                  <div className="cond-grid">
                    {LEGEND.map((l) => (
                      <button key={l.key} type="button" className="cond-btn" disabled={!editable || (l.scope === 'surface' && !surfs.length)}
                        onClick={() => applyCond(l.key, l.scope)}>
                        <i className={`sw sw-${l.key}`} aria-hidden />{l.label}<small>{l.scope === 'tooth' ? 'seluruh gigi' : 'per permukaan'}</small>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset disabled={!editable}>
                  <legend>Status tindakan <span className="badge badge-neutral">Kemungkinan MVP</span></legend>
                  <p className="muted small">{STATUS_MVP_NOTE}</p>
                  <div className="surf-chips">
                    {PROC_STATUSES.map((st) => (
                      <button key={st.key} type="button" className={`chip ${procStatus === st.key ? 'on' : ''}`} aria-pressed={procStatus === st.key} onClick={() => setProcStatus(st.key)}>
                        <i className={`st-dot st-${st.key}`} aria-hidden /><b>{st.label}</b>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {tooth && Object.entries(visit.marks).some(([k, m]) => isActiveMark(m) && (k === `t${tooth}` || k.startsWith(`t${tooth}-`))) && (
                  <fieldset disabled={!editable}>
                    <legend>Nonaktifkan kondisi (tetap di riwayat)</legend>
                    <div className="surf-chips">
                      {Object.entries(visit.marks).filter(([k, m]) => isActiveMark(m) && (k === `t${tooth}` || k.startsWith(`t${tooth}-`))).map(([k, m]) => (
                        <button key={k} type="button" className="chip" onClick={() => a.setMarkActive(pid, k, false)}>Nonaktifkan {legendOf(m.cond).label} ({k})</button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <fieldset disabled={!editable} className="quick">
                  <legend>4. Tindakan cepat → Rencana & Tagihan</legend>
                  <Switch checked={s.autoFlow} onChange={a.setAutoFlow} label="Alirkan otomatis ke Tagihan" />
                  <div className="quick-grid">
                    {CATALOG.filter((c) => !['scaling', 'rontgen'].includes(c.id)).map((c) => (
                      <button key={c.id} type="button" className="quick-btn" disabled={!editable || (c.perSurface && !surfs.length)}
                        onClick={() => a.addProc(pid, c.id, tooth, c.perSurface ? surfs : [], procStatus === 'kondisi' ? 'direncanakan' : procStatus)}>
                        <strong>{c.name}</strong><small>{rupiah(c.fee)}{c.perSurface ? ' · per permukaan' : ''}</small>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {!editable && <p className="muted small">Kunjungan ini terkunci. Koreksi lewat "Buat versi baru" di SOAP.</p>}
              </>
            )}
          </Card>
        </div>
      )}

      <Card title="Daftar tindakan" actions={<small className="muted">{procs.length} baris · warna menurut status</small>}>
        <ProcedureList procs={[...procs].reverse()} highlight={s.lastAddedProc} selected={picked} onToggle={(id) => setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })} />
        {!!picked.size && (() => {
          const rows = procs.filter((x) => picked.has(x.id))
          const biaya = rows.reduce((a, r) => a + r.fee, 0)
          const diskon = 0
          const cover = p.insurance ? Math.round((biaya - diskon) * p.insurance.coverPct / 100) : 0
          return (
            <div className="grid-totals">
              <span>{picked.size} dipilih</span>
              <span>Biaya <strong>{rupiah(biaya)}</strong></span>
              <span>Diskon <strong>{rupiah(diskon)}</strong></span>
              {p.insurance && <span>Asuransi ({p.insurance.coverPct}%) <strong>{rupiah(cover)}</strong></span>}
              <span className="em">Bagian pasien <strong>{rupiah(biaya - diskon - cover)}</strong></span>
              <button type="button" className="link" onClick={() => setPicked(new Set())}>Hapus pilih</button>
            </div>
          )
        })()}
      </Card>
      {Object.entries(visit.marks).some(([, m]) => m.active === false) && (
        <Card title="Riwayat kondisi nonaktif">
          <p className="muted small">Kondisi nonaktif tidak tampil di bagan, tetapi tetap tercatat.</p>
          <ul className="list">
            {Object.entries(visit.marks).filter(([, m]) => m.active === false).map(([k, m]) => (
              <li key={k} className="list-row static">
                <span>{k.replace('t', 'gigi ')}</span>
                <span>{legendOf(m.cond).label}</span>
                {editable && <button type="button" className="link" onClick={() => a.setMarkActive(pid, k, true)}>Aktifkan lagi</button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <GuidedExam pid={pid} />
      <span className="sr-only">{p.name}</span>
    </>
  )
}

function GuidedExam({ pid }: { pid: string }) {
  const { s } = useStore()
  const cur = visitsOf(s, pid).slice(-1)[0]
  const steps = ['Keluhan utama (S)', 'Pemeriksaan ekstraoral', 'Pemeriksaan intraoral & odontogram', 'Asesmen & rencana (dari dikte dokter)']
  return (
    <Card title={<>Pemeriksaan terpandu {cur.state === 'draft' ? <Badge tone="draft">Draf</Badge> : <LockedBadge />}</>}>
      <ol className="guided">
        {steps.map((x, i) => <li key={x} className={i < 3 ? 'done' : ''}><span>{i + 1}</span>{x}{i === 3 && <a href="#/charting/soap" className="link"> Lanjut ke SOAP</a>}</li>)}
      </ol>
    </Card>
  )
}

function SoapPanel({ pid }: { pid: string }) {
  const { s, a } = useStore()
  const versions = soapOf(s, pid)
  const cur = versions[versions.length - 1]
  const [confirm, setConfirm] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [newV, setNewV] = useState(false)
  const [reason, setReason] = useState('')
  const hasAi = Object.values(cur.blocks).some((b) => b.ai)
  const empty = Object.values(cur.blocks).every((b) => !b.text.trim())
  return (
    <div className="soap-layout">
      <div>
        <div className="soap-status">
          {cur.state === 'signed'
            ? <><LockedBadge /><span>Versi {cur.v} ditandatangani <strong>{cur.signer}</strong> · {cur.signedAt}. Hanya baca.</span></>
            : <><Badge tone="draft">Draf versi {cur.v}</Badge>{hasAi && <DraftAiBadge />}<span className="muted">Belum berlaku sampai ditandatangani dokter.</span></>}
          <span className="spacer" />
          {cur.state === 'draft' && <Button icon="sparkle" disabled={s.offline} title={s.offline ? 'AI tidak tersedia saat offline' : 'Menyusun O/A/P dari dikte dokter; AI tidak mendiagnosis.'} onClick={() => a.aiDraft(pid)}>Susun draf dari dikte</Button>}
          {cur.state === 'draft'
            ? <>
                <Button variant="ghost" onClick={() => a.toast('Draf disimpan di sesi ini. Prototipe tidak mengirim ke server.')}>Simpan draf</Button>
                <Button variant="primary" icon="lock" disabled={s.offline || empty} title={s.offline ? 'Tanda tangan klinis tidak tersedia saat offline' : undefined} onClick={() => { setReviewed(false); setConfirm(true) }}>Setujui & tanda tangani</Button>
              </>
            : <Button onClick={() => { setReason(''); setNewV(true) }}>Buat versi baru</Button>}
        </div>
        {cur.state === 'draft' && <p className="soap-review-cue">Tinjau catatan ini sebelum dipakai — harus mencerminkan dikte dan kunjungan. Draf dari dikte bisa salah; dokter tetap pemegang keputusan.</p>}
        {s.offline && cur.state === 'draft' && <p className="callout warn">Mode offline: tanda tangan klinis dan AI tidak tersedia. Draf tetap bisa diedit.</p>}
        {cur.reason && <p className="callout info">Versi {cur.v} menggantikan versi {cur.supersedes}. Alasan: {cur.reason}</p>}
        <SoapEditor version={cur} onEdit={(k, t) => a.editSoap(pid, k, t)} />
      </div>
      <Card title="Riwayat versi"><SoapHistory versions={versions} /></Card>

      {confirm && (
        <Modal title="Setujui & tanda tangani catatan" onClose={() => setConfirm(false)} footer={<>
          <Button variant="ghost" onClick={() => setConfirm(false)}>Batal</Button>
          <Button variant="primary" icon="lock" disabled={!reviewed} onClick={() => { a.sign(pid); setConfirm(false); a.toast('Catatan ditandatangani dan dikunci.') }}>Saya sudah meninjau / Setujui dan kunci</Button>
        </>}>
          <dl className="kv"><dt>Penanda tangan</dt><dd>{STAFF.dokter}</dd><dt>Versi</dt><dd>{cur.v}</dd></dl>
          <div className="callout warn">
            <strong>Ini hanya panduan. Dokter wajib meninjau.</strong> Setelah disetujui, catatan SOAP dan odontogram kunjungan ini terkunci. Tidak bisa diubah atau dihapus. Koreksi hanya lewat versi baru dengan alasan; versi ini tetap tersimpan di riwayat.
          </div>
          {hasAi && <p><DraftAiBadge /> Bagian bertanda ini disusun dari dikte dokter. Periksa setiap kalimat sebelum menyetujui.</p>}
          <label className="check"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />Saya sudah meninjau seluruh isi, termasuk bagian draf AI, dan bertanggung jawab atas catatan ini.</label>
        </Modal>
      )}
      {newV && (
        <Modal title="Buat versi baru" onClose={() => setNewV(false)} footer={<>
          <Button variant="ghost" onClick={() => setNewV(false)}>Batal</Button>
          <Button variant="primary" disabled={reason.trim().length < 10} onClick={() => { a.newVersion(pid, reason.trim()); setNewV(false) }}>Buat draf versi {cur.v + 1}</Button>
        </>}>
          <p>Versi {cur.v} tetap tersimpan dan terkunci. Versi baru dimulai sebagai draf dan perlu ditandatangani lagi.</p>
          <Field label="Alasan koreksi" required hint="Minimal 10 karakter. Tercatat di jejak audit." error={reason && reason.trim().length < 10 ? 'Alasan terlalu pendek' : undefined}>{(id) => <Textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        </Modal>
      )}
    </div>
  )
}
