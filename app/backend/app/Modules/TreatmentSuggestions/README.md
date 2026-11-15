# TreatmentSuggestions (A2)

Rule-based treatment suggestions from the odontogram. No AI model: `agent_run.generator = deterministik`.

- **Rules** (`treatment_rule`): per clinic, append-only, versioned per `rule_key`. Condition (+ optional surfaces) -> procedure code
  that must exist in the clinic's tariff list (`Tariffs\Contracts\ProcedureCatalog`, names only, never prices).
  Starting set: `Domain\RuleTemplate` (synthetic, same codes as `Tariffs\Domain\DifficultyTemplate`).
- **Engine** (`Services\SuggestionEngine`): pure. Only current final findings with status `kondisi_pantau`; one procedure per tooth;
  skips a tooth that already has that procedure planned/done/referred and surfaces the dentist is drafting. Each item cites
  finding id + version. Order: rule priority, then how often this dentist approved the rule (signal only), then tooth.
- **Storage**: one `agent_draft` (kind `saran_tindakan`, target visit) per item via `Agents\Contracts\AgentDrafts`.
  `DraftKind::ownFlow()` keeps them off the generic `/api/ai-drafts` endpoints.
- **Approve**: `AgentDrafts::approve` + `Clinical\Contracts\TreatmentPlan::addPlannedDraft` in one transaction. On main that adds
  draft `tooth_finding` rows (status `direncanakan`, source `ai_draft`, procedure code on the first surface only) that the dentist
  signs with the visit. Never a signature, never a clinical note. Reject = reason code as feedback.

Endpoints (perm `ai_draft.review`, dentist): `GET /api/visits/{id}/treatment-suggestions`, `GET /api/patients/{id}/treatment-suggestions`,
`POST /api/treatment-suggestions/{id}/approve|reject`, `POST /api/visits/{id}/treatment-suggestions/approve-all`.
Rules (perm `treatment_rule.manage`, dentist): `GET|POST /api/treatment-rules`.
