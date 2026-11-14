import { useState } from 'react'
import { NEXT_RM } from '../data/mock'
import { ageOf, dateLabel, maskNik, maskPhone } from '../lib/format'
import { go } from '../lib/router'
import { useActive, useStore } from '../state/store'
import { Icon } from '../components/Icon'
import { Badge, Button, Card, Field, Input, Select } from '../components/ui'

export function Keluarga() {
  const { s, a } = useStore()
  const p = useActive()
  const [q, setQ] = useState('')
  const [show, setShow] = useState(false)
  const term = q.trim().toLowerCase()
  const results = s.patients.filter((x) => !term || x.name.toLowerCase().includes(term) || x.rm.toLowerCase().includes(term) || x.phone.includes(term) || x.nik.includes(term))
  const daftar = (
      <Card className="daftar-card" title={term ? `Hasil pencarian (${results.length})` : `Daftar pasien (${results.length})`}>
        <ul className="list">
          {results.map((x) => (
            <li key={x.id}>
              <button className={`list-row ${x.id === p?.id ? 'on' : ''}`} onClick={() => { a.setActive(x.id); setQ('') }}>
                <span className="avatar">{x.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                <span><strong>{x.name}</strong><small className="muted"> {x.rm} · {ageOf(x.dob)} th</small></span>
                <span className="spacer" />
                {x.allergies.length > 0 && <span className="mini-allergy">Alergi</span>}
                {x.id === p?.id ? <Badge tone="primary">Aktif</Badge> : <span className="link">Jadikan pasien aktif</span>}
              </button>
            </li>
          ))}
          {!results.length && <li className="muted pad">Tidak ditemukan. <a href="#/keluarga/baru">Daftarkan pasien baru</a></li>}
        </ul>
      </Card>
  )
  return (
    <div className="screen">
      <div className="screen-head">
        <div><h2>Keluarga / Profil</h2><p className="muted">Cari pasien dulu (nama / no. RM / HP). Daftar baru hanya jika tidak ketemu.</p></div>
        <div className="row gap">
          <div className="search-inline"><Icon name="search" size={18} /><input aria-label="Cari pasien" placeholder="Cari nama / no. RM / HP" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {term && !results.length
            ? <Button variant="primary" icon="plus" onClick={() => go('/keluarga/baru')}>Pasien baru</Button>
            : <Button variant="ghost" icon="plus" onClick={() => go('/keluarga/baru')}>Pasien baru</Button>}
        </div>
      </div>
      {!p ? (
        <>
          {daftar}
          <p className="muted">Pilih pasien dari daftar, atau ketuk Pilih pasien di bilah atas, untuk membuka profil.</p>
        </>
      ) : (
        <div className="keluarga-split">
          {daftar}
          <div className="keluarga-profil">
            <div className="grid-2">
          <Card title="Identitas" actions={<Button size="sm" variant="ghost" icon={show ? 'eyeOff' : 'eye'} onClick={() => setShow(!show)}>{show ? 'Sembunyikan' : 'Tampilkan'} NIK & HP</Button>}>
            <dl className="kv">
              <dt>Nama</dt><dd>{p.name}</dd>
              <dt>No. RM</dt><dd>{p.rm}</dd>
              <dt>Tanggal lahir</dt><dd>{dateLabel(p.dob)} ({ageOf(p.dob)} th)</dd>
              <dt>NIK</dt><dd>{show ? p.nik : maskNik(p.nik)}</dd>
              <dt>HP</dt><dd>{show ? p.phone : maskPhone(p.phone)}</dd>
              <dt>Alamat</dt><dd>{show ? p.address : 'Disembunyikan'}</dd>
              <dt>Pekerjaan</dt><dd>{p.social.pekerjaan}</dd>
              <dt>Pendidikan</dt><dd>{p.social.pendidikan}</dd>
              <dt>Penjamin</dt><dd>{p.insurance ? `${p.insurance.insurer} · ${p.insurance.policyNo} · tanggungan ${p.insurance.coverPct}%` : 'Umum (bayar sendiri)'}</dd>
            </dl>
          </Card>
          <Card title="Anggota keluarga">
            <ul className="list">
              {s.patients.filter((x) => x.familyId === p.familyId).map((x) => (
                <li key={x.id}>
                  <button className={`list-row ${x.id === p.id ? 'on' : ''}`} onClick={() => a.setActive(x.id)} aria-current={x.id === p.id}>
                    <span className="avatar">{x.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                    <span><strong>{x.name}</strong><small className="muted"> {x.relation} · {x.rm} · {ageOf(x.dob)} th</small></span>
                    <span className="spacer" />
                    {x.id === p.id ? <Badge tone="primary">Aktif</Badge> : <span className="link">Jadikan aktif</span>}
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted small pad">Tagihan bisa dilihat per pasien atau per keluarga di modul Tagihan.</p>
          </Card>
          <Card title="Persetujuan">
            <ul className="consents">
              <li>{p.consentPdp ? <Badge tone="success" icon="check">Ada</Badge> : <Badge tone="danger">Belum</Badge>}<span>Pemrosesan data sesuai UU PDP{p.consentPdpAt && ` · ${dateLabel(p.consentPdpAt)}`}</span></li>
              <li>{p.consentRecallWa ? <Badge tone="success" icon="check">Ada</Badge> : <Badge tone="neutral">Tidak</Badge>}<span>Pengingat kontrol via WhatsApp (tanpa isi klinis)</span></li>
              <li><Badge tone="warning">Perlu tanda tangan</Badge><span>Persetujuan tindakan — dibuat per tindakan invasif, ditandatangani di tablet (penanda tangan, saksi, waktu, perangkat, hash dokumen).</span></li>
            </ul>
          </Card>
          <Card title="Riwayat singkat">
            <ul className="list">
              {s.procs.filter((x) => x.patientId === p.id).slice(-4).reverse().map((x) => <li key={x.id} className="list-row static"><span>{dateLabel(x.date)}</span><span>{x.name}{x.tooth ? ` · gigi ${x.tooth}` : ''}</span></li>)}
            </ul>
          </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


export function Registrasi() {
  const { s, a } = useStore()
  const [step, setStep] = useState(0)
  const [draftSaved, setDraftSaved] = useState(false)
  const [f, setF] = useState({ rm: NEXT_RM, name: '', nik: 'NIK-CONTOH-0009', dob: '', sex: 'P' as 'P' | 'L', phone: '', address: '', pekerjaan: '', pendidikan: 'SMA', allergy: '', recall: false, consent: false, insurer: 'none' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value as typeof f[typeof k] })
  const taken = s.patients.some((p) => p.rm === f.rm)
  const can = f.consent && f.name.trim() && f.dob && !taken
  const submit = () => {
    if (!can) return
    a.register({
      rm: f.rm, name: f.name.trim(), dob: f.dob, sex: f.sex, allergies: f.allergy.trim() ? f.allergy.split(',').map((x) => x.trim()) : [],
      nik: f.nik, phone: f.phone || '080000000000', address: f.address, familyId: 'f-' + f.rm, relation: 'Kepala keluarga',
      insurance: f.insurer === 'prudential' ? { insurer: 'Prudential', policyNo: 'PRU-CONTOH-00', coverPct: 70 } : undefined,
      consentPdp: true, consentPdpAt: '2026-11-14', consentRecallWa: f.recall, social: { pekerjaan: f.pekerjaan || '—', pendidikan: f.pendidikan }, branchId: s.branchId,
    })
    if (!s.flow.active) a.startFlow(null)
    a.toast('Pasien terdaftar dan menjadi pasien aktif. Lanjut: pilih slot kursi.')
    go('/jadwal')
  }
  const saveDraft = () => { setDraftSaved(true); a.toast('Draf pendaftaran disimpan di sesi ini.') }
  return (
    <div className="screen">
      <div className="screen-head"><div><h2>Registrasi pasien baru</h2><p className="muted">Keluarga / Profil · data palsu saja di prototipe. Langkah {step + 1} dari 4.</p></div></div>
      <ol className="stepper" aria-label="Langkah registrasi">
        {['Identitas', 'Kontak', 'Asuransi', 'Konfirmasi'].map((label, i) => (
          <li key={label} className={`${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}><button type="button" onClick={() => setStep(i)}><span>{i + 1}</span>{label}</button></li>
        ))}
      </ol>
      <form className="card form-grid form-step" onSubmit={(e) => { e.preventDefault(); if (step < 3) setStep(step + 1); else submit() }}>
        {step === 0 && <>
          <Field label="No. RM" required hint="Usulan nomor berikutnya" error={taken ? 'No. RM sudah dipakai' : undefined}>{(id) => <Input id={id} value={f.rm} onChange={set('rm')} />}</Field>
          <Field label="Nama lengkap" required>{(id) => <Input id={id} value={f.name} onChange={set('name')} placeholder="mis. Rudi Contoh" />}</Field>
          <Field label="NIK" hint="Format contoh, misalnya NIK-CONTOH-0009 atau 0000 0000 0000 0009">{(id) => <Input id={id} value={f.nik} onChange={set('nik')} />}</Field>
          <Field label="Tanggal lahir" required>{(id) => <Input id={id} type="date" value={f.dob} onChange={set('dob')} />}</Field>
          <Field label="Jenis kelamin" required>{(id) => <Select id={id} value={f.sex} onChange={set('sex')}><option value="P">Perempuan</option><option value="L">Laki-laki</option></Select>}</Field>
          <Field label="Alergi" hint="Pisahkan dengan koma. Kosongkan jika tidak ada.">{(id) => <Input id={id} value={f.allergy} onChange={set('allergy')} />}</Field>
        </>}
        {step === 1 && <>
          <Field label="No. HP">{(id) => <Input id={id} inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="08xx" />}</Field>
          <Field label="Alamat">{(id) => <Input id={id} value={f.address} onChange={set('address')} />}</Field>
          <Field label="Pekerjaan">{(id) => <Input id={id} value={f.pekerjaan} onChange={set('pekerjaan')} />}</Field>
          <Field label="Pendidikan terakhir">{(id) => <Select id={id} value={f.pendidikan} onChange={set('pendidikan')}>{['SD', 'SMP', 'SMA', 'D3', 'S1', 'S2', 'Lainnya'].map((x) => <option key={x}>{x}</option>)}</Select>}</Field>
        </>}
        {step === 2 && <>
          <Field label="Penjamin">{(id) => <Select id={id} value={f.insurer} onChange={set('insurer')}><option value="none">Umum (bayar sendiri)</option><option value="prudential">Prudential (contoh asuransi swasta)</option></Select>}</Field>
          <p className="muted small span-2">BPJS belum masuk MVP. Satu penjamin per pasien di prototipe ini.</p>
        </>}
        {step === 3 && <>
          <div className="span-2">
            <dl className="kv">
              <dt>No. RM</dt><dd>{f.rm}</dd>
              <dt>Nama</dt><dd>{f.name || '—'}</dd>
              <dt>Lahir</dt><dd>{f.dob || '—'}</dd>
              <dt>NIK</dt><dd>{f.nik}</dd>
              <dt>HP</dt><dd>{f.phone || '—'}</dd>
              <dt>Penjamin</dt><dd>{f.insurer === 'prudential' ? 'Prudential' : 'Umum'}</dd>
            </dl>
          </div>
          <div className="span-2 stack">
            <label className="check"><input type="checkbox" checked={f.recall} onChange={(e) => setF({ ...f, recall: e.target.checked })} />Bersedia menerima pengingat kontrol via WhatsApp (opsional)</label>
            <label className="check required"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} aria-required="true" />Saya menyetujui pemrosesan data sesuai UU PDP <span className="req">*</span></label>
            {!f.consent && <small className="muted">Tombol selesai aktif setelah persetujuan dicentang.</small>}
            {draftSaved && <small className="muted">Draf terakhir disimpan di sesi ini.</small>}
          </div>
        </>}
        <div className="span-2 row gap end form-footer">
          <Button variant="ghost" type="button" onClick={() => step === 0 ? history.back() : setStep(step - 1)}>{step === 0 ? 'Batal' : 'Kembali'}</Button>
          <Button variant="ghost" type="button" onClick={saveDraft}>Simpan draf</Button>
          {step < 3
            ? <Button variant="primary" type="submit">Lanjut</Button>
            : <Button variant="primary" type="submit" disabled={!can}>Simpan & lanjut ke Jadwal</Button>}
        </div>
      </form>
    </div>
  )
}
