import type { ReactNode } from 'react'
import { useState } from 'react'
import { go } from '../lib/router'
import { Button, Field, Input } from '../components/ui'
import { Icon } from '../components/Icon'
import { PinPad } from '../components/PinPad'

// Layar autentikasi: TANPA data pasien. TOTP saja. Tidak ada "ingat saya" / "percayai perangkat" / OTP WA atau email.
function AuthShell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-dot" aria-hidden>B</span>Bitto</div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
      </div>
      <p className="auth-foot">Prototipe dengan data palsu. Bukan sistem produksi.</p>
    </main>
  )
}

export function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const ok = email.trim() && pw
  return (
    <AuthShell title="Masuk" sub="Gunakan akun klinik Anda.">
      <form onSubmit={(e) => { e.preventDefault(); if (ok) go('/login/totp') }} className="stack">
        <Field label="Email" required>{(id) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@klinik.contoh" />}</Field>
        <Field label="Kata sandi" required>{(id) => <Input id={id} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
        <Button variant="primary" type="submit" disabled={!ok} className="block">Lanjut</Button>
        <p className="muted small">Setelah kata sandi, Anda wajib memasukkan kode 6 angka dari aplikasi autentikator.</p>
      </form>
    </AuthShell>
  )
}

export function Totp() {
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [rc, setRc] = useState('')
  return (
    <AuthShell title="Kode autentikator" sub="Buka aplikasi autentikator (TOTP) di ponsel Anda, lalu masukkan 6 angka yang tampil.">
      {!recovery ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) go('/login/recovery') }}>
          <Field label="Kode 6 angka" required>{(id) => <Input id={id} className="input otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" />}</Field>
          <Button variant="primary" type="submit" disabled={code.length !== 6} className="block">Verifikasi</Button>
          <button type="button" className="link" onClick={() => setRecovery(true)}>Tidak bisa membuka aplikasi? Pakai kode pemulihan</button>
        </form>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (rc.trim().length >= 8) go('/jadwal') }}>
          <Field label="Kode pemulihan" hint="Setiap kode hanya berlaku satu kali.">{(id) => <Input id={id} value={rc} onChange={(e) => setRc(e.target.value)} placeholder="XXXX-XXXX" />}</Field>
          <Button variant="primary" type="submit" disabled={rc.trim().length < 8} className="block">Masuk dengan kode pemulihan</Button>
          <button type="button" className="link" onClick={() => setRecovery(false)}>Kembali ke kode autentikator</button>
        </form>
      )}
    </AuthShell>
  )
}

const CODES = ['7KQ2-M9XA', 'P4TR-2WLD', 'H8ZE-K3NC', 'B6VU-Q1YS', 'R2FD-8JMT', 'N5CW-X7PE', 'G3LA-6HRV', 'D9SK-4BZQ', 'W1MY-T5GN', 'E7JP-0CUF']
export function Recovery() {
  const [saved, setSaved] = useState(false)
  return (
    <AuthShell title="Simpan kode pemulihan" sub="Pengaturan pertama. Kode ini hanya ditampilkan sekali. Simpan di tempat aman, terpisah dari ponsel.">
      <ol className="codes" aria-label="Kode pemulihan sekali pakai">{CODES.map((c) => <li key={c}><code>{c}</code></li>)}</ol>
      <div className="row gap wrap">
        <Button icon="print" onClick={() => window.print()}>Cetak</Button>
        <Button onClick={() => navigator.clipboard?.writeText(CODES.join('\n'))}>Salin</Button>
      </div>
      <label className="check"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />Saya sudah menyimpan kode pemulihan</label>
      <Button variant="primary" className="block" disabled={!saved} onClick={() => go('/jadwal')}>Selesai & masuk</Button>
    </AuthShell>
  )
}

const MAX = 5
export function Pin({ initialTries }: { initialTries: number }) {
  const [pin, setPin] = useState('')
  const [fails, setFails] = useState(Math.min(MAX, initialTries))
  const [err, setErr] = useState('')
  const left = MAX - fails
  const submit = (v = pin) => {
    if (v.length !== 6) return
    if (v === '123456') { go('/jadwal'); return }
    setFails((f) => f + 1); setPin(''); setErr('PIN salah.')
  }
  if (left <= 0) return (
    <main className="auth">
      <div className="auth-card wipe">
        <Icon name="alert" size={40} />
        <h1>Data lokal di perangkat ini telah dihapus</h1>
        <p>PIN salah 5 kali. Demi keamanan, semua data offline di perangkat ini dihapus. Data di server tidak terpengaruh.</p>
        <p className="muted">Masuk lagi saat online dengan email, kata sandi, dan kode autentikator untuk mendaftarkan ulang perangkat.</p>
        <Button variant="primary" onClick={() => go('/login')}>Ke halaman masuk</Button>
        <small className="muted">(Simulasi prototipe — tidak ada data yang benar-benar dihapus.)</small>
      </div>
    </main>
  )
  return (
    <AuthShell title="Buka kunci perangkat" sub="Perangkat cabang terdaftar untuk mode offline. Masukkan PIN 6 angka.">
      <div className={`pin-warn ${left <= 2 ? 'strong' : ''}`} role={left <= 2 ? 'alert' : undefined}>
        <Icon name="alert" size={18} />
        {left <= 2
          ? <span><strong>Peringatan: sisa {left} percobaan.</strong> Jika salah lagi {left === 1 ? '' : `${left} kali`}, semua data lokal di perangkat ini akan dihapus.</span>
          : <span>5x salah = data lokal di perangkat dihapus. Sisa {left} percobaan.</span>}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <PinPad value={pin} onChange={(v) => { setPin(v); setErr('') }} onSubmit={submit} />
      <Button variant="primary" className="block" disabled={pin.length !== 6} onClick={() => submit()}>Buka</Button>
      <p className="muted small">PIN contoh prototipe: 123456</p>
    </AuthShell>
  )
}
