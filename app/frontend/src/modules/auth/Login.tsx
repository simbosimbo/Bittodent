import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../shared/api/http'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { devQuickLogin, devStatus, login, twoFactorChallenge, type DevAccount } from './api'

// Dev picker labels for the seeded synthetic accounts (email local part -> role in the UI).
const DEV_ROLE: Record<string, string> = { dokter: 'Dokter', depan: 'Resepsionis', pemilik: 'Pemilik', asisten: 'Asisten', kasir: 'Kasir' }

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [step, setStep] = useState<'password' | 'code'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [devAccounts, setDevAccounts] = useState<DevAccount[]>([])

  // Server truth: /api/dev/status only exists on APP_ENV=local + DEV_QUICK_LOGIN=true (404 otherwise => no picker).
  useEffect(() => {
    devStatus().then((r) => setDevAccounts(r.quick_login ? r.accounts : []), () => setDevAccounts([]))
  }, [])

  const fail = (e: unknown, wrong: string) =>
    setError(e instanceof ApiError && e.status === 429 ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
      : e instanceof ApiError && e.status === 422 ? wrong : 'Tidak bisa terhubung ke server. Coba lagi.')

  async function submitPassword(ev: FormEvent) {
    ev.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await login(email, password)
      if (res?.two_factor) {
        setStep('code')
        setPassword('')
      } else onLoggedIn()
    } catch (e) {
      fail(e, 'Email atau kata sandi salah.')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(ev: FormEvent) {
    ev.preventDefault()
    if (!/^\d{6}$/.test(code)) return setError('Kode harus 6 angka.')
    setError('')
    setBusy(true)
    try {
      await twoFactorChallenge(code)
      onLoggedIn()
    } catch (e) {
      setCode('')
      fail(e, 'Kode autentikator salah atau kedaluwarsa.')
    } finally {
      setBusy(false)
    }
  }

  async function quick(account: string) {
    setError('')
    setBusy(true)
    try {
      await devQuickLogin(account)
      onLoggedIn()
    } catch (e) {
      fail(e, 'Masuk cepat ditolak.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand brand-lg"><span className="brand-mark" aria-hidden="true"><Icon d={ICONS.tooth} /></span> Bittodent</div>
        <span className="badge-synthetic">DATA SINTETIS</span>
        {step === 'password' ? (
          <form onSubmit={submitPassword} noValidate>
            <h1>Masuk</h1>
            <p className="muted">Masuk ke akun klinik Anda.</p>
            <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Kata sandi<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy || !email || !password}>{busy ? 'Memproses…' : 'Masuk'}</button>
          </form>
        ) : (
          <form onSubmit={submitCode} noValidate>
            <h1>Kode autentikator</h1>
            <p className="muted">Masukkan 6 angka dari aplikasi autentikator di ponsel Anda.</p>
            <label>Kode 6 angka
              <input className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Memeriksa…' : 'Verifikasi'}</button>
            <button type="button" className="btn btn-link" onClick={() => { setStep('password'); setError('') }}>Kembali</button>
          </form>
        )}
        {step === 'password' && devAccounts.length > 0 && (
          <section className="dev-quick" aria-label="Masuk cepat (dev)">
            <h2>Masuk cepat (dev)</h2>
            <p className="muted small">Hanya di mesin dev, akun seed sintetis, tanpa TOTP.</p>
            <div className="dev-quick-list">
              {devAccounts.map((a) => {
                const [local, domain] = a.email.split('@')
                return (
                  <button key={a.email} type="button" className="btn" disabled={busy} onClick={() => quick(a.email)} title={a.email}>
                    {DEV_ROLE[local] ?? a.name} <span className="muted small">{domain.replace(/\.test$/, '')}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
