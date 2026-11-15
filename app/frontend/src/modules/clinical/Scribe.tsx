import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText } from '../../shared/api/http'
import { pendingScribeRejects } from './pendingScribeReject'
import { approveScribe, getScribe, uploadScribe, type ScribeItem, type ScribeSection, type ScribeStatus } from './scribeApi'
import './Scribe.css'

type Props = {
  visitId: string
  onAccept: (section: ScribeSection, text: string) => void
}


function isStatus(data: ScribeStatus | null): data is ScribeStatus {
  return !!data && typeof data.disabled === 'boolean' && Array.isArray(data.items)
}

function applyPending(data: ScribeStatus): ScribeStatus {
  const items = data.items ?? []
  const pending = new Set(pendingScribeRejects.list().map((p) => p.id))
  if (pending.size === 0) return { ...data, items }
  return { ...data, items: items.map((i) => (pending.has(i.id) ? { ...i, state: 'ditolak' as const } : i)) }
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Scribe({ visitId, onAccept }: Props) {
  const [data, setData] = useState<ScribeStatus | null>(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'idle' | 'recording' | 'processing'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [, tick] = useState(0)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const started = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await getScribe(visitId))
      setError('')
    } catch (e) {
      setError(errorText(e))
    }
  }, [visitId])

  useEffect(() => { void load() }, [load])
  useEffect(() => pendingScribeRejects.subscribe(() => tick((n) => n + 1)), [])
  useEffect(() => () => {
    timer.current && clearInterval(timer.current)
    rec.current?.state === 'recording' && rec.current.stop()
  }, [])

  const view = isStatus(data) ? applyPending(data) : null
  const pending = pendingScribeRejects.latest()

  const start = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      rec.current = mr
      started.current = Date.now()
      setElapsed(0)
      timer.current = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 250)
      mr.start()
      setPhase('recording')
    } catch {
      setError('Mikrofon tidak tersedia.')
    }
  }

  const stop = () => {
    const mr = rec.current
    if (!mr) return
    mr.onstop = async () => {
      mr.stream.getTracks().forEach((t) => t.stop())
      if (timer.current) clearInterval(timer.current)
      const duration = Math.max(1, Math.round((Date.now() - started.current) / 1000))
      const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' })
      setPhase('processing')
      try {
        setData(await uploadScribe(visitId, blob, duration))
        setError('')
      } catch (e) {
        setError(errorText(e))
      } finally {
        setPhase('idle')
        rec.current = null
      }
    }
    if (mr.state === 'recording') mr.stop()
  }

  const accept = async (item: ScribeItem, text?: string) => {
    if (!item.section) return
    setBusy(item.id)
    try {
      const body = text ?? (editing === item.id ? draftText : undefined)
      await approveScribe(item.id, body)
      onAccept(item.section, body && body.trim() ? body : item.text)
      setEditing(null)
      await load()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  if (!view && !error) return null
  if (view?.disabled && phase === 'idle') {
    return <div className="sc"><p className="sc-off">Scribe nonaktif</p></div>
  }

  const open = view?.items.filter((i) => i.state === 'menunggu_review' || i.state === 'ditolak' || i.state === 'disetujui') ?? []

  return (
    <div className="sc">
      {error && <p className="sc-err" role="alert">{error}</p>}
      <div className="sc-bar">
        {phase === 'idle' && <button type="button" className="sc-btn sc-rec" onClick={() => void start()}>Dikte</button>}
        {phase === 'recording' && (
          <>
            <span className="sc-dot" aria-hidden />
            <span className="sc-time">{fmt(elapsed)}</span>
            <button type="button" className="sc-btn sc-stop" onClick={stop}>Berhenti</button>
          </>
        )}
        {phase === 'processing' && <p className="sc-proc">Memproses</p>}
      </div>
      {open.length > 0 && phase !== 'recording' && (
        <div className="sc-items">
          {open.map((item) => (
            <article key={item.id} className="sc-item">
              <div className="sc-item-h">
                <span className="sc-sec">{item.section}</span>
                <span className={`sc-chip ${item.state === 'disetujui' ? 'sc-chip-ok' : item.state === 'ditolak' ? 'sc-chip-no' : 'sc-chip-draf'}`}>
                  {item.state === 'disetujui' ? 'Disetujui' : item.state === 'ditolak' ? 'Ditolak' : 'Draf'}
                </span>
              </div>
              {editing === item.id
                ? <textarea className="sc-editbox" value={draftText} onChange={(e) => setDraftText(e.target.value)} />
                : <p className="sc-text">{item.text}</p>}
              {item.state === 'menunggu_review' && (
                <div className="sc-actions">
                  <button type="button" className="sc-btn sc-ok" disabled={busy === item.id} onClick={() => void accept(item)}>Setujui</button>
                  {editing === item.id
                    ? <button type="button" className="sc-btn sc-edit" onClick={() => setEditing(null)}>Batal</button>
                    : <button type="button" className="sc-btn sc-edit" onClick={() => { setEditing(item.id); setDraftText(item.text) }}>Ubah</button>}
                  <button type="button" className="sc-btn sc-no" onClick={() => pendingScribeRejects.queue(item.id, 'Tidak dipakai')}>Tolak</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {pending && (
        <div className="sc-toast" role="status">
          Ditolak
          <button type="button" className="sc-undo" onClick={() => pendingScribeRejects.cancel(pending.id)}>Urungkan</button>
        </div>
      )}
    </div>
  )
}
