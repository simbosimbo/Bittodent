import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { fmtYmdShort, num, rp, todayWib } from '../../shared/format'
import type { Me } from '../../shared/session'
import { DateField } from '../../shared/ui/DateField'
import { addAccount, bulkTariffs, getAccounts, getProfile, getTariffs, saveBranch, saveCategory, saveLevels, saveProfile, updateAccount,
  type Account, type AccountKind, type BulkRow, type ClinicProfile, type TariffItem } from './api'
import './settings.css'

// Pengaturan Klinik (DEVIATIONS #71). Each tab follows its own permission (owner only today: settings.manage / tariff.manage /
// billing.accounts in Permissions::MATRIX); the server checks every write, scopes it to the clinic and audits it.
const TABS = [
  { key: '', label: 'Profil', perm: 'settings.manage' },
  { key: 'harga', label: 'Harga', perm: 'tariff.manage' },
  { key: 'pembayaran', label: 'Pembayaran', perm: 'billing.accounts' },
] as const
export const SETTINGS_PERMS = TABS.map((t) => t.perm).join('|')
const msgOf = (e: unknown) => e instanceof ApiError && [409, 422].includes(e.status) ? e.data?.message ?? 'Data tidak valid.' : errorText(e)

export default function ClinicSettingsPage({ me, tab, onChanged }: { me: Me; tab: string; onChanged: () => void }) {
  const tabs = TABS.filter((t) => me.permissions.includes(t.perm))
  const cur = tabs.find((t) => t.key === tab) ?? tabs[0]
  if (!cur) return null
  return (
    <>
      <div className="page-head"><h1>Pengaturan Klinik</h1></div>
      <nav className="tabs set-tabs" aria-label="Pengaturan Klinik">
        {tabs.map((t) => <a key={t.key} href={`#/pengaturan-klinik${t.key ? '/' + t.key : ''}`} className={t === cur ? 'on' : undefined}
          aria-current={t === cur ? 'page' : undefined}>{t.label}</a>)}
      </nav>
      {cur.key === '' && <ProfileTab onChanged={onChanged} />}
      {cur.key === 'harga' && <PriceTab />}
      {cur.key === 'pembayaran' && <PaymentTab me={me} />}
    </>
  )
}

const FIELDS: [keyof Omit<ClinicProfile, 'branches'>, string, string][] = [
  ['name', 'Nama klinik', 'text'], ['address', 'Alamat', 'text'], ['phone', 'Telepon', 'tel'], ['email', 'Email', 'email'],
  ['license_no', 'Nomor izin klinik', 'text'], ['license_valid_until', 'Izin berlaku sampai', 'date'],
]

function ProfileTab({ onChanged }: { onChanged: () => void }) {
  const [p, setP] = useState<ClinicProfile | null>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { getProfile().then(setP, (e) => setError(errorText(e))) }, [])
  if (!p) return error ? <p className="form-error" role="alert">{error}</p> : <p className="muted">Memuat…</p>
  const set = (k: string, v: string) => setP({ ...p, [k]: v })
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!p) return
    setBusy(true); setMsg(''); setError('')
    try {
      const { branches, ...body } = p
      const out = await saveProfile(Object.fromEntries(Object.entries(body).filter(([k]) => FIELDS.some(([f]) => f === k))))
      await Promise.all(branches.map((b) => saveBranch(b.id, { address: b.address || null, phone: b.phone || null })))
      setP({ ...out, branches })
      setMsg('Profil klinik tersimpan.')
      onChanged() // header address comes from /api/me
    } catch (err) { setError(msgOf(err)) }
    setBusy(false)
  }
  return (
    <form className="card set-form" onSubmit={save} noValidate>
      {FIELDS.map(([k, label, type]) => (
        <label key={k}>{label}{type === 'date' ? <DateField value={(p[k] as string | null) ?? ''} onChange={(e) => set(k, e.target.value)} />
          : <input type={type} value={(p[k] as string | null) ?? ''} required={k === 'name'} inputMode={k === 'phone' ? 'tel' : undefined}
            onChange={(e) => set(k, e.target.value)} />}</label>
      ))}
      {p.branches.length > 0 && <h2 className="set-sub">Cabang</h2>}
      {p.branches.map((b, i) => (
        <fieldset key={b.id} className="set-branch">
          <legend>{b.name}</legend>
          <label>Alamat cabang<input value={b.address ?? ''} placeholder={p.address ?? 'Sama dengan alamat klinik'}
            onChange={(e) => setP({ ...p, branches: p.branches.map((x, j) => j === i ? { ...x, address: e.target.value } : x) })} /></label>
          <label>Telepon cabang<input type="tel" inputMode="tel" value={b.phone ?? ''}
            onChange={(e) => setP({ ...p, branches: p.branches.map((x, j) => j === i ? { ...x, phone: e.target.value } : x) })} /></label>
        </fieldset>
      ))}
      {error && <p className="form-error" role="alert">{error}</p>}
      {msg && <p className="notice" role="status">{msg}</p>}
      <div className="set-dock"><button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan profil'}</button></div>
    </form>
  )
}

