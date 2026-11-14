import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AI_DICTATION_SOURCE, AI_SOAP, APPTS, BLOCKS, BRANCHES, CATALOG, CHARTS, LEDGER, PATIENTS, PROCS, SOAPS, STAFF, TODAY } from '../data/mock'
import type { Appt, ApptStatus, Branch, BranchId, ChartVisit, CondKey, LedgerRow, Patient, PayMethod, Proc, ProcStatus, SoapVersion, Surface } from '../data/types'
import { legendOf } from '../data/legend'
import { dateLabel, nowLabel, uid } from '../lib/format'

export interface AppState {
  patients: Patient[]; activeId: string | null; recent: string[]
  branchId: BranchId; branches: Branch[]; simple: boolean; offline: boolean; autoFlow: boolean
  appts: Appt[]; procs: Proc[]; ledger: LedgerRow[]
  charts: Record<string, ChartVisit[]>; soaps: Record<string, SoapVersion[]>
  flow: { active: boolean; patientId: string | null }
  selectorOpen: boolean; toast: string | null; toastAction: string | null; lastAddedProc: string | null
}
const initial: AppState = {
  patients: PATIENTS, activeId: 'p123', recent: ['p123', 'p089', 'p156'],
  branchId: 'menteng', branches: structuredClone(BRANCHES), simple: false, offline: false, autoFlow: true,
  appts: APPTS, procs: PROCS, ledger: LEDGER, charts: CHARTS, soaps: SOAPS,
  flow: { active: false, patientId: null }, selectorOpen: false, toast: null, toastAction: null, lastAddedProc: null,
}

// ---- selektor (dipakai layar & komponen) ----
const todayDraft = (prev?: ChartVisit): ChartVisit => ({
  id: 'cv-today', date: TODAY, label: `${dateLabel(TODAY)} (hari ini)`, state: 'draft',
  marks: prev ? Object.fromEntries(Object.entries(prev.marks).map(([k, m]) => [k, { ...m, state: 'signed' as const, ai: false }])) : {},
})
export const visitsOf = (s: AppState, pid: string): ChartVisit[] => {
  const v = s.charts[pid] ?? []
  const last = v[v.length - 1]
  return !last || last.date < TODAY ? [...v, todayDraft(last)] : v
}
export const soapOf = (s: AppState, pid: string): SoapVersion[] =>
  s.soaps[pid] ?? [{ v: 1, state: 'draft', blocks: { S: { text: '', ai: false, author: '' }, O: { text: '', ai: false, author: '' }, A: { text: '', ai: false, author: '' }, P: { text: '', ai: false, author: '' } } }]
export const patientOf = (s: AppState, id: string | null) => s.patients.find((p) => p.id === id) ?? null
export const ledgerTotals = (rows: LedgerRow[]) => {
  const charges = rows.filter((r) => r.kind === 'tindakan').reduce((a, r) => a + r.amount, 0)
  const paid = rows.filter((r) => r.kind === 'pembayaran').reduce((a, r) => a + r.amount, 0)
  const claimPending = rows.filter((r) => r.kind === 'klaim' && r.claimStatus === 'menunggu').reduce((a, r) => a + r.amount, 0)
  const claimPaid = rows.filter((r) => r.kind === 'klaim' && r.claimStatus === 'dibayar').reduce((a, r) => a + r.amount, 0)
  return { charges, paid, claimPending, claimPaid, patientDue: Math.max(0, charges - paid - claimPending - claimPaid) }
}
export const flowSteps = (s: AppState, pid: string | null) => {
  const p = patientOf(s, pid)
  const visits = pid ? visitsOf(s, pid) : []
  const cur = visits[visits.length - 1]
  const soap = pid ? soapOf(s, pid) : []
  return [
    { key: 'registrasi', label: 'Registrasi', module: 'Keluarga/Profil', path: '/keluarga/baru', done: !!p?.consentPdp },
    { key: 'jadwal', label: 'Jadwal kursi', module: 'Jadwal', path: '/jadwal', done: s.appts.some((a) => a.patientId === pid && a.where === 'grid' && a.status !== 'batal') },
    { key: 'periksa', label: 'Pemeriksaan + odontogram', module: 'Charting', path: '/charting', done: !!cur && (Object.values(cur.marks).some((m) => m.state === 'draft') || cur.state === 'signed' || s.procs.some((x) => x.patientId === pid && x.date === TODAY && x.inPlan)) },
    { key: 'soap', label: 'Tanda tangan SOAP', module: 'Charting', path: '/charting/soap', done: soap[soap.length - 1]?.state === 'signed' },
    { key: 'bayar', label: 'Bayar', module: 'Tagihan', path: '/tagihan', done: s.ledger.some((r) => r.patientId === pid && r.kind === 'pembayaran' && r.date === TODAY) },
  ]
}

