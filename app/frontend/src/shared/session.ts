// Shape of GET /api/me (the logged-in session), used by the shell and every module.
export type Me = {
  user: { id: string; name: string; email: string }
  roles: string[]
  permissions: string[]
  active: { tenant_id: string; tenant_name: string; branch_id: string | null; branch_name: string | null; timezone: string | null }
  branches: { id: string; name: string; timezone: string }[]
  /** clinic asks for a PIN at Selesai; whether I already have one (never the PIN itself) */
  selesai?: { pin_required: boolean; has_pin: boolean }
  /** DEVIATIONS #61: a platform admin is acting as this user (banner + blocked actions); active=false otherwise */
  impersonation?: { active: false } | { active: true; platform_admin_name: string; started_at: string; blocked_actions: string[] }
}

// Blocked action (server flag) -> the permission whose buttons it hides. The server answers 403 anyway (not_impersonating).
const HIDES: Record<string, string> = {
  selesai: 'note.sign', approve_drafts: 'note.sign', addendum: 'note.sign', procedure_sign: 'note.sign',
  procedure_correction: 'note.sign', pin: 'note.sign', correction_decision: 'correction.approve',
}

/** While impersonating, drop the permissions behind blocked actions so every gated button hides. */
export function applyImpersonation(me: Me): Me {
  if (!me.impersonation?.active) return me
  const hidden = me.impersonation.blocked_actions.map((a) => HIDES[a]).filter(Boolean)
  return { ...me, permissions: me.permissions.filter((p) => !hidden.includes(p)) }
}

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Pemilik',
  dentist: 'Dokter Gigi',
  assistant: 'Asisten',
  front_desk: 'Resepsionis',
  kasir: 'Kasir',
}
