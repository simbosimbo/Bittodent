// Medical-alert ribbon: only on a screen about ONE patient, and only for the patient in the URL. Never derived from the
// "active patient" (last viewed), which would show someone else's allergies on Pasien Baru, lists or another patient.
// Rekam Medis shows the same alerts in its own patient header, so it has no shell ribbon.
export function ribbonPatientId(hash: string): string | null {
  const m = hash.match(/^\/(pasien|keluarga|riwayat-medis)\/([\w-]+)$/)
  return m && m[2] !== 'baru' ? m[2] : null
}
