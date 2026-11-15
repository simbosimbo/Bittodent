// Shape of GET /api/me (the logged-in session), used by the shell and every module.
export type Me = {
  user: { id: string; name: string; email: string }
  roles: string[]
  permissions: string[]
  active: { tenant_id: string; tenant_name: string; branch_id: string | null; branch_name: string | null; timezone: string | null
    /** branch address, else the clinic address (Pengaturan Klinik); null until filled in */
    address?: string | null }
  branches: { id: string; name: string; timezone: string }[]
  /** clinic asks for a PIN at Selesai; whether I already have one (never the PIN itself) */
  selesai?: { pin_required: boolean; has_pin: boolean }
  /** Not sent by /api/me yet: actions (permission names) hidden while a support session impersonates this user. */
  impersonation?: { blocked_actions: string[] }
}

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Pemilik',
  dentist: 'Dokter Gigi',
  assistant: 'Asisten',
  front_desk: 'Resepsionis',
  kasir: 'Kasir',
}
