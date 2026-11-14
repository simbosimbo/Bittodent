import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { go, useRoute } from './lib/router'
import { useStore } from './state/store'
import { AppShell } from './shells/AppShell'
import { Login, Pin, Recovery, Totp } from './screens/Auth'
import { Jadwal } from './screens/Jadwal'
import { Keluarga, Registrasi } from './screens/Keluarga'
import { Tagihan } from './screens/Tagihan'
import { PresentasiPasien, Rencana } from './screens/Rencana'
import { Charting } from './screens/Charting'
import { Alur, Desain, Gambar, Kelola } from './screens/Lainnya'

export default function App() {
  const { path, query } = useRoute()
  const { s, a } = useStore()

  const qs = query.toString()
  useEffect(() => {
    const off = query.get('offline'); if (off) a.setOffline(off === '1')
    const mode = query.get('mode'); if (mode) a.setSimple(mode === 'sederhana')
    const soap = query.get('soap'); if (soap && s.activeId) a.resetSoap(s.activeId, soap === 'signed')
    const aktif = query.get('aktif')
    if (aktif === '0' || aktif === 'none') a.setActive(null)
    const m = path.match(/^\/pasien\/(RM-\d+)$/)
    if (m) { const p = s.patients.find((x) => x.rm === m[1]); if (p) a.setActive(p.id); go('/keluarga') }
  }, [path, qs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { document.title = 'Bitto' }, [])

  if (path === '/login') return <Login />
  if (path === '/login/totp') return <Totp />
  if (path === '/login/recovery') return <Recovery />
  if (path === '/pin') return <Pin key={query.get('pinTries') ?? '0'} initialTries={Number(query.get('pinTries') ?? 0)} />

  const hidden = s.simple && (path.startsWith('/gambar') || path.startsWith('/kelola'))
  const screen = hidden ? (
    <div className="screen empty"><h2>Modul disembunyikan di Mode sederhana</h2><p>Matikan Mode sederhana di bilah atas untuk membuka modul ini.</p><button className="btn btn-primary" onClick={() => a.setSimple(false)}>Matikan Mode sederhana</button></div>
  ) : ({
    '/jadwal': <Jadwal />,
    '/keluarga': <Keluarga />,
    '/keluarga/baru': <Registrasi />,
    '/tagihan': <Tagihan />,
    '/rencana': <Rencana />,
    '/rencana/presentasi': <PresentasiPasien />,
    '/charting': <Charting soap={false} />,
    '/charting/soap': <Charting soap />,
    '/gambar': <Gambar />,
    '/kelola': <Kelola />,
    '/desain': <Desain />,
    '/alur': <Alur path={path} />,
  } as Record<string, ReactNode>)[path] ?? <div className="screen empty"><h2>Halaman tidak ditemukan</h2><a className="btn btn-primary" href="#/jadwal">Ke Jadwal</a></div>

  return <AppShell path={path}>{screen}</AppShell>
}
