import { useEffect, useState, type FormEvent } from 'react'
import { Button, Card, Input, Label, TextField } from '@heroui/react'
import { ApiError } from '../../shared/api/http'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { devQuickLogin, devStatus, login, twoFactorChallenge, type DevAccount } from './api'
import './login.css'

// Dev picker labels for the seeded synthetic accounts (email local part -> role in the UI).
const DEV_ROLE: Record<string, string> = { dokter: 'Dokter', depan: 'Resepsionis', pemilik: 'Pemilik', asisten: 'Asisten', kasir: 'Kasir' }

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [step, setStep] = useState<'password' | 'code'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [devAccounts, setDevAccounts] = useState<DevAccount[] | null>(null)

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
    <div className="login-page au-page">
      <Card className="au-card">
        <div className="brand brand-lg"><span className="brand-mark" aria-hidden="true"><Icon d={ICONS.tooth} /></span> Bittodent</div>
        <span className="badge-synthetic">DATA SINTETIS</span>
        {step === 'password' ? (
          <form onSubmit={submitPassword} noValidate>
            <h1>Masuk</h1>
            <p className="muted">Masuk ke akun klinik Anda.</p>
            <TextField className="au-field" type="email" autoComplete="username" value={email} onChange={setEmail} isRequired>
              <Label>Email</Label><Input /></TextField>
            <TextField className="au-field" type="password" autoComplete="current-password" value={password} onChange={setPassword} isRequired>
              <Label>Kata sandi</Label><Input /></TextField>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" fullWidth className="au-submit" isDisabled={busy || !email || !password}>{busy ? 'Memproses…' : 'Masuk'}</Button>
          </form>
        ) : (
          <form onSubmit={submitCode} noValidate>
            <h1>Kode autentikator</h1>
            <p className="muted">Masukkan 6 angka dari aplikasi autentikator di ponsel Anda.</p>
            <TextField className="au-field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
              value={code} onChange={(v) => setCode(v.replace(/\D/g, ''))}>
              <Label>Kode 6 angka</Label><Input className="otp" /></TextField>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button type="submit" fullWidth className="au-submit" isDisabled={busy}>{busy ? 'Memeriksa…' : 'Verifikasi'}</Button>
            <Button variant="ghost" fullWidth className="au-back" onPress={() => { setStep('password'); setError('') }}>Kembali</Button>
          </form>
        )}
        {step === 'password' && (devAccounts === null || devAccounts.length > 0) && (
          <section className="dev-quick" aria-label={devAccounts?.length ? 'Masuk cepat (dev)' : undefined} aria-busy={devAccounts === null}>
            {devAccounts === null ? (
              <div className="dev-quick-skel" aria-hidden="true">
                <div className="sk sk-title" />
                <div className="sk sk-line w2" />
                <div className="au-quick-list">{Array.from({ length: 10 }, (_, i) => <div key={i} className="sk sk-btn au-quick-sk" />)}</div>
              </div>
            ) : (
              <>
                <h2>Masuk cepat (dev)</h2>
                <p className="muted small">Hanya di mesin dev, akun seed sintetis, tanpa TOTP.</p>
                {/* Every button the same size: role on line 1, clinic domain on line 2 (equal 2-column grid). */}
                <div className="au-quick-list">
                  {devAccounts.map((a) => {
                    const [local, domain] = a.email.split('@')
                    return (
                      <Button key={a.email} variant="secondary" fullWidth className="au-quick" isDisabled={busy} onPress={() => quick(a.email)}>
                        <span className="au-quick-role">{DEV_ROLE[local] ?? a.name}</span> <span className="au-quick-domain">{domain.replace(/\.test$/, '')}</span>
                      </Button>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </Card>
    </div>
  )
}
