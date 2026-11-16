<?php

namespace App\Modules\Audit\Http\Controllers;

use App\Modules\Identity\Contracts\UserDirectory;
use App\Modules\Tenancy\Contracts\TenancyDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Audit\AuditEvent;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

// Unit 6: read-only view of the append-only audit_event (perm audit.read = owner). There is deliberately no update/delete route;
// the DB refuses it too (MySQL triggers + ehr_app grants). Rows already hold metadata only; nothing is decrypted here.
class AuditEventController extends Controller
{
    /** GET /api/audit-events?from=&to=&actor_id=&action=&entity_type=&page= newest first, 50 per page */
    public function index(Request $request, UserDirectory $users, TenancyDirectory $tenancy)
    {
        $d = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'actor_id' => ['nullable', 'uuid'],
            'action' => ['nullable', 'string', 'max:40'],
            'entity_type' => ['nullable', 'string', 'max:40'],
        ]);
        $tz = $tenancy->branchOrFail(Ctx::current()->branchId)['timezone'] ?: 'Asia/Jakarta';
        $branches = Ctx::current()->branchIds;
        $page = AuditEvent::query()
            ->when(isset($d['from']), fn ($q) => $q->where('occurred_at', '>=', CarbonImmutable::parse($d['from'], $tz)->startOfDay()->utc()))
            ->when(isset($d['to']), fn ($q) => $q->where('occurred_at', '<', CarbonImmutable::parse($d['to'], $tz)->addDay()->startOfDay()->utc()))
            ->when(isset($d['actor_id']), fn ($q) => $q->where('actor_id', $d['actor_id']))
            ->when(isset($d['action']), fn ($q) => $q->where('action', $d['action']))
            ->when(isset($d['entity_type']), fn ($q) => $q->where('entity_type', $d['entity_type']))
            ->when($branches !== null, fn ($q) => $q->where(fn ($q) => $q->whereNull('branch_id')->orWhereIn('branch_id', $branches)))
            ->orderByDesc('occurred_at')->orderByDesc('id')->paginate(50);
        $names = array_column($users->namesByIds($page->getCollection()->pluck('actor_id')->filter()->unique()->values()->all()), 'name', 'id');
        Audit::log('audit_dibuka', 'audit_event', null, array_intersect_key($d, array_flip(['from', 'to', 'action', 'entity_type'])) + ['page' => $page->currentPage()]);

        return response()->json([
            'data' => $page->getCollection()->map(fn ($e) => ['id' => $e->id, 'occurred_at' => $e->occurred_at?->toIso8601ZuluString(),
                'actor_type' => $e->actor_type, 'actor_id' => $e->actor_id, 'actor_name' => $names[$e->actor_id] ?? null, 'action' => $e->action,
                'entity_type' => $e->entity_type, 'entity_id' => $e->entity_id, 'branch_id' => $e->branch_id, 'detail' => $e->detail])->values(),
            'page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => $page->perPage(),
        ]);
    }
}