const overlaps = (s: AppState, a: { id?: string; branchId: BranchId; chairId: string; start: number; dur: number }) =>
  s.appts.some((x) => x.id !== a.id && x.where === 'grid' && x.status !== 'batal' && x.branchId === a.branchId && x.chairId === a.chairId && x.start! < a.start + a.dur && a.start < x.start! + x.dur) ||
  BLOCKS.some((b) => b.branchId === a.branchId && (b.chairId === 'all' || b.chairId === a.chairId) && b.start < a.start + a.dur && a.start < b.start + b.dur)

function makeActions(set: (fn: (d: AppState) => void) => void, get: () => AppState) {
  let undoFn: (() => void) | null = null
  const toast = (msg: string, action?: { label: string; run: () => void }) => {
    undoFn = action?.run ?? null
    set((d) => { d.toast = msg; d.toastAction = action?.label ?? null })
    setTimeout(() => set((d) => { if (d.toast === msg) { d.toast = null; d.toastAction = null; undoFn = null } }), 5000)
  }
  const ensureVisit = (d: AppState, pid: string) => { d.charts[pid] = visitsOf(d, pid); return d.charts[pid][d.charts[pid].length - 1] }
  return {
    toast,
    runToastAction: () => { const fn = undoFn; undoFn = null; set((d) => { d.toast = null; d.toastAction = null }); fn?.() },
    setActive: (id: string | null) => set((d) => { d.activeId = id; d.selectorOpen = false; if (id) d.recent = [id, ...d.recent.filter((r) => r !== id)].slice(0, 5) }),
    openSelector: (open: boolean) => set((d) => { d.selectorOpen = open }),
    setBranch: (b: BranchId) => set((d) => { d.branchId = b }),
    setSimple: (v: boolean) => set((d) => { d.simple = v }),
    setOffline: (v: boolean) => set((d) => { d.offline = v }),
    setAutoFlow: (v: boolean) => set((d) => { d.autoFlow = v }),
    startFlow: (pid: string | null) => set((d) => { d.flow = { active: true, patientId: pid } }),
    stopFlow: () => set((d) => { d.flow = { active: false, patientId: null } }),

    // ---- jadwal ----
    moveAppt: (id: string, where: Appt['where'], chairId?: string, start?: number) => {
      const s = get(); const a = s.appts.find((x) => x.id === id)!
      if (where === 'grid' && overlaps(s, { id, branchId: s.branchId, chairId: chairId!, start: start!, dur: a.dur })) { toast('Slot bentrok dengan janji lain atau waktu blok.'); return false }
      set((d) => { const x = d.appts.find((y) => y.id === id)!; x.where = where; x.chairId = where === 'grid' ? chairId! : null; x.start = where === 'grid' ? start! : null; x.branchId = d.branchId })
      return true
    },
    setApptStatus: (id: string, st: ApptStatus) => set((d) => { d.appts.find((y) => y.id === id)!.status = st }),
    book: (pid: string, chairId: string, start: number) => {
      const s = get()
      if (overlaps(s, { branchId: s.branchId, chairId, start, dur: 60 })) { toast('Slot bentrok dengan janji lain atau waktu blok.'); return false }
      const id = uid('a')
      set((d) => { d.appts.push({ id, patientId: pid, branchId: d.branchId, chairId, start, dur: 60, status: 'terjadwal', label: d.flow.patientId === pid ? 'Kunjungan pertama' : 'Pemeriksaan', where: 'grid' }) })
      toast('Janji dibuat untuk pasien aktif.')
      return true
    },

    // ---- pasien ----
    register: (p: Omit<Patient, 'id'>) => {
      const id = uid('p')
      set((d) => { d.patients.push({ ...p, id }); d.activeId = id; d.recent = [id, ...d.recent].slice(0, 5); if (d.flow.active) d.flow.patientId = id })
      return id
    },

    // ---- charting ----
    setMark: (pid: string, keys: string[], cond: CondKey) => {
      const visits = visitsOf(get(), pid)
      const prevMarks = structuredClone(visits[visits.length - 1]?.marks ?? {})
      set((d) => {
        const v = ensureVisit(d, pid)
        const tooth = legendOf(cond).scope === 'tooth'
        for (const k of keys) {
          const t = k.split('-')[0]
          if (tooth) { v.marks[t] = { cond, state: 'draft' }; continue }
          if (cond === 'sehat') { delete v.marks[k]; if (v.marks[t]?.state === 'draft') delete v.marks[t]; continue }
          v.marks[k] = { cond, state: 'draft' }
        }
      })
      toast(`${legendOf(cond).label} diterapkan.`, {
        label: 'Urungkan',
        run: () => set((d) => { const v = ensureVisit(d, pid); v.marks = prevMarks }),
      })
    },
    addProc: (pid: string, catalogId: string, tooth: number | undefined, surfaces: Surface[], status: ProcStatus = 'direncanakan') => {
      const c = CATALOG.find((x) => x.id === catalogId)!
      const id = uid('pr')
      const fee = c.perSurface ? c.fee + Math.max(0, surfaces.length - 1) * 150000 : c.fee
      set((d) => {
        const auto = d.autoFlow
        const billable = status === 'direncanakan' || status === 'selesai'
        d.procs.push({ id, patientId: pid, date: TODAY, tooth, surfaces, name: c.name, fee, status, inPlan: billable, billed: auto && billable })
        if (auto && billable) d.ledger.push({ id: uid('l'), patientId: pid, date: TODAY, kind: 'tindakan', desc: c.name, amount: fee, procId: id })
        d.lastAddedProc = id
      })
      toast(get().autoFlow ? `${c.name} masuk Rencana Perawatan & Tagihan.` : `${c.name} masuk Rencana Perawatan. Kirim ke tagihan dari modul Rencana.`)
      return id
    },
    sendToLedger: (procId: string) => set((d) => {
      const p = d.procs.find((x) => x.id === procId)!; if (p.billed) return
      p.billed = true; d.ledger.push({ id: uid('l'), patientId: p.patientId, date: TODAY, kind: 'tindakan', desc: p.name, amount: p.fee, procId })
    }),
    completeProc: (procId: string) => set((d) => { const p = d.procs.find((x) => x.id === procId)!; p.status = 'selesai'; p.date = TODAY }),

    // ---- tagihan ----
    pay: (pid: string, amount: number, method: PayMethod) => set((d) => { d.ledger.push({ id: uid('l'), patientId: pid, date: TODAY, kind: 'pembayaran', desc: 'Pembayaran', amount, method }) }),
    claim: (pid: string) => set((d) => {
      const p = d.patients.find((x) => x.id === pid)!; if (!p.insurance) return
      const claimed = new Set(d.ledger.flatMap((r) => r.procIds ?? []))
      const rows = d.ledger.filter((r) => r.patientId === pid && r.kind === 'tindakan' && r.procId && !claimed.has(r.procId))
      if (!rows.length) return
      const amt = Math.round(rows.reduce((a, r) => a + r.amount, 0) * p.insurance.coverPct / 100)
      d.ledger.push({ id: uid('l'), patientId: pid, date: TODAY, kind: 'klaim', desc: `Klaim ${p.insurance.insurer} (${p.insurance.coverPct}%)`, amount: amt, claimStatus: 'menunggu', procIds: rows.map((r) => r.procId!) })
    }),

    // ---- SOAP ----
    editSoap: (pid: string, key: 'S' | 'O' | 'A' | 'P', text: string) => set((d) => {
      d.soaps[pid] = soapOf(d, pid); const cur = d.soaps[pid][d.soaps[pid].length - 1]
      if (cur.state === 'signed') return
      cur.blocks[key].text = text; if (!cur.blocks[key].author) cur.blocks[key].author = STAFF.dokter
    }),
    aiDraft: (pid: string) => set((d) => {
      d.soaps[pid] = soapOf(d, pid); const cur = d.soaps[pid][d.soaps[pid].length - 1]
      for (const k of ['O', 'A', 'P'] as const) if (!cur.blocks[k].text) cur.blocks[k] = { text: AI_SOAP[k], ai: true, author: AI_DICTATION_SOURCE }
    }),
    sign: (pid: string) => set((d) => {
      d.soaps[pid] = soapOf(d, pid); const cur = d.soaps[pid][d.soaps[pid].length - 1]
      const at = nowLabel()
      Object.assign(cur, { state: 'signed', signer: STAFF.dokter, signedAt: at })
      const v = ensureVisit(d, pid)
      Object.assign(v, { state: 'signed', signer: STAFF.dokter, signedAt: at })
      for (const m of Object.values(v.marks)) { m.state = 'signed'; m.ai = false }
    }),
    newVersion: (pid: string, reason: string) => set((d) => {
      const list = soapOf(d, pid); const prev = list[list.length - 1]
      d.soaps[pid] = [...list, { v: prev.v + 1, state: 'draft', reason, supersedes: prev.v, blocks: structuredClone(prev.blocks) }]
      const visits = visitsOf(d, pid); const last = visits[visits.length - 1]
      d.charts[pid] = [...visits, { ...structuredClone(last), id: uid('cv'), state: 'draft', label: `${last.label} — koreksi`, signer: undefined, signedAt: undefined, supersedes: last.id }]
    }),

    setMarkActive: (pid: string, key: string, active: boolean) => set((d) => {
      const v = ensureVisit(d, pid)
      if (v.marks[key]) v.marks[key].active = active
    }),
    addChair: (branchId: BranchId) => set((d) => {
      const b = d.branches.find((x) => x.id === branchId)!
      const n = b.chairs.length + 1
      b.chairs.push({ id: uid('k'), name: `Kursi ${n}` })
    }),
    renameChair: (branchId: BranchId, chairId: string, name: string) => set((d) => {
      const c = d.branches.find((x) => x.id === branchId)?.chairs.find((x) => x.id === chairId)
      if (c && name.trim()) c.name = name.trim()
    }),
    removeChair: (branchId: BranchId, chairId: string) => set((d) => {
      const b = d.branches.find((x) => x.id === branchId)!
      if (b.chairs.length <= 1) return
      if (d.appts.some((a) => a.chairId === chairId && a.where === 'grid')) {
        for (const a of d.appts) if (a.chairId === chairId && a.where === 'grid') { a.where = 'papan'; a.chairId = null }
      }
      b.chairs = b.chairs.filter((c) => c.id !== chairId)
    }),
    resetSoap: (pid: string, signed: boolean) => set((d) => {
      d.soaps[pid] = structuredClone(SOAPS[pid] ?? soapOf(initial, pid))
      d.charts[pid] = structuredClone(CHARTS[pid] ?? [])
      if (signed) {
        const cur = d.soaps[pid][d.soaps[pid].length - 1]
        Object.assign(cur, { state: 'signed', signer: STAFF.dokter, signedAt: '14 Nov 2026 09:48 WIB' })
        const v = ensureVisit(d, pid); Object.assign(v, { state: 'signed', signer: STAFF.dokter, signedAt: '14 Nov 2026 09:48 WIB' })
        for (const m of Object.values(v.marks)) { m.state = 'signed'; m.ai = false }
      }
    }),
  }
}
export type Actions = ReturnType<typeof makeActions>

const Ctx = createContext<{ s: AppState; a: Actions } | null>(null)
export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState(initial)
  const ref = useMemo(() => ({ cur: initial }), [])
  ref.cur = s
  const set = useCallback((fn: (d: AppState) => void) => setS((prev) => { const d = structuredClone(prev); fn(d); ref.cur = d; return d }), [ref])
  const a = useMemo(() => makeActions(set, () => ref.cur), [set, ref])
  return <Ctx.Provider value={{ s, a }}>{children}</Ctx.Provider>
}
export const useStore = () => useContext(Ctx)!
export const useActive = () => { const { s } = useStore(); return patientOf(s, s.activeId) }
