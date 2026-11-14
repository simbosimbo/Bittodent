import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, errorText } from '../../shared/api/http'
import { setActivePatient } from '../../shared/activePatient'
import { fmtDateTime, initials } from '../../shared/format'
import { ALERTS_CHANGED, AlertRibbon } from './AlertRibbon'
import { getFamily, getMedicalHistory, getPatient, saveMedicalHistory, type Family, type MedicalHistory, type PatientFull } from './api'
import { age, dob, PAYER, SEX } from './Patients'

const TABS = [['pasien', 'Profil'], ['rekam-medis', 'Rekam Medis'], ['keluarga', 'Keluarga'], ['riwayat-medis', 'Riwayat Medis']] as const

/** Header + tabs shared by the patient screens; loading the patient makes it the active patient.
 *  `alerts`: allergy/premed chips in the header (one /alerts fetch); used on Rekam Medis. */
export function PatientPage({ id, tab, canChart, actions, alerts, children }: { id: string; tab: string; canChart: boolean; actions?: ReactNode; alerts?: boolean; children: (p: PatientFull) => ReactNode }) {
  const [p, setP] = useState<PatientFull | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    getPatient(id).then((x) => { setP(x); setActivePatient({ id: x.id, name: x.name }) }, (e) => setError(e?.status === 404 ? 'Pasien tidak ditemukan.' : errorText(e)))
  }, [id])
  if (error) return <div className="card state-card error">{error} <a href="#/pasien">Kembali</a></div>
  if (!p) return <div className="card state-card muted">Memuat…</div>
  return (
    <>
      <nav className="crumbs small" aria-label="Breadcrumb"><a href="#/pasien">Daftar Pasien</a> <span aria-hidden="true">›</span> <span aria-current="page">{p.name}</span></nav>
      <div className="patient-head">
        <span className="avatar avatar-lg" aria-hidden="true">{initials(p.name)}</span>
        <div className="patient-head-main">
          <h1>{p.name}</h1>
          {/* No MRN field yet: never invent one. */}
          <p className="muted small">{[`${dob(p.dob)}${age(p.dob) ? ` (${age(p.dob)})` : ''}`, p.sex && (SEX[p.sex] ?? p.sex), `Penjamin ${PAYER[p.payer_type] ?? p.payer_type}`, 'No. RM: belum ada'].filter(Boolean).join(' · ')}</p>
          {alerts && <AlertRibbon patientId={p.id} compactDefault label="Peringatan medis pasien" className="patient-alerts" />}
        </div>
        {actions}
      </div>
      <nav className="tabs" aria-label="Data pasien">
        {TABS.filter(([k]) => k !== 'rekam-medis' || canChart).map(([k, label]) => (
          <a key={k} href={`#/${k}/${p.id}`} className={k === tab ? 'on' : undefined} aria-current={k === tab ? 'page' : undefined}>{label}</a>
        ))}
      </nav>
      {children(p)}
    </>
  )
}

const REL: Record<string, string> = { ayah: 'Ayah', ibu: 'Ibu', kakek_nenek: 'Kakek/Nenek', saudara: 'Saudara', wali_lain: 'Wali lain' }

export function FamilyPage({ id, canChart }: { id: string; canChart: boolean }) {
  const [f, setF] = useState<Family | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getFamily(id).then(setF, (e) => setError(errorText(e))) }, [id])
  return (
    <PatientPage id={id} tab="keluarga" canChart={canChart}>{() => error ? <div className="card state-card error">{error}</div> : !f ? <div className="card state-card muted">Memuat…</div> : (
      <div className="grid-2 gap">
        <div className="card">
          <h2>Anggota keluarga {f.household?.name && <span className="muted">· {f.household.name}</span>}</h2>
          {!f.household ? <p className="muted empty">Belum tergabung dalam keluarga.</p> : (
            <ul className="member-list">
              {f.household.members.map((m) => (
                <li key={m.id} className={m.id === id ? 'is-self' : undefined}>
                  <span className="avatar" aria-hidden="true">{m.name.charAt(0)}</span>
                  <div className="grow"><div className="strong">{m.name}</div><div className="muted small">{dob(m.dob)} {age(m.dob)}</div></div>
                  {f.guarantor?.id === m.id && <span className="chip chip-done">Penanggung biaya</span>}
                  {m.id === id ? <span className="chip chip-neutral">Pasien ini</span> : <a href={'#/keluarga/' + m.id}>Jadikan aktif</a>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h2>Penanggung biaya</h2>
            <p>{f.guarantor ? <a href={'#/pasien/' + f.guarantor.id} className="strong">{f.guarantor.name}</a> : 'Bayar sendiri'}</p>
          </div>
          <div className="card">
            <h2>Wali {f.is_minor && <span className="chip chip-checked_in">Pasien di bawah umur</span>}</h2>
            {f.guardians.length === 0 ? <p className="muted empty">{f.is_minor ? 'Belum ada wali tercatat.' : 'Tidak ada wali.'}</p> : (
              <dl className="details">
                {f.guardians.map((g) => <div key={g.id}><dt>{REL[g.relationship] ?? g.relationship}</dt><dd>{g.name}{g.phone && <span className="muted small"> · {g.phone}</span>}</dd></div>)}
              </dl>
            )}
          </div>
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
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      actions={canEdit && h && !edit ? <button className="btn btn-primary" onClick={start}>{c ? 'Perbarui riwayat medis' : 'Isi riwayat medis'}</button> : undefined}>
      {() => error ? <div className="card state-card error">{error}</div> : !h ? <div className="card state-card muted">Memuat…</div> : (
        <div className="grid-2 gap">
          {edit ? (
            <form className="card" onSubmit={save}>
              <h2>Perbarui riwayat medis</h2>
              <p className="muted small">Satu baris per butir. Menyimpan membuat versi baru; versi lama tidak diubah.</p>
              {(['allergies', 'problems', 'medications'] as const).map((k) => (
                <label key={k}>{{ allergies: 'Alergi', problems: 'Penyakit / kondisi', medications: 'Obat rutin' }[k]}
                  <textarea rows={3} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></label>
              ))}
              <label>Catatan penting<textarea rows={2} maxLength={500} value={edit.urgent_note} onChange={(e) => setEdit({ ...edit, urgent_note: e.target.value })} /></label>
              <label className="check"><input type="checkbox" checked={edit.premed} onChange={(e) => setEdit({ ...edit, premed: e.target.checked })} /> Perlu premedikasi sebelum tindakan</label>
              {msg && <p className="form-error">{msg}</p>}
              <div className="dialog-actions"><button type="button" className="btn" onClick={() => setEdit(null)}>Batal</button><button className="btn btn-primary">Simpan versi baru</button></div>
            </form>
          ) : (
            <div className="card">
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
            </div>
          )}
          <div className="card">
            <h2>Versi</h2>
            {h.history.length === 0 ? <p className="muted empty">Belum ada versi.</p> : (
              <ol className="version-list">
                {h.history.map((v) => (
                  <li key={v.id}>
                    <div className="strong">Versi {v.version} {v.id === c?.id ? <span className="chip chip-done">Berlaku</span> : <span className="chip chip-neutral">Digantikan</span>}</div>
                    <div className="muted small">{fmtDateTime(v.created_at)} · {v.allergies.length} alergi · {v.problems.length} kondisi · {v.medications.length} obat{v.premedication_required ? ' · premedikasi' : ''}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </PatientPage>
  )
}
