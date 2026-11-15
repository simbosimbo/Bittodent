import { useEffect, useState } from 'react'
import { api } from './api/http'

// Kop (boards KL05/KL09/KL11): one logo + clinic name for every branch, address/phone of the given branch, NPWP and licence.
// Read by every clinic role (GET /api/clinic/letterhead); cached for the page life, refreshed after the owner saves the profile.
export type Letterhead = { name: string; phone: string | null; email: string | null; npwp: string | null; license_no: string | null
  receipt_paper_mm: 58 | 80; has_logo: boolean; branches: { id: string; name: string; address: string | null; phone: string | null }[] }
let cache: Promise<Letterhead> | null = null
export const loadLetterhead = (fresh = false) =>
  (cache && !fresh ? cache : (cache = api<Letterhead>('/api/clinic/letterhead').catch((e) => { cache = null; throw e })))
export function useLetterhead() {
  const [l, setL] = useState<Letterhead | null>(null)
  useEffect(() => { loadLetterhead().then(setL, () => setL(null)) }, [])
  return l
}

export function Kop({ l, branchId, logoVersion = 0 }: { l: Letterhead; branchId: string | null; logoVersion?: number }) {
  const b = l.branches.find((x) => x.id === branchId)
  const contact = [(b?.phone ?? l.phone) && `Tel ${b?.phone ?? l.phone}`, l.npwp && `NPWP ${l.npwp}`].filter(Boolean).join(' · ')
  return (
    <div className="kop">
      {l.has_logo && <img src={`/api/clinic/logo?v=${logoVersion}`} alt="" className="kop-logo" />}
      <div>
        <strong>{l.name}</strong>
        {b?.address && <div className="small">{b.address}</div>}
        {contact && <div className="small">{contact}</div>}
        {l.license_no && <div className="small">Izin {l.license_no}</div>}
      </div>
    </div>
  )
}
