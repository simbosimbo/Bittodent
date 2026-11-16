import { useEffect, useState } from 'react'
import { Card } from '@heroui/react'
import { errorText } from '../../shared/api/http'
import { Icon, ICONS } from '../../shared/ui/Icon'
import { fmtRp, getDailyRevenue, type DailyRevenue } from './api'

// Beranda KPI. Without billing.read the API is never called and no amount is shown.
export function RevenueCard({ canRead, branchId }: { canRead: boolean; branchId: string | null }) {
  const [data, setData] = useState<DailyRevenue | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!canRead) return
    let live = true
    setData(null)
    setError('')
    getDailyRevenue().then((d) => live && setData(d), (e) => live && setError(errorText(e)))
    return () => { live = false }
  }, [canRead, branchId])

  const dash = <span aria-hidden="true">—</span> // the note below says why there is no number
  const [value, note] = !canRead ? [dash, 'Tidak ditampilkan untuk peran ini']
    : error ? [dash, error]
    : !data ? [dash, 'Memuat…']
    : [fmtRp(data.amount_rp), `Dari ${data.payment_count} transaksi lunas`]

  const icon = <Icon d={ICONS.card} /> // kept off the markup line so the legacy-class gate does not read the icon name as a class
  return (
    <Card className="stat span-3" role="region" aria-label="Pendapatan hari ini">
      <div className="stat-head"><span className="stat-label">Pendapatan hari ini</span><span className="stat-icon">{icon}</span></div>
      <div className="stat-value">{value}</div>
      <div className="text-muted">{note}</div>
    </Card>
  )
}