const digits = (v: string) => Number(v.replace(/\D/g, '').slice(0, 10) || '0')
const ROUNDING: [string, string][] = [['nearest_1000', 'Bulatkan ke 1.000'], ['nearest_500', 'Bulatkan ke 500'], ['nearest_100', 'Bulatkan ke 100'],
  ['ceil_1000', 'Naik ke 1.000'], ['floor_1000', 'Turun ke 1.000'], ['none', 'Tanpa pembulatan']]

function PriceTab() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [data, setData] = useState<{ items: TariffItem[]; categories: string[] } | null>(null)
  const [edits, setEdits] = useState<Record<string, Record<string, number>>>({}) // procedure_code -> variant -> new price
  const [sel, setSel] = useState<string[]>([])
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => getTariffs(q.trim(), cat).then(setData, (e) => setError(errorText(e)))
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [q, cat]) // eslint-disable-line react-hooks/exhaustive-deps
  const today = todayWib()
  const dirty = Object.keys(edits).filter((c) => Object.keys(edits[c]).length)
  const priceOf = (it: TariffItem, v: string, base: number) => edits[it.procedure_code]?.[v] ?? base
  function edit(it: TariffItem, variant: string, base: number, value: number) {
    const row = { ...(edits[it.procedure_code] ?? {}) }
    if (value === base) delete row[variant]; else row[variant] = value
    setEdits({ ...edits, [it.procedure_code]: row })
  }
  async function saveAll() {
    if (!data) return
    setBusy(true); setMsg(''); setError('')
    const failed: string[] = []
    for (const code of dirty) {
      const it = data.items.find((x) => x.procedure_code === code)!
      const base = it.next && it.next.valid_from === it.editable_from ? it.next.levels : it.levels
      try {
        await saveLevels(it.id, it.editable_from, base.map((l) => ({ code: l.variant, label: l.label, price_rp: priceOf(it, l.variant, l.price_rp) })))
      } catch (e) { failed.push(`${it.name}: ${msgOf(e)}`) }
    }
    setEdits({})
    await load()
    setBusy(false)
    if (failed.length) setError(failed.join(' '))
    else setMsg(`${dirty.length} harga tersimpan.`)
  }
  const later = (it: TariffItem) => it.editable_from > today
  return (
    <section className="set-prices" aria-label="Daftar harga">
      <div className="set-filter">
        <input type="search" aria-label="Cari tindakan" placeholder="Cari tindakan atau kode" value={q} onChange={(e) => setQ(e.target.value)} />
        {data && data.categories.length > 0 && (
          <div className="set-chips" role="group" aria-label="Kategori">
            {['', ...data.categories].map((c) => <button key={c || 'semua'} type="button" className={`set-chip${cat === c ? ' on' : ''}`}
              aria-pressed={cat === c} onClick={() => setCat(c)}>{c ? c.replace(/_/g, ' ') : 'Semua'}</button>)}
          </div>
        )}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {msg && <p className="notice" role="status">{msg}</p>}
      {sel.length > 0 && data && <BulkPanel codes={sel} items={data.items} onDone={(t) => { setSel([]); setMsg(t); load() }} onCancel={() => setSel([])} />}
      {!data ? <p className="muted">Memuat…</p> : data.items.length === 0 ? <p className="muted">Tidak ada tindakan yang cocok.</p> : (
        <ul className="set-list">
          {data.items.map((it) => {
            const levels = it.next && it.next.valid_from === it.editable_from ? it.next.levels : it.levels
            return (
              <li key={it.procedure_code} className="card set-row">
                <div className="set-row-head">
                  <label className="set-pick"><input type="checkbox" checked={sel.includes(it.procedure_code)} aria-label={`Pilih ${it.name}`}
                    onChange={(e) => setSel(e.target.checked ? [...sel, it.procedure_code] : sel.filter((c) => c !== it.procedure_code))} /></label>
                  <div className="set-row-name"><strong>{it.name}</strong>
                    <span className="muted small">{it.procedure_code}
                      {' · '}<CategoryInput item={it} categories={data.categories} onSaved={load} onError={setError} /></span></div>
                </div>
                {levels.map((l) => {
                  const cur = it.levels.find((x) => x.variant === l.variant)
                  return (
                    <label key={l.variant} className="set-price">
                      <span>{levels.length > 1 || l.label !== 'Standar' ? l.label : 'Harga'}
                        {cur && cur.price_rp !== l.price_rp && <span className="muted small"> · kini {rp(cur.price_rp)}</span>}</span>
                      <span className="set-rp"><span aria-hidden="true">Rp</span>
                        <input inputMode="numeric" aria-label={`Harga ${it.name}${levels.length > 1 ? ' ' + l.label : ''}`}
                          value={num(priceOf(it, l.variant, l.price_rp))} onChange={(e) => edit(it, l.variant, l.price_rp, digits(e.target.value))} /></span>
                    </label>
                  )
                })}
                {(later(it) || it.next) && <p className="muted small set-when">
                  {it.next ? `Harga baru berlaku ${fmtYmdShort(it.next.valid_from)}.` : ''}
                  {later(it) && edits[it.procedure_code] && Object.keys(edits[it.procedure_code]).length ? ` Perubahan berlaku ${fmtYmdShort(it.editable_from)} (hari ini sudah diubah).` : ''}
                </p>}
              </li>
            )
          })}
        </ul>
      )}
      {dirty.length > 0 && (
        <div className="set-dock set-dock-fixed">
          <button type="button" className="btn" onClick={() => setEdits({})} disabled={busy}>Batal</button>
          <button type="button" className="btn btn-primary" onClick={saveAll} disabled={busy}>{busy ? 'Menyimpan…' : `Simpan ${dirty.length} harga`}</button>
        </div>
      )}
    </section>
  )
}

