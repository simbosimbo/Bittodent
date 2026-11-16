import { useMemo, useState } from 'react'
import { ApiError, errorText } from '../../../shared/api/http'
import { saveToothEntry } from '../api'
import { SymbolDefs, SymbolIcon } from './symbols'
import { conditionByKey, conditionsIn, defaultRoles, padLabel, padsFor, spanEnds, spanTeeth, TAXONOMY, type Condition, type EntryStatus,
  type Material, type SpanRole, type SurfaceKey } from './taxonomy'

// Boards OVv2-01..03 + AL06 ("tindakan dulu"): tooth -> Permukaan | Seluruh gigi | Rentang -> condition (official symbol + code) -> status
// (Ada / Lain / Rencana / Selesai) -> one primary "Simpan 26 O cof". A Selesai entry IS today's procedure: the server bills the clinic code
// mapped to the condition; the odontogram draws from the same row. Several mapped codes -> the dentist picks one (pick_code).
type Tab = 'surface' | 'tooth' | 'span'
const TABS: [Tab, string][] = [['surface', 'Permukaan'], ['tooth', 'Seluruh gigi'], ['span', 'Rentang']]
const STATUS_SHORT: Record<EntryStatus, string> = { ada_sebelumnya: 'Ada', klinik_lain: 'Lain', rencana: 'Rencana', selesai: 'Selesai' }
// treatments default to Selesai (done today), findings to Ada; the dentist can switch with one tap
const TREATMENT = new Set(['amf', 'cof', 'gif', 'fis', 'inl', 'onl', 'rct', 'fmc', 'poc', 'mpc', 'gmc', 'meb', 'pob', 'prd', 'fld', 'ipx'])
const defaultStatus = (c: Condition | undefined): EntryStatus => (c?.code && TREATMENT.has(c.code) ? 'selesai' : 'ada_sebelumnya')
type Pick = { condition: string; list: { procedure_code: string; name: string }[] }

export function ToothSheet({ tooth, visitId, initialSurface, onSaved }: {
  tooth: number; visitId: string; initialSurface?: SurfaceKey; onSaved: (msg: string) => void
}) {
  const [tab, setTab] = useState<Tab>('surface')
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const surfaceConds = conditionsIn('surface')
  const shownSurface = more ? surfaceConds : surfaceConds.filter((c) => c.top)
  const toothConds = [...conditionsIn('tooth'), ...conditionsIn('implant')].filter((c) => c.key !== 'sehat'
    && (!q.trim() || `${c.label} ${c.code ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())))
  const chosen = tab === 'tooth' ? conds : cond ? [cond] : []
  const codes = chosen.map((k) => conditionByKey(k)?.code ?? conditionByKey(k)?.label).join('-')
  const span = tab === 'span' && spanTo ? spanTeeth(tooth, spanTo) : []
  const where = tab === 'span' ? (spanTo ? `${Math.min(tooth, spanTo)}-${Math.max(tooth, spanTo)}` : `${tooth}`) : `${tooth}${tab === 'surface' && pads.length ? ' ' + pads.join('') : ''}`
  const missing = !chosen.length ? 'Pilih kondisi.' : tab === 'surface' && !pads.length ? 'Pilih permukaan.' : tab === 'span' && !spanTo ? 'Pilih gigi akhir rentang.'
    : status === 'klinik_lain' && (!ext.clinic.trim() || !ext.date.trim()) ? 'Isi nama klinik lain dan perkiraan tanggal.' : ''

  const choose = (k: string) => {
    setPick(null)
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
  const switchTab = (t: Tab) => { setTab(t); setCond(null); setConds([]); setPick(null); setError('') }
  const spanEndsHere = useMemo(() => spanEnds(tooth), [tooth])

  async function save(chosenCodes = codeFor) {
    setBusy(true)
    setError('')
    const saved: string[] = []
    try {
      for (const k of chosen) {
        const external = status === 'klinik_lain' ? { external_clinic_name: ext.clinic.trim(), external_date: ext.date.trim() } : {}
        const base = { tooth, condition: k, status, ...(chosenCodes[k] ? { procedure_code: chosenCodes[k] } : {}), ...external }
        try {
          await saveToothEntry(visitId, tab === 'surface' ? { ...base, surfaces: pads }
            : tab === 'span' ? { ...base, span_to: spanTo!, span_roles: roles, material: material || null } : base)
          saved.push(k)
        } catch (e) {
          if (e instanceof ApiError && e.status === 422 && e.data?.error === 'pick_code') { // several clinic codes record this condition
            setPick({ condition: k, list: e.data.candidates ?? [] })
            setConds((cs) => cs.filter((x) => !saved.includes(x)))
            return
          }
          throw e
        }
      }
      onSaved(`Gigi ${where} ${codes} tersimpan${status === 'selesai' ? ' (masuk tagihan saat Selesai)' : ''}.`)
      setCond(null); setConds([]); setPick(null); setCodeFor({})
    } catch (e) {
      setError(e instanceof ApiError && e.status === 422 ? e.data?.message ?? 'Data tidak valid.' : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="tsheet" aria-label={`Isi gigi ${tooth}`}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}><SymbolDefs /></svg>
      <div className="tsheet-tabs" role="tablist" aria-label="Cara isi">
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => switchTab(k)}>{label}</button>)}
      </div>

      {tab === 'surface' && <>
        <div className="tsheet-pads" role="group" aria-label="Permukaan">
          {padsFor(tooth).map((s) => (
            <button key={s.key} type="button" aria-pressed={pads.includes(s.key)} title={s.label}
              onClick={() => setPads(pads.includes(s.key) ? pads.filter((x) => x !== s.key) : [...pads, s.key])}>
              <strong>{padLabel(tooth, s.key)}</strong><span className="small">{s.label.split(' ')[0].toLowerCase()}</span>
            </button>
          ))}
        </div>
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
              onClick={() => { const next = { ...codeFor, [pick.condition]: x.procedure_code }; setCodeFor(next); save(next) }}>
              {x.name} <code>{x.procedure_code}</code>
            </button>
          ))}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {missing && !pick && <p className="muted small" id="tsheet-why">{missing}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={busy || !!missing || !!pick} aria-describedby={missing ? 'tsheet-why' : undefined}
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
