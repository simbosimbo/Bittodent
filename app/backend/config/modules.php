<?php

// Module map. Key = module in app/Modules/<Name> (registered in this order via <Name>ServiceProvider).
// Value = modules whose Contracts/ or Events/ it may use. Every module may use App\Shared; Shared uses no module.
// Nothing may depend on Reporting. Enforced by tests/Feature/ModuleBoundaryTest. Add edges deliberately.
return [
    'Tenancy' => [],
    'Identity' => [],
    'Audit' => ['Identity', 'Tenancy'], // unit 6: actor names + branch timezone for the read-only audit log
    'Patients' => ['Tenancy'],
    'Scheduling' => ['Tenancy', 'Patients', 'Identity'],
    'Clinical' => ['Patients', 'Scheduling', 'Tenancy', 'Identity', 'Integrations'],
    'Intake' => ['Patients'], // pushes medical alerts via Patients\Contracts\MedicalAlerts
    'Queue' => ['Scheduling'],
    'Prescriptions' => ['Patients', 'Clinical'],
    'Tariffs' => ['Tenancy'], // per-dentist price cells: dentist_id must be an active dentist of this tenant
    // Invoice lines are generated from Clinical procedures with a Tariffs price snapshot. Clinical never depends on Billing/Tariffs.
    // C3: payer = guarantor via Patients\Contracts\PatientDirectory. Unit 4: Tenancy = count active owners for the Rp0 approval rule;
    // Billing guards visit close by listening to Clinical\Events\VisitClosing (Clinical never reaches Billing).
    'Billing' => ['Clinical', 'Tariffs', 'Patients', 'Tenancy'],
    'Compensation' => ['Billing', 'Identity'], // reads finalized revenue via Billing\Contracts only
    'Inventory' => [],
    'Recall' => ['Scheduling'], // C3: reminder_log reads appointments via Scheduling\Contracts\AppointmentDirectory
    'Integrations' => [],
    // A0 AI foundation: agent_run/agent_draft + run recorder; reaches models only via Integrations\Contracts\ModelClient.
    'Agents' => ['Integrations'],
    // A3 scribe: dictation aid (D-048). Uses Agents for runs/drafts, Clinical/Patients contracts, Integrations ModelClient.
    'Scribe' => ['Agents', 'Clinical', 'Patients', 'Integrations'],
    // Unit 6 owner integrity report: reads facts only through each module's Contracts (no Models).
    'Reporting' => ['Clinical', 'Billing', 'Scheduling', 'Identity', 'Patients', 'Tenancy'],
];
