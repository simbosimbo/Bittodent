import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { StateCard } from '../../shared/ui/StateCard'
import { Avatar, Button, Card, Chip } from '@heroui/react'
import { ApiError, errorText } from '../../shared/api/http'
import { setActivePatient } from '../../shared/activePatient'
import { fmtDateTime, initials } from '../../shared/format'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { Menu } from '../../shared/ui/Menu'
import { PageSkeleton } from '../../shared/ui/Skeleton'
import { useIsMobile } from '../../shared/useIsMobile'
import { ALERTS_CHANGED, AlertRibbon, AlertSheet, AlertStrip } from './AlertRibbon'
import { getFamily, getMedicalHistory, getPatient, saveMedicalHistory, type Family, type MedicalHistory, type PatientFull } from './api'
import { age, ageTahun, dob, SEX } from './Patients'
import { Note } from '../../shared/ui/Note'

const TABS = [['pasien', 'Profil'], ['rekam-medis', 'Rekam Medis'], ['keluarga', 'Keluarga'], ['riwayat-medis', 'Riwayat Medis']] as const

/** Header (with the Profil / Rekam Medis / Keluarga / Riwayat Medis menu) shared by the patient screens; loading the patient makes it the active patient.
 *  `alerts`: allergy/premed/condition chips in the header (one /alerts fetch); `status`: extra chip in the same row (visit status). Both used on Rekam Medis. */
export function PatientPage({ id, tab, canChart, actions, alerts, status, children }: { id: string; tab: string; canChart: boolean; actions?: ReactNode; alerts?: boolean; status?: ReactNode; children: (p: PatientFull) => ReactNode }) {
  const [p, setP] = useState<PatientFull | null>(null)
  const [error, setError] = useState('')
  const mobile = useIsMobile()
  const head = useRef<HTMLDivElement>(null)
  const passed = useScrolledPast(head, mobile && !!alerts && !!p)
  const [sheet, setSheet] = useState(false)
  useEffect(() => {
    let live = true
    setP(null)
    setError('')
    getPatient(id).then((x) => { if (!live) return; setP(x); setActivePatient({ id: x.id, name: x.name }) }, (e) => { if (live) setError(e?.status === 404 ? 'Pasien tidak ditemukan.' : errorText(e)) })
    return () => { live = false }
  }, [id])
  if (error) return <StateCard error={error}><a href="#/pasien">Kembali</a></StateCard>
  if (!p) return <PageSkeleton variant="record" />
  return (
    <>
      <nav className="crumbs small" aria-label="Breadcrumb"><a href="#/pasien">Daftar Pasien</a> <span aria-hidden="true">›</span> <span aria-current="page">{p.name}</span></nav>
      <div className="patient-head" ref={head}>
        <Avatar size="lg" color="accent" variant="soft" className="pt-avatar-lg" aria-hidden="true"><Avatar.Fallback>{initials(p.name)}</Avatar.Fallback></Avatar>
        <div className="patient-head-main">
          <div className="patient-head-title">
            <h1>{p.name}</h1>
            {/* DOB and payer live on Profil; "No. RM …" never breaks mid-token. */}
            <p className="muted small">{[ageTahun(p.dob), p.sex && (SEX[p.sex] ?? p.sex)].filter(Boolean).map((x) => x + ' · ')}<span className="patient-mrn">No. RM <strong>{p.mrn ?? 'belum ada'}</strong></span></p>
          </div>
          {(alerts || status) && (
            <div className="patient-chip-row">
              {alerts && <AlertRibbon patientId={p.id} compactDefault label="Peringatan medis pasien" className="patient-alerts" />}
              {status}
            </div>
          )}
        </div>
        <div className="patient-head-actions">
          {actions}
          {/* Profil / Keluarga / Riwayat Medis live here (no outer tab bar, no sidebar items). */}
          <Menu label="Menu pasien" variant="outline" isIconOnly className="shell-icon" trigger={<Icon d={ICONS.more} />}>
            {(close) => TABS.filter(([k]) => k !== 'rekam-medis' || canChart).map(([k, label]) => (
              <a key={k} href={`#/${k}/${p.id}`} aria-current={k === tab ? 'page' : undefined} onClick={close}>{label}</a>
            ))}
          </Menu>
        </div>
      </div>
      {/* Phone: the full header scrolls away; this strip keeps name + allergies under the top bar. */}
      {mobile && alerts && (
        <div className="patient-mini" hidden={!passed}>
          <p className="patient-mini-who"><strong>{p.name}</strong> <span className="muted">{p.mrn ?? ''}</span></p>
          <AlertStrip patientId={p.id} onOpen={() => setSheet(true)} />
        </div>
      )}
      {sheet && <AlertSheet patientId={p.id} onClose={() => setSheet(false)} />}
      {children(p)}
    </>
  )
}

