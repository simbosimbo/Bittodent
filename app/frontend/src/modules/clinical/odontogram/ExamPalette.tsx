import { useState } from 'react'
import { Button } from '@heroui/react'
import { ApiError, errorText } from '../../../shared/api/http'
import { saveToothEntries } from '../api'
import type { Mark } from '../Odontogram'
import { SymbolDefs, SymbolIcon } from './symbols'
import { conditionByKey, padLabel, padsFor, storedSurface, TAXONOMY, type EntryStatus, type SurfaceKey, type ToothEntry } from './taxonomy'
import { Note } from '../../../shared/ui/Note'

// Board OVv2-06 Pemeriksaan awal (PDGI: every tooth examined and written at the first visit). Pick a tool once, tap many teeth,
// "Tandai sisa sou", ONE Simpan. Whole-tooth tool: tap = record, tap again = remove. Surface tool: tap opens a small MODVL pad.
// Status Ada sebelumnya / Rencana only: an exam records the mouth, it never bills (Selesai lives in Perawatan).
const STRIP = ['sehat', 'hilang', 'sisa_akar', 'karies', 'tambalan_amalgam', 'tambalan_komposit', 'mahkota_logam', 'mahkota_porselen']
type Entry = { tooth: number; condition: string; surfaces: SurfaceKey[] }
export type Exam = ReturnType<typeof useExam>

export function useExam() {
  const [tool, setTool] = useState('hilang')
  const [status, setStatus] = useState<Extract<EntryStatus, 'ada_sebelumnya' | 'rencana'>>('ada_sebelumnya')
  const [entries, setEntries] = useState<Entry[]>([])
  const [padTooth, setPadTooth] = useState<number | null>(null)
  const surface = conditionByKey(tool)?.group === 'surface'
  const at = (t: number) => entries.find((e) => e.tooth === t && e.condition === tool)
  function tap(t: number) {
    if (surface) { setPadTooth(t); return } // the next tooth closes the previous pad
    setPadTooth(null)
    const same = at(t)
    setEntries(same ? entries.filter((e) => e !== same) : [...entries.filter((e) => e.tooth !== t || conditionByKey(e.condition)?.group === 'surface'), { tooth: t, condition: tool, surfaces: [] }])
  }
  function toggleSurface(t: number, s: SurfaceKey) {
    const e = at(t)
    const next = e ? { ...e, surfaces: e.surfaces.includes(s) ? e.surfaces.filter((x) => x !== s) : [...e.surfaces, s] } : { tooth: t, condition: tool, surfaces: [s] }
    setEntries([...entries.filter((x) => x !== e), ...(next.surfaces.length ? [next] : [])])
  }
  const teeth = new Set(entries.map((e) => e.tooth))
  /** Mark the remaining (empty) teeth sou: "gigi sehat ditulis sou, jangan dikosongkan". */
  const markRest = (empty: number[]) => setEntries([...entries, ...empty.filter((t) => !teeth.has(t)).map((t) => ({ tooth: t, condition: 'sehat', surfaces: [] }))])
  const toEntries = (): ToothEntry[] => entries.map((e) => ({ tooth: e.tooth, condition: e.condition, status, ...(e.surfaces.length ? { surfaces: e.surfaces } : {}) }))
  /** Unsaved entries drawn on the chart as drafts (the mark the dentist will save). */
  const preview: Record<string, Mark> = {}
  for (const e of entries) {
    const c = conditionByKey(e.condition)!
    const mark: Mark = { condition: c.key, symbol: c.symbol, code: c.code, label: `${c.label} (${c.code ?? '-'})`, entry: status, state: 'draft', source: 'manual' }
    for (const k of e.surfaces.length ? e.surfaces.map((s) => `t${e.tooth}-${storedSurface(s)}`) : [`t${e.tooth}`]) preview[k] = mark
  }
  return { tool, setTool, status, setStatus, entries, setEntries, padTooth, setPadTooth, tap, toggleSurface, teeth, markRest, toEntries, preview }
}

export function ExamPalette({ exam, visitId, emptyTeeth, onSaved }: { exam: Exam; visitId: string; emptyTeeth: number[]; onSaved: (msg: string) => void }) {
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const rest = emptyTeeth.filter((t) => !exam.teeth.has(t))
  const c = conditionByKey(exam.tool)
  async function save() {
    setBusy(true)
    setError('')
    try {
      const r = await saveToothEntries(visitId, exam.toEntries())
      exam.setEntries([])
      exam.setPadTooth(null)
      onSaved(`Pemeriksaan awal tersimpan: ${r.created} isian. Paraf dan tanggal saat kunjungan Selesai.`)
    } catch (e) {
      setError(e instanceof ApiError && e.status === 422 ? e.data?.message ?? 'Data tidak valid.' : errorText(e))
    } finally { setBusy(false) }
  }
  const tools = all ? TAXONOMY.conditions.filter((x) => x.group !== 'span') : STRIP.map((k) => conditionByKey(k)!)
  return (
    <section className="exam" aria-label="Pemeriksaan awal">
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}><SymbolDefs /></svg>
      <p className="muted small">Pilih alat sekali, lalu ketuk gigi. Ketuk lagi = hapus.</p>
      <p className="exam-tool"><strong>Alat: {c?.label}</strong> <code>{c?.code ?? 'panah'}</code></p>
      <div className="exam-strip" role="radiogroup" aria-label="Alat">
        {tools.map((x) => (
          <button key={x.key} type="button" role="radio" aria-checked={exam.tool === x.key} title={x.label} aria-label={`${x.label} (${x.code ?? 'panah'})`}
            onClick={() => { exam.setTool(x.key); exam.setPadTooth(null) }}><SymbolIcon symbol={x.symbol} code={x.code} /><code>{x.code ?? '→'}</code></button>
        ))}
        <button type="button" aria-pressed={all} onClick={() => setAll(!all)}>{all ? 'Tersering' : 'Semua'}</button>
      </div>
      <div className="tsheet-status" role="radiogroup" aria-label="Status">
        {(['ada_sebelumnya', 'rencana'] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={exam.status === s}
          onClick={() => exam.setStatus(s)}>{s === 'rencana' ? 'Rencana' : 'Ada'}</button>)}
      </div>
      {exam.padTooth !== null && c?.group === 'surface' && (
        <div className="tsheet-pads" role="group" aria-label={`Permukaan gigi ${exam.padTooth}`}>
          {padsFor(exam.padTooth).map((s) => {
            const on = !!exam.entries.find((e) => e.tooth === exam.padTooth && e.condition === exam.tool)?.surfaces.includes(s.key)
            return <button key={s.key} type="button" aria-pressed={on} onClick={() => exam.toggleSurface(exam.padTooth!, s.key)}>
              <strong>{padLabel(exam.padTooth!, s.key)}</strong><span className="small">{s.label.split(' ')[0].toLowerCase()}</span></button>
          })}
        </div>
      )}
      {error && <Note status="danger" role="alert">{error}</Note>}
      <div className="exam-dock">
        {emptyTeeth.length || exam.teeth.size ? <Button variant="outline" isDisabled={!rest.length} onPress={() => exam.markRest(emptyTeeth)}>Tandai sisa sou ({rest.length})</Button>
          : <span className="muted small">Campuran: tandai sou per gigi (tidak semua gigi tetap dan sulung ada).</span>}
        <Button isDisabled={busy || !exam.entries.length} onPress={save}>
          {busy ? 'Menyimpan…' : `Simpan ${exam.teeth.size} gigi`}</Button>
      </div>
    </section>
  )
}