function CategoryInput({ item, categories, onSaved, onError }: { item: TariffItem; categories: string[]; onSaved: () => void; onError: (m: string) => void }) {
  const [v, setV] = useState(item.category ?? '')
  useEffect(() => setV(item.category ?? ''), [item.category])
  const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30)
  async function commit() {
    const next = slug(v) || null
    if (next === item.category) return setV(item.category ?? '')
    try { await saveCategory(item.procedure_code, next); onSaved() } catch (e) { onError(msgOf(e)) }
  }
  return (
    <>
      <input className="set-cat" list="set-cats" aria-label={`Kategori ${item.name}`} placeholder="+ kategori" value={v.replace(/_/g, ' ')}
        onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      <datalist id="set-cats">{categories.map((c) => <option key={c} value={c.replace(/_/g, ' ')} />)}</datalist>
    </>
  )
}

function BulkPanel({ codes, items, onDone, onCancel }: { codes: string[]; items: TariffItem[]; onDone: (msg: string) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<'percent' | 'amount'>('percent')
  const [value, setValue] = useState('10')
  const [down, setDown] = useState(false)
  const [rounding, setRounding] = useState('nearest_1000')
  const [preview, setPreview] = useState<BulkRow[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const from = useMemo(() => items.filter((i) => codes.includes(i.procedure_code)).map((i) => i.editable_from).sort().at(-1) ?? todayWib(), [codes, items])
  const body = (dry: boolean) => ({ procedure_codes: codes, kind, value: (down ? -1 : 1) * digits(value), rounding, valid_from: from, dry_run: dry })
  async function go(dry: boolean) {
    setBusy(true); setError('')
    try {
      const r = await bulkTariffs(body(dry))
      if (dry) setPreview(r.rows); else onDone(`${r.count} harga diubah, berlaku ${fmtYmdShort(from)}.`)
    } catch (e) { setError(msgOf(e)) }
    setBusy(false)
  }
  return (
    <div className="card set-bulk" role="region" aria-label="Ubah massal">
      <p><strong>{codes.length} tindakan dipilih</strong> <span className="muted small">· berlaku {fmtYmdShort(from)}</span></p>
      <div className="set-bulk-row">
        <div className="set-seg" role="group" aria-label="Arah">
          <button type="button" aria-pressed={!down} className={!down ? 'on' : ''} onClick={() => { setDown(false); setPreview(null) }}>Naik</button>
          <button type="button" aria-pressed={down} className={down ? 'on' : ''} onClick={() => { setDown(true); setPreview(null) }}>Turun</button>
        </div>
        <input inputMode="numeric" aria-label="Besar perubahan" value={value} onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setPreview(null) }} />
        <div className="set-seg" role="group" aria-label="Satuan">
          <button type="button" aria-pressed={kind === 'percent'} className={kind === 'percent' ? 'on' : ''} onClick={() => { setKind('percent'); setPreview(null) }}>%</button>
          <button type="button" aria-pressed={kind === 'amount'} className={kind === 'amount' ? 'on' : ''} onClick={() => { setKind('amount'); setPreview(null) }}>Rp</button>
        </div>
        <select aria-label="Pembulatan" value={rounding} onChange={(e) => { setRounding(e.target.value); setPreview(null) }}>
          {ROUNDING.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {preview && <ul className="set-preview small">{preview.slice(0, 6).map((r) => (
        <li key={r.procedure_code + r.variant}>{items.find((i) => i.procedure_code === r.procedure_code)?.name ?? r.procedure_code}
          {r.variant !== 'standar' ? ` (${r.variant})` : ''}: {rp(r.old_rp)} → <strong>{rp(r.new_rp)}</strong></li>))}
        {preview.length > 6 && <li className="muted">+{preview.length - 6} harga lain</li>}</ul>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="toolbar">
        <button type="button" className="btn" onClick={onCancel}>Batal</button>
        {preview ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => go(false)}>Terapkan {preview.length} harga</button>
          : <button type="button" className="btn btn-primary" disabled={busy || !digits(value)} onClick={() => go(true)}>Pratinjau</button>}
      </div>
    </div>
  )
}

const KINDS: { key: AccountKind; label: string; hint: string }[] = [
  { key: 'tunai', label: 'Tunai', hint: 'Laci kas' }, { key: 'transfer', label: 'Transfer', hint: 'Rekening bank klinik' },
  { key: 'qris', label: 'QRIS', hint: 'Kode QR klinik' }, { key: 'edc', label: 'EDC', hint: 'Mesin kartu debit/kredit' },
]

function PaymentTab({ me }: { me: Me }) {
  const [list, setList] = useState<Account[] | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [adding, setAdding] = useState(false)
  const load = () => getAccounts().then(setList, (e) => setError(errorText(e)))
  useEffect(() => { load() }, [])
  const branchName = (id: string | null) => id === null ? 'Semua cabang' : me.branches.find((b) => b.id === id)?.name ?? 'Cabang'
  async function toggle(a: Account) {
    setError(''); setMsg('')
    try { await updateAccount(a.id, { is_active: !a.is_active }); setMsg(`${a.name} ${a.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`); load() } catch (e) { setError(msgOf(e)) }
  }
  return (
    <section aria-label="Metode pembayaran">
      <p className="muted small">Pembayaran hanya masuk ke akun milik klinik. Nomor rekening tidak disimpan, hanya 4 angka terakhir.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {msg && <p className="notice" role="status">{msg}</p>}
      {!list ? <p className="muted">Memuat…</p> : (
        <ul className="set-list">
          {KINDS.map((k) => {
            const rows = list.filter((a) => a.kind === k.key)
            return (
              <li key={k.key} className="card set-acc-group">
                <h2 className="set-sub">{k.label}</h2>
                {rows.length === 0 && <p className="muted small">Belum ada. {k.hint}.</p>}
                {rows.map((a) => (
                  <div key={a.id} className={`set-acc${a.is_active ? '' : ' is-off'}`}>
                    <div><strong>{a.name}</strong>
                      <span className="muted small">{[a.bank_name, a.account_last4 && `•••• ${a.account_last4}`, branchName(a.branch_id), !a.is_active && 'Nonaktif'].filter(Boolean).join(' · ')}</span></div>
                    <button type="button" className="btn btn-ghost" onClick={() => toggle(a)}>{a.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  </div>
                ))}
              </li>
            )
          })}
        </ul>
      )}
      {adding ? <AddAccount me={me} onDone={(a) => { setAdding(false); setMsg(`${a.name} ditambahkan.`); load() }} onCancel={() => setAdding(false)} />
        : <div className="set-dock"><button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>Tambah metode</button></div>}
    </section>
  )
}

function AddAccount({ me, onDone, onCancel }: { me: Me; onDone: (a: Account) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<AccountKind>('transfer')
  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  const [last4, setLast4] = useState('')
  const [branch, setBranch] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const needsBank = kind === 'transfer' || kind === 'edc'
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const auto = kind === 'tunai' ? 'Kas tunai' : kind === 'qris' ? 'QRIS klinik' : `${kind === 'edc' ? 'EDC' : 'Transfer'} ${bank.trim()}`.trim()
      onDone(await addAccount({ name: name.trim() || auto, kind, branch_id: branch || null,
        ...(needsBank && bank.trim() ? { bank_name: bank.trim() } : {}), ...(kind === 'transfer' && last4 ? { account_last4: last4 } : {}) }))
    } catch (err) { setError(msgOf(err)) }
    setBusy(false)
  }
  return (
    <form className="card set-form" onSubmit={submit} noValidate aria-label="Tambah metode pembayaran">
      <div className="set-seg set-kinds" role="radiogroup" aria-label="Jenis">
        {KINDS.map((k) => <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className={kind === k.key ? 'on' : ''}
          onClick={() => setKind(k.key)}>{k.label}</button>)}
      </div>
      {needsBank && <label>Bank<input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="mis. BCA" /></label>}
      {kind === 'transfer' && <label>4 angka terakhir rekening<input inputMode="numeric" maxLength={4} value={last4}
        onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>}
      <label>Nama (opsional)<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama yang tampil di kasir" /></label>
      {me.branches.length > 1 && <label>Cabang<select value={branch} onChange={(e) => setBranch(e.target.value)}>
        <option value="">Semua cabang</option>{me.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="toolbar">
        <button type="button" className="btn" onClick={onCancel}>Batal</button>
        <button className="btn btn-primary" disabled={busy || (kind === 'transfer' && (!bank.trim() || last4.length !== 4))}>Simpan</button>
      </div>
    </form>
  )
}
