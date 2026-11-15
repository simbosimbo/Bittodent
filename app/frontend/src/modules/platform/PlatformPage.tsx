import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../shared/api/http'
import { impersonate, platformLogin, platformLogout, platformMe, platformTenants, stopImpersonation, type PlatformMe, type PlatformTenant } from './api'

// Bare functional platform page (#/platform). The full console UI is designed separately; this only logs in and starts/stops.
export default function PlatformPage({ onEnterClinic }: { onEnterClinic: () => void }) {
  const [me, setMe] = useState<PlatformMe | null | undefined>(undefined)
  const [tenants, setTenants] = useState<PlatformTenant[]>([])
  const [error, setError] = useState('')

  useEffect(() => { platformMe().then(setMe, () => setMe(null)) }, [])
  useEffect(() => {
    if (me?.permissions.includes('platform.impersonate')) platformTenants().then((r) => setTenants(r.tenants), () => setError('Gagal memuat daftar klinik.'))
  }, [me])

  async function start(tenantId: string, userId: string) {
    try { await impersonate(tenantId, userId); onEnterClinic() } catch (e) { setError(e instanceof ApiError ? e.message : 'Gagal.') }
  }

  if (me === undefined) return <div className="center muted">Memuat…</div>
  if (me === null) return <PlatformLogin onLoggedIn={setMe} />
  return (
    <div className="page">
      <div className="page-head"><h1>Platform</h1></div>
      <p>Masuk sebagai <strong>{me.name}</strong> ({me.email}).{' '}
        <button className="btn btn-link" onClick={async () => { await platformLogout().catch(() => null); setMe(null) }}>Keluar</button></p>
      {me.impersonation.active && (
        <p className="notice">Sedang masuk ke sebuah klinik.{' '}
          <button className="btn" onClick={onEnterClinic}>Buka klinik</button>{' '}
          <button className="btn" onClick={async () => setMe(await stopImpersonation())}>Berhenti</button></p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <table className="table">
        <thead><tr><th>Klinik</th><th>Admin klinik</th></tr></thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id}><td>{t.name}</td><td>{t.admins.map((a) => (
              <button key={a.id} className="btn" onClick={() => start(t.id, a.id)}>Masuk sebagai {a.name}</button>
            ))}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PlatformLogin({ onLoggedIn }: { onLoggedIn: (me: PlatformMe) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    try { onLoggedIn(await platformLogin(email, password, code)) } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'Terlalu banyak percobaan. Tunggu sebentar.' : 'Email, kata sandi, atau kode verifikasi salah.')
    }
  }
  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>Masuk platform</h1>
        <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label>Kata sandi <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        <label>Kode 6 angka <input className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={!email || !password || code.length !== 6}>Masuk</button>
      </form>
    </div>
  )
}
