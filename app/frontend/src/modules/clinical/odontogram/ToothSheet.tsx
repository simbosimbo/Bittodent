import { useEffect, useMemo, useState } from 'react'
import { ApiError, errorText } from '../../../shared/api/http'
import { getCatalog, getStages, saveToothEntry, type CatalogRow } from '../api'
import { SymbolDefs, SymbolIcon } from './symbols'
import { conditionByKey, conditionsIn, defaultRoles, padLabel, padsFor, spanEnds, spanTeeth, TAXONOMY, type Condition, type EntryStatus,
  type Material, type SpanRole, type SurfaceKey } from './taxonomy'

// Boards OVv2-01..03 + AL06 ("tindakan dulu"): tooth -> Permukaan | Seluruh gigi | Rentang -> condition (official symbol + code) -> status
// (Ada / Lain / Rencana / Selesai) -> one primary "Simpan 26 O cof". A Selesai entry IS today's procedure: the server bills the clinic code
// mapped to the condition; the odontogram draws from the same row. Several mapped codes -> the dentist picks one (pick_code).
// S3 "Tindakan" (default): the dentist picks the procedure; the server takes the condition from its catalog mapping (bahan when several).
type Tab = 'proc' | 'surface' | 'tooth' | 'span'
const TABS: [Tab, string][] = [['proc', 'Tindakan'], ['surface', 'Permukaan'], ['tooth', 'Seluruh gigi'], ['span', 'Rentang']]
const STATUS_SHORT: Record<EntryStatus, string> = { ada_sebelumnya: 'Ada', klinik_lain: 'Lain', rencana: 'Rencana', selesai: 'Selesai' }
// treatments default to Selesai (done today), findings to Ada; the dentist can switch with one tap
const TREATMENT = new Set(['amf', 'cof', 'gif', 'fis', 'inl', 'onl', 'rct', 'fmc', 'poc', 'mpc', 'gmc', 'meb', 'pob', 'prd', 'fld', 'ipx'])
const defaultStatus = (c: Condition | undefined): EntryStatus => (c?.code && TREATMENT.has(c.code) ? 'selesai' : 'ada_sebelumnya')
type Pick = { condition: string; list: { procedure_code: string; name: string }[] }

