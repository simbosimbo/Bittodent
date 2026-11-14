import { api } from '../../shared/api/http'

export type DailyRevenue = { date: string; branch_id: string; amount_rp: number; payment_count: number }

// Payments collected today (Asia/Jakarta) in the active branch (server-side session); integer rupiah.
export const getDailyRevenue = () => api<DailyRevenue>('/api/billing/daily-revenue')

export const fmtRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
