import { useEffect, useState } from 'react'

// Router hash mini: "#/charting/soap?soap=signed".
export interface Route { path: string; query: URLSearchParams }
const read = (): Route => {
  const raw = location.hash.replace(/^#/, '') || '/jadwal'
  const [path, qs = ''] = raw.split('?')
  const query = new URLSearchParams(location.search)
  new URLSearchParams(qs).forEach((v, k) => query.set(k, v))
  return { path: path.replace(/\/$/, '') || '/jadwal', query }
}
export function useRoute() {
  const [r, setR] = useState(read)
  useEffect(() => {
    const f = () => { setR(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}
export const go = (path: string) => { location.hash = path }