/** true once `ref` has scrolled up under the pinned top bar (--shell-sticky-h). No IntersectionObserver (jsdom) = never. */
function useScrolledPast(ref: { current: HTMLElement | null }, on: boolean) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!on || !el || typeof IntersectionObserver === 'undefined') { setPast(false); return }
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--shell-sticky-h')) || 0
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < top), { rootMargin: `-${top}px 0px 0px 0px` })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, on])
  return past
}

const REL: Record<string, string> = { ayah: 'Ayah', ibu: 'Ibu', kakek_nenek: 'Kakek/Nenek', saudara: 'Saudara', wali_lain: 'Wali lain' }

export function FamilyPage({ id, canChart }: { id: string; canChart: boolean }) {
  const [f, setF] = useState<Family | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setF(null); setError('')
    getFamily(id).then((x) => { if (live) setF(x) }, (e) => { if (live) setError(errorText(e)) })
    return () => { live = false }
  }, [id])
  return (
    <PatientPage id={id} tab="keluarga" canChart={canChart}>{() => error ? <StateCard error={error} /> : !f ? <PageSkeleton variant="record" /> : (
      <div className="grid-2 gap">
        <Card className="pt-card">
          <h2>Anggota keluarga {f.household?.name && <span className="muted">· {f.household.name}</span>}</h2>
          {!f.household ? <p className="muted empty">Belum tergabung dalam keluarga.</p> : (
            <ul className="member-list">
              {f.household.members.map((m) => (
                <li key={m.id} className={m.id === id ? 'is-self' : undefined}>
                  <Avatar size="sm" color="accent" variant="soft" className="pl-avatar" aria-hidden="true"><Avatar.Fallback>{m.name.charAt(0)}</Avatar.Fallback></Avatar>
                  <div className="grow"><div className="strong">{m.name}</div><div className="muted small">{dob(m.dob)} {age(m.dob)}</div></div>
                  {f.guarantor?.id === m.id && <Chip size="sm" variant="soft" color="success" className="pl-chip">Penanggung biaya</Chip>}
                  {m.id === id ? <Chip size="sm" variant="soft" className="pl-chip">Pasien ini</Chip> : <a href={'#/keluarga/' + m.id} className="member-switch">Jadikan aktif</a>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="stack">
          <Card className="pt-card">
            <h2>Penanggung biaya</h2>
            <p>{f.guarantor ? <a href={'#/pasien/' + f.guarantor.id} className="strong guarantor-link">{f.guarantor.name}</a> : 'Bayar sendiri'}</p>
          </Card>
          <Card className="pt-card">
            <h2>Wali {f.is_minor && <Chip size="sm" variant="soft" color="warning" className="pl-chip">Pasien di bawah umur</Chip>}</h2>
            {f.guardians.length === 0 ? <p className="muted empty">{f.is_minor ? 'Belum ada wali tercatat.' : 'Tidak ada wali.'}</p> : (
              <dl className="details">
                {f.guardians.map((g) => <div key={g.id}><dt>{REL[g.relationship] ?? g.relationship}</dt><dd>{g.name}{g.phone && <span className="muted small"> · {g.phone}</span>}</dd></div>)}
              </dl>
            )}
          </Card>
        </div>
      </div>
    )}</PatientPage>
  )
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
const List = ({ items }: { items: string[] }) => items.length ? <ul className="plain">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <span className="muted">—</span>

export function MedicalHistoryPage({ id, canChart, canEdit }: { id: string; canChart: boolean; canEdit: boolean }) {
  const [h, setH] = useState<MedicalHistory | null>(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<Record<'allergies' | 'problems' | 'medications' | 'urgent_note', string> & { premed: boolean } | null>(null)
  const [msg, setMsg] = useState('')
  const load = () => getMedicalHistory(id).then(setH, (e) => setError(errorText(e)))
  useEffect(() => {
    let live = true
    setH(null); setError(''); setEdit(null); setMsg('')
    getMedicalHistory(id).then((x) => { if (live) setH(x) }, (e) => { if (live) setError(errorText(e)) })
    return () => { live = false }
  }, [id])

  function start() {
    const c = h?.current
    setMsg('')
    setEdit({ allergies: (c?.allergies ?? []).join('\n'), problems: (c?.problems ?? []).join('\n'), medications: (c?.medications ?? []).join('\n'), urgent_note: c?.urgent_note ?? '', premed: !!c?.premedication_required })
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!edit) return
    try {
      await saveMedicalHistory(id, { base_version: h?.current?.version ?? null, allergies: lines(edit.allergies), problems: lines(edit.problems),
        medications: lines(edit.medications), urgent_note: edit.urgent_note.trim() || null, premedication_required: edit.premed })
      setEdit(null)
      setMsg('Tersimpan sebagai versi baru. Versi lama tetap tersimpan.')
      dispatchEvent(new Event(ALERTS_CHANGED))
      await load()
    } catch (err) {
      setMsg(err instanceof ApiError && [409, 422].includes(err.status) ? err.data?.message ?? 'Data tidak valid.' : errorText(err))
    }
  }

  const c = h?.current
  return (
    <PatientPage id={id} tab="riwayat-medis" canChart={canChart}
      actions={canEdit && h && !edit ? <Button onPress={start}>{c ? 'Perbarui riwayat medis' : 'Isi riwayat medis'}</Button> : undefined}>
      {() => error ? <StateCard error={error} /> : !h ? <PageSkeleton variant="record" /> : (
        <div className="grid-2 gap">
          {edit ? (
            <Card className="pt-card"><form onSubmit={save}>
              <h2>Perbarui riwayat medis</h2>
              <p className="muted small">Satu baris per butir. Menyimpan membuat versi baru; versi lama tidak diubah.</p>
              {(['allergies', 'problems', 'medications'] as const).map((k) => (
                <label key={k}>{{ allergies: 'Alergi', problems: 'Penyakit / kondisi', medications: 'Obat rutin' }[k]}
                  <textarea rows={3} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></label>
              ))}
              <label>Catatan penting<textarea rows={2} maxLength={500} value={edit.urgent_note} onChange={(e) => setEdit({ ...edit, urgent_note: e.target.value })} /></label>
              <label className="check"><input type="checkbox" checked={edit.premed} onChange={(e) => setEdit({ ...edit, premed: e.target.checked })} /> Perlu premedikasi sebelum tindakan</label>
              {msg && <Note status="danger" role="alert">{msg}</Note>}
              <div className="dialog-actions"><Button variant="secondary" className="pt-btn" onPress={() => setEdit(null)}>Batal</Button><Button type="submit" className="pt-btn">Simpan versi baru</Button></div>
            </form></Card>
          ) : (
            <Card className="pt-card">
              <h2>Riwayat medis terkini {c && <span className="muted">· versi {c.version}</span>}</h2>
              {msg && <p className="muted">{msg}</p>}
              {!c ? <p className="muted empty">Belum diisi.</p> : (
                <dl className="details one">
                  <div><dt>Premedikasi</dt><dd>{c.premedication_required ? <span className="alert-chip alert-premedikasi">Perlu premedikasi</span> : 'Tidak perlu'}</dd></div>
                  <div><dt>Catatan penting</dt><dd>{c.urgent_note ? <span className="alert-chip alert-catatan_penting">{c.urgent_note}</span> : '—'}</dd></div>
                  <div><dt>Alergi</dt><dd><List items={c.allergies} /></dd></div>
                  <div><dt>Penyakit / kondisi</dt><dd><List items={c.problems} /></dd></div>
                  <div><dt>Obat rutin</dt><dd><List items={c.medications} /></dd></div>
                </dl>
              )}
            </Card>
          )}
          <Card className="pt-card">
            <h2>Versi</h2>
            {h.history.length === 0 ? <p className="muted empty">Belum ada versi.</p> : (
              <ol className="version-list">
                {h.history.map((v) => (
                  <li key={v.id}>
                    <div className="strong">Versi {v.version} {v.id === c?.id ? <Chip size="sm" variant="soft" color="success" className="pl-chip">Berlaku</Chip> : <Chip size="sm" variant="soft" className="pl-chip">Digantikan</Chip>}</div>
                    <div className="muted small">{fmtDateTime(v.created_at)} · {v.allergies.length} alergi · {v.problems.length} kondisi · {v.medications.length} obat{v.premedication_required ? ' · premedikasi' : ''}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </PatientPage>
  )
}
