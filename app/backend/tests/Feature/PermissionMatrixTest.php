<?php

namespace Tests\Feature;

use App\Modules\Billing\Models\Invoice;
use App\Modules\Scheduling\Models\Appointment;
use App\Modules\Tenancy\Models\Branch;
use App\Shared\Tenancy\Ctx;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PermissionMatrixTest extends TestCase
{
    public static function matrix(): array
    {
        // [email, method, route key, expected allowed]
        $rows = [];
        $routes = ['patient.read' => 'GET patients', 'patient.create' => 'POST patients', 'note.read' => 'GET notes',
            'appointment.read' => 'GET schedule', 'appointment.create' => 'POST appointments', 'appointment.transition' => 'POST transition',
            'billing.read' => 'GET invoice', 'appointment.confirm' => 'POST confirm'];
        $allowed = [
            'pemilik@senyum.test' => ['patient.read', 'patient.create', 'note.read', 'appointment.read', 'appointment.create', 'appointment.transition', 'billing.read', 'appointment.confirm'],
            'dokter@senyum.test' => ['patient.read', 'patient.create', 'note.read', 'appointment.read', 'appointment.create', 'appointment.transition', 'appointment.confirm'],
            'asisten@senyum.test' => ['patient.read', 'note.read', 'appointment.read', 'appointment.transition'],
            'depan@senyum.test' => ['patient.read', 'patient.create', 'appointment.read', 'appointment.create', 'appointment.transition', 'billing.read', 'appointment.confirm'],
            'kasir@senyum.test' => ['patient.read', 'appointment.read', 'billing.read'],
        ];
        foreach ($allowed as $email => $perms) {
            foreach ($routes as $perm => $route) {
                $rows["$email $route"] = [$email, $route, in_array($perm, $perms, true)];
            }
        }

        return $rows;
    }

    #[DataProvider('matrix')]
    public function test_permission_matrix(string $email, string $route, bool $allowed): void
    {
        $a = $this->tenantA()->id;
        [$p, $branch, $appt] = Ctx::runAs($a, fn () => [$this->patientOf($this->tenantA()),
            Branch::orderBy('name')->firstOrFail(), Appointment::where('status', 'booked')->orderBy('starts_at')->firstOrFail()]);
        [$method, $path, $body] = match ($route) {
            'GET patients' => ['GET', '/api/patients', []],
            'POST patients' => ['POST', '/api/patients', ['name' => 'Uji Matriks']],
            'GET notes' => ['GET', "/api/patients/{$p->id}/chart", []],
            'GET schedule' => ['GET', "/api/schedule?branch_id={$branch->id}&date=2026-11-14", []],
            'POST appointments' => ['POST', '/api/appointments', ['patient_id' => $p->id, 'chair_id' => $appt->chair_id,
                'dentist_id' => $appt->dentist_id, 'starts_at' => '2030-01-01T02:00:00Z', 'ends_at' => '2030-01-01T02:30:00Z']],
            'POST transition' => ['POST', "/api/appointments/{$appt->id}/transition", ['to' => 'checked_in']],
            // confirm a pending online booking (seeded BK-DEMO01) = transition pending_confirmation -> booked
            'POST confirm' => ['POST', '/api/appointments/'.Ctx::runAs($a, fn () => Appointment::where('booking_code', 'BK-DEMO01')->value('id')).'/transition', ['to' => 'booked']],
            'GET invoice' => ['GET', '/api/invoices/'.Ctx::runAs($a, fn () => Invoice::orderBy('created_at')->firstOrFail()->id), []],
        };
        $status = $this->as($email)->json($method, $path, $body)->status();
        $allowed ? $this->assertContains($status, [200, 201], "$email $route") : $this->assertSame(403, $status, "$email $route");
    }
}
