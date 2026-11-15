<?php

// Module map. Key = module in app/Modules/<Name> (registered in this order via <Name>ServiceProvider).
// Value = modules whose Contracts/ or Events/ it may use. Every module may use App\Shared; Shared uses no module.
// Nothing may depend on Reporting. Enforced by tests/Feature/ModuleBoundaryTest. Add edges deliberately.
return [
    'Tenancy' => [],
    'Identity' => [],
    'Audit' => [],
    'Patients' => ['Tenancy'],
    'Scheduling' => ['Tenancy', 'Patients', 'Identity'],
    'Clinical' => ['Patients', 'Scheduling', 'Tenancy', 'Identity', 'Integrations'],
    'Intake' => ['Patients'], // pushes medical alerts via Patients\Contracts\MedicalAlerts
    'Queue' => ['Scheduling'],
    'Prescriptions' => ['Patients', 'Clinical'],
    'Tariffs' => [],
    // Invoice lines are generated from Clinical procedures with a Tariffs price snapshot. Clinical never depends on Billing/Tariffs.
    'Billing' => ['Clinical', 'Tariffs', 'Patients'], // C3: payer = guarantor via Patients\Contracts\PatientDirectory
    'Compensation' => ['Billing', 'Identity'], // reads finalized revenue via Billing\Contracts only
    'Inventory' => [],
    'Recall' => ['Scheduling'], // C3: reminder_log reads appointments via Scheduling\Contracts\AppointmentDirectory
    'Integrations' => [],
    // A0 AI foundation: agent_run/agent_draft + run recorder; reaches models only via Integrations\Contracts\ModelClient.
    'Agents' => ['Integrations'],
    // A1: ICD-10 / ICD-9-CM suggestions. Clinical only via VisitCoding (codes on the DRAFT SOAP), Agents for runs/drafts.
    'IcdSuggestions' => ['Clinical', 'Agents'],
    'Reporting' => [],
];
