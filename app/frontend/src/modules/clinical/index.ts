// Clinical: "Rekam Medis" page (odontogram + SOAP + Selesai + corrections); "Pengaturan RM" (#/pengaturan-rm). Route: #/rekam-medis/<patientId>[/janji/<appointmentId>]
export { default as ChartPage } from './Chart'
export { CorrectionApprovals } from './CorrectionApprovals'
export { default as SettingsRmPage } from './SettingsRm'
// Pengaturan > Harga: which odontogram condition codes each clinic procedure code records (a finished entry bills the mapped code)
export { getCatalog, setCatalogConditions, type CatalogRow } from './api'
export { startWalkInVisit } from './api' // Jadwal "Pasien datang": front desk registers a walk-in (visit.register)
export { TAXONOMY as ODONTOGRAM_TAXONOMY } from './odontogram/taxonomy'
export { SymbolIcon } from './odontogram/symbols'
