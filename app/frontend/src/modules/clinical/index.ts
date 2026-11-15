// Clinical: "Rekam Medis" page (odontogram + SOAP + sign + corrections). Route: #/rekam-medis/<patientId>[/janji/<appointmentId>]
export { default as ChartPage } from './Chart'
// A2 treatment suggestions panel; PR #52 Dokter mode mounts it with { patientId, visitId, onHighlight?, onChanged? }.
export { default as TreatmentSuggestions } from './TreatmentSuggestions'
