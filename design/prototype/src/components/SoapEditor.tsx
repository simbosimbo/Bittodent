import { useState } from 'react'
import type { SoapBlock, SoapVersion } from '../data/types'
import { Icon } from './Icon'
import { DraftAiBadge, LockedBadge, Textarea } from './ui'

const TITLES = { S: 'S — Subjektif', O: 'O — Objektif', A: 'A — Asesmen', P: 'P — Rencana' } as const
const KEYS = ['S', 'O', 'A', 'P'] as const

// Blok AI selalu bergaya draf (latar kuning, garis putus, lencana) sampai ditandatangani. Tidak pernah tampil final.

function sourceLine(b: SoapBlock, locked: boolean, version: SoapVersion) {
  if (locked) {
    if (b.ai) {
      const who = version.signer ?? 'dokter'
      const when = version.signedAt ?? ''
      return <small className="muted">Disusun dari dikte (bantuan AI) · disetujui {who}{when ? `, ${when}` : ''}</small>
    }
    return b.author ? <small className="muted">Sumber: {b.author}</small> : null
  }
  if (b.ai) return <small className="muted">{b.author || 'Draf AI dari dikte drg. Budi Santoso'}</small>
  return b.author ? <small className="muted">Sumber: {b.author}</small> : null
}

export function SoapEditor({ version, onEdit, readOnly }: { version: SoapVersion; onEdit?: (k: (typeof KEYS)[number], t: string) => void; readOnly?: boolean }) {
  const locked = version.state === 'signed'
  return (
    <div className="soap">
      {KEYS.map((k) => {
        const b = version.blocks[k]
        const ai = b.ai && !locked
        return (
          <section key={k} className={`soap-block ${ai ? 'is-ai' : ''} ${locked ? 'is-locked' : ''}`} data-state={locked ? 'signed' : 'draft'}>
            <header>
              <h4>{TITLES[k]}</h4>
              {ai && <DraftAiBadge />}
              {locked && <LockedBadge />}
              {sourceLine(b, locked, version)}
            </header>
            {locked || readOnly
              ? <p className="soap-text">{b.text || <em className="muted">Kosong</em>}</p>
              : <Textarea rows={3} value={b.text} aria-label={TITLES[k]} placeholder="Tulis catatan…" onChange={(e) => onEdit?.(k, e.target.value)} />}
          </section>
        )
      })}
    </div>
  )
}

export function SoapHistory({ versions }: { versions: SoapVersion[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <ul className="history">
      {[...versions].reverse().map((v) => {
        const replaced = versions.find((x) => x.supersedes === v.v)
        return (
          <li key={v.v}>
            <button className="history-row" onClick={() => setOpen(open === v.v ? null : v.v)} aria-expanded={open === v.v}>
              <strong>Versi {v.v}</strong>
              {v.state === 'signed' ? <span className="badge badge-locked"><Icon name="lock" size={14} />Terkunci</span> : <span className="badge badge-draft">Draf</span>}
              {replaced && <span className="badge badge-neutral">Digantikan oleh versi {replaced.v}</span>}
              <small className="muted">{v.signedAt ? `${v.signer} · ${v.signedAt}` : 'Belum ditandatangani'}</small>
            </button>
            {v.reason && <p className="history-reason">Alasan versi baru: {v.reason}</p>}
            {open === v.v && <div className="history-body"><SoapEditor version={v} readOnly /></div>}
          </li>
        )
      })}
    </ul>
  )
}