export function ToothSheet({ tooth, visitId, initialSurface, onSaved }: {
  tooth: number; visitId: string; initialSurface?: SurfaceKey; onSaved: (msg: string) => void
}) {
  const [tab, setTab] = useState<Tab>('proc')
  const [proc, setProc] = useState<CatalogRow | null>(null)
  const [serverBahan, setServerBahan] = useState<string[]>([]) // pick_condition candidates when the loaded catalog is stale
  const [pads, setPads] = useState<SurfaceKey[]>(initialSurface ? [initialSurface] : [])
  const [cond, setCond] = useState<string | null>(null) // surface / span: one condition
  const [conds, setConds] = useState<string[]>([]) // whole tooth: several, joined with "-" (poc-rct)
  const [more, setMore] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<EntryStatus>('selesai')
  const [spanTo, setSpanTo] = useState<number | null>(null)
  const [roles, setRoles] = useState<Record<number, SpanRole>>({})
  const [material, setMaterial] = useState<Material | ''>('')
  const [ext, setExt] = useState({ clinic: '', date: '' })
  const [codeFor, setCodeFor] = useState<Record<string, string>>({})
  const [pick, setPick] = useState<Pick | null>(null)
  // 409 duplicate_procedure: the same billable procedure is already on this site in this visit; ask before billing it twice
  const [dup, setDup] = useState<{ key: string; message: string } | null>(null)  // S2: stage/level per procedure (PSA kunjungan 1 / lanjutan, mahkota preparasi / pasang). Labels only; the owner sets them in Harga.
  const [stages, setStages] = useState<Record<string, { variant: string; label: string }[]>>({})
  const [catalog, setCatalog] = useState<CatalogRow[]>([])
  const [variantFor, setVariantFor] = useState<Record<string, string>>({})
  // any edit makes the duplicate question stale: "Tambah lagi" must confirm exactly the entry the server asked about
  useEffect(() => setDup(null), [pads, status, spanTo, roles, material, ext, variantFor])
  useEffect(() => {
    getStages().then((s) => setStages(s && typeof s === 'object' && !Array.isArray(s) ? s : {}), () => setStages({}))
    getCatalog().then((c) => setCatalog(Array.isArray(c) ? c : []), () => setCatalog([]))
  }, [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const surfaceConds = conditionsIn('surface')
  const shownSurface = more ? surfaceConds : surfaceConds.filter((c) => c.top)
  const toothConds = [...conditionsIn('tooth'), ...conditionsIn('implant')].filter((c) => c.key !== 'sehat'
    && (!q.trim() || `${c.label} ${c.code ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())))
  const procs = catalog.filter((r) => (r.treat_area === 'surface' || r.treat_area === 'tooth')
    && (!q.trim() || `${r.name} ${r.procedure_code}`.toLowerCase().includes(q.trim().toLowerCase())))
  const bahan = serverBahan.length ? serverBahan : TAXONOMY.conditions.filter((c) => c.code && proc?.conditions.includes(c.code)).map((c) => c.key)
  // in the Tindakan tab the one entry is keyed by its procedure code; elsewhere entries are keyed by condition
  const chosen = tab === 'proc' ? (proc ? [proc.procedure_code] : []) : tab === 'tooth' ? conds : cond ? [cond] : []
  const nameOf = (k: string) => (tab === 'proc' ? proc?.name : conditionByKey(k)?.label)
  const codes = tab === 'proc' ? proc?.name ?? '' : chosen.map((k) => conditionByKey(k)?.code ?? conditionByKey(k)?.label).join('-')
  const onSurface = tab === 'surface' || (tab === 'proc' && proc?.treat_area === 'surface')
  const span = tab === 'span' && spanTo ? spanTeeth(tooth, spanTo) : []
  const where = tab === 'span' ? (spanTo ? `${Math.min(tooth, spanTo)}-${Math.max(tooth, spanTo)}` : `${tooth}`) : `${tooth}${onSurface && pads.length ? ' ' + pads.join('') : ''}`
  const codeOf = (k: string, picked = codeFor) => {
    if (tab === 'proc') return k
    const mapped = catalog.filter((r) => r.conditions.includes(conditionByKey(k)?.code ?? '')).map((r) => r.procedure_code)
    return picked[k] ?? (mapped.length === 1 ? mapped[0] : undefined)
  }
  const stagesOf = (k: string, picked = codeFor) => (status === 'selesai' ? stages[codeOf(k, picked) ?? ''] ?? [] : [])
  const needStage = chosen.some((k) => stagesOf(k).length > 1 && !variantFor[k])
  const missing = !chosen.length ? (tab === 'proc' ? 'Pilih tindakan.' : 'Pilih kondisi.')
    : tab === 'proc' && bahan.length > 1 && !cond ? 'Pilih bahan / jenis.'
    : onSurface && !pads.length ? 'Pilih permukaan.' : tab === 'span' && !spanTo ? 'Pilih gigi akhir rentang.'
    : status === 'klinik_lain' && (!ext.clinic.trim() || !ext.date.trim()) ? 'Isi nama klinik lain dan perkiraan tanggal.'
    : needStage ? 'Pilih tahap yang dikerjakan hari ini.' : ''

  const choose = (k: string) => {
    setPick(null)
    setDup(null)
    setVariantFor({})
    setError('')
    if (tab === 'tooth') {
      const next = conds.includes(k) ? conds.filter((x) => x !== k) : [...conds, k]
      setConds(next)
      if (next.length === 1) setStatus(defaultStatus(conditionByKey(next[0])))
    } else {
      setCond(k)
      setStatus(defaultStatus(conditionByKey(k)))
    }
  }
  const pickProc = (r: CatalogRow) => { setDup(null); setProc(r); setCond(null); setServerBahan([]); setVariantFor({}); setError(''); setStatus('selesai') }
  const switchTab = (t: Tab) => { setDup(null); setTab(t); setCond(null); setConds([]); setPick(null); setProc(null); setServerBahan([]); setQ(''); setError('') }
  const spanEndsHere = useMemo(() => spanEnds(tooth), [tooth])

  async function save(chosenCodes = codeFor, confirmKey?: string) {
    setBusy(true)
    setError('')
    setDup(null)
    const saved: string[] = []
    try {
      for (const k of chosen) {
        const external = status === 'klinik_lain' ? { external_clinic_name: ext.clinic.trim(), external_date: ext.date.trim() } : {}
        const what = tab === 'proc' ? { procedure_code: k, ...(cond ? { condition: cond } : {}) }
          : { condition: k, ...(chosenCodes[k] ? { procedure_code: chosenCodes[k] } : {}) }
        const base = { tooth, status, ...what, ...(status === 'selesai' && variantFor[k] ? { variant: variantFor[k] } : {}), ...external,
          ...(k === confirmKey ? { confirm_duplicate: true } : {}) }
        try {
          await saveToothEntry(visitId, onSurface ? { ...base, surfaces: pads }
            : tab === 'span' ? { ...base, span_to: spanTo!, span_roles: roles, material: material || null } : base)
          saved.push(k)
        } catch (e) {
          if (e instanceof ApiError && e.status === 422 && e.data?.error === 'pick_code') { // several clinic codes record this condition
            setPick({ condition: k, list: e.data.candidates ?? [] })
            setConds((cs) => cs.filter((x) => !saved.includes(x)))
            return
          }
          if (e instanceof ApiError && e.status === 422 && e.data?.error === 'pick_condition') { // catalog changed since it loaded
            setServerBahan(e.data.candidates ?? [])
            return
          }
          if (e instanceof ApiError && e.status === 409 && e.data?.error === 'duplicate_procedure') {
            setDup({ key: k, message: e.data.message })
            setConds((cs) => cs.filter((x) => !saved.includes(x)))
            return
          }
          throw e
        }
      }
      onSaved(`Gigi ${where} ${codes} tersimpan${status === 'selesai' ? ' (masuk tagihan saat Selesai)' : ''}.`)
      setCond(null); setConds([]); setPick(null); setCodeFor({}); setVariantFor({}); setProc(null); setServerBahan([])
    } catch (e) {
      setError(e instanceof ApiError && e.status === 422 ? e.data?.message ?? 'Data tidak valid.' : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const padsEl = (
    <div className="tsheet-pads" role="group" aria-label="Permukaan">
      {padsFor(tooth).map((s) => (
        <button key={s.key} type="button" aria-pressed={pads.includes(s.key)} title={s.label}
          onClick={() => setPads(pads.includes(s.key) ? pads.filter((x) => x !== s.key) : [...pads, s.key])}>
          <strong>{padLabel(tooth, s.key)}</strong><span className="small">{s.label.split(' ')[0].toLowerCase()}</span>
        </button>
      ))}
    </div>
  )

  return (
    <section className="tsheet" aria-label={`Isi gigi ${tooth}`}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}><SymbolDefs /></svg>
      <div className="tsheet-tabs" role="tablist" aria-label="Cara isi">
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => switchTab(k)}>{label}</button>)}
      </div>

      {tab === 'proc' && <>
        {procs.length > 8 || q ? <input type="search" className="tsheet-search" placeholder="Cari tindakan atau kode" aria-label="Cari tindakan" value={q}
          onChange={(e) => setQ(e.target.value)} /> : null}
        <div className="tsheet-list" role="radiogroup" aria-label="Tindakan">
          {procs.map((r) => (
            <button key={r.procedure_code} type="button" role="radio" aria-checked={proc?.procedure_code === r.procedure_code} onClick={() => pickProc(r)}>
              <span className="grow">{r.name}</span><code>{r.procedure_code}</code>
            </button>
          ))}
          {!procs.length && <p className="muted small">{q ? 'Tidak ada tindakan yang cocok.' : 'Belum ada tindakan di katalog klinik.'}</p>}
        </div>
        {proc && bahan.length > 1 && (
          <div className="tsheet-pick" role="radiogroup" aria-label="Bahan / jenis">
            <p className="small">Bahan / jenis:</p>
            {bahan.map((k) => <button key={k} type="button" role="radio" aria-checked={cond === k} onClick={() => setCond(k)}>{conditionByKey(k)?.label ?? k}</button>)}
          </div>
        )}
        {proc?.treat_area === 'surface' && padsEl}
      </>}

      {tab === 'surface' && <>
        {padsEl}
        <div className="tsheet-cards" role="radiogroup" aria-label="Kondisi">
          {shownSurface.map((c) => <CondCard key={c.key} c={c} on={cond === c.key} onPick={() => choose(c.key)} />)}
        </div>
        {!more && <button type="button" className="btn btn-ghost" onClick={() => setMore(true)}>{surfaceConds.length - shownSurface.length} lainnya</button>}
      </>}

      {tab === 'tooth' && <>
        <input type="search" className="tsheet-search" placeholder="Cari kondisi atau kode" aria-label="Cari kondisi" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tsheet-list" role="group" aria-label="Kondisi seluruh gigi (boleh lebih dari satu)">
          {toothConds.map((c) => (
            <button key={c.key} type="button" aria-pressed={conds.includes(c.key)} onClick={() => choose(c.key)}>
              <SymbolIcon symbol={c.symbol} code={c.code} /><span className="grow">{c.label}</span><code>{c.code ?? 'panah'}</code>
            </button>
          ))}
        </div>
      </>}

      {tab === 'span' && <>
        <div className="tsheet-cards" role="radiogroup" aria-label="Jenis rentang">
          {conditionsIn('span').map((c) => <CondCard key={c.key} c={c} on={cond === c.key} onPick={() => choose(c.key)} />)}
        </div>
        <label>Gigi akhir rentang
          <select value={spanTo ?? ''} onChange={(e) => { const to = Number(e.target.value) || null; setSpanTo(to); setRoles(to ? defaultRoles(spanTeeth(tooth, to)) : {}) }}>
            <option value="">Pilih gigi</option>{spanEndsHere.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></label>
        {span.length > 0 && (
          <div className="tsheet-roles" role="group" aria-label="Peran per gigi, ketuk untuk ganti">
            {span.map((t) => (
              <button key={t} type="button" onClick={() => setRoles({ ...roles, [t]: roles[t] === 'pontic' ? 'abutment' : 'pontic' })}>
                <strong>{t}</strong><span className="small">{TAXONOMY.span_roles.find((r) => r.key === roles[t])?.code}</span>
              </button>
            ))}
          </div>
        )}
        {cond && ['prd', 'fld'].includes(conditionByKey(cond)?.code ?? '') && (
          <label>Bahan (opsional)<select value={material} onChange={(e) => setMaterial(e.target.value as Material | '')}>
            <option value="">—</option>{TAXONOMY.span_materials.map((m) => <option key={m.key} value={m.key}>{m.label} ({m.key})</option>)}</select></label>
        )}
      </>}

      <div className="tsheet-status" role="radiogroup" aria-label="Status">
        {TAXONOMY.statuses.map((s) => <button key={s.key} type="button" role="radio" aria-checked={status === s.key} title={s.label}
          onClick={() => setStatus(s.key)}>{STATUS_SHORT[s.key]}</button>)}
      </div>
      {status === 'selesai' && <p className="muted small">Selesai = dikerjakan hari ini; masuk tagihan saat kunjungan Selesai.</p>}
      {status === 'klinik_lain' && (
        <div className="tsheet-ext">
          <label>Nama klinik lain<input maxLength={120} value={ext.clinic} onChange={(e) => setExt({ ...ext, clinic: e.target.value })} /></label>
          <label>Perkiraan tanggal<input placeholder="2025 / 06/2025 / 12/06/2025" maxLength={10} value={ext.date} onChange={(e) => setExt({ ...ext, date: e.target.value })} /></label>
        </div>
      )}

      {pick && (
        <div className="tsheet-pick" role="radiogroup" aria-label={`Tindakan untuk ${conditionByKey(pick.condition)?.label}`}>
          <p className="small">Lebih dari satu tindakan klinik mencatat {conditionByKey(pick.condition)?.code}. Pilih yang dikerjakan:</p>
          {pick.list.map((x) => (
            <button key={x.procedure_code} type="button" role="radio" aria-checked={codeFor[pick.condition] === x.procedure_code}
              onClick={() => { const next = { ...codeFor, [pick.condition]: x.procedure_code }; setCodeFor(next)
                if (stagesOf(pick.condition, next).length > 1 && !variantFor[pick.condition]) setPick(null); else save(next) }}>
              {x.name} <code>{x.procedure_code}</code>
            </button>
          ))}
        </div>
      )}
      {chosen.filter((k) => stagesOf(k).length > 1).map((k) => (
        <div key={k} className="tsheet-pick" role="radiogroup" aria-label={`Tahap ${nameOf(k)}`}>
          <p className="small">Tahap {nameOf(k)} hari ini:</p>
          {stagesOf(k).map((s) => <button key={s.variant} type="button" role="radio" aria-checked={variantFor[k] === s.variant}
            onClick={() => setVariantFor({ ...variantFor, [k]: s.variant })}>{s.label}</button>)}
        </div>
      ))}
      {dup && (
        <div className="notice notice-warn" role="alertdialog" aria-labelledby="tsheet-dup">
          <p id="tsheet-dup">{dup.message}</p>
          <div className="dialog-actions">
            <button type="button" className="btn" autoFocus onClick={() => setDup(null)}>Batal</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(codeFor, dup.key)}>Tambah lagi</button>
          </div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {missing && !pick && <p className="muted small" id="tsheet-why">{missing}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={busy || !!missing || !!pick || !!dup} aria-describedby={missing ? 'tsheet-why' : undefined}
        onClick={() => save()}>{busy ? 'Menyimpan…' : `Simpan ${where}${codes ? ' ' + codes : ''}`}</button>
    </section>
  )
}

function CondCard({ c, on, onPick }: { c: Condition; on: boolean; onPick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} className="tsheet-card" onClick={onPick}>
      <SymbolIcon symbol={c.symbol} code={c.code} /><span className="grow">{c.label}</span><code>{c.code}</code>
    </button>
  )
}
