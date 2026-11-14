<?php

namespace App\Bench\Http;

use App\Bench\Support\FileEnvelope;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

// BENCH-ONLY endpoints (prototype of missing list/audit/imaging APIs). Not a production contract.
class BenchController extends Controller
{
    /** GET /api/bench/invoices?from=Y-m-d&to=Y-m-d — keyset-less page of invoices in a date window (prototype of a billing list). */
    public function invoices(Request $request)
    {
        $d = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);
        $from = ($d['from'] ?? now('Asia/Jakarta')->toDateString()).' 00:00:00';
        $to = ($d['to'] ?? now('Asia/Jakarta')->toDateString()).' 23:59:59';
        $rows = DB::table('invoice')
            ->where('tenant_id', Ctx::current()->tenantId)
            ->where('branch_id', Ctx::current()->branchId)
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('created_at')->orderByDesc('id')
            ->limit(50)
            ->get(['id', 'visit_id', 'patient_id', 'status', 'created_at']);

        return response()->json(['data' => $rows, 'count' => $rows->count()]);
    }

    /** GET /api/bench/audit?entity_type=&entity_id=&days=90 */
    public function audit(Request $request)
    {
        $d = $request->validate([
            'entity_type' => ['required', 'string', 'max:40'],
            'entity_id' => ['required', 'uuid'],
            'days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);
        $days = $d['days'] ?? 90;
        $from = now()->subDays($days);
        $rows = DB::table('audit_event')
            ->where('tenant_id', Ctx::current()->tenantId)
            ->where('entity_type', $d['entity_type'])
            ->where('entity_id', $d['entity_id'])
            ->where('occurred_at', '>=', $from)
            ->orderByDesc('occurred_at')->orderByDesc('id')
            ->limit(100)
            ->get(['id', 'occurred_at', 'actor_id', 'action', 'entity_type', 'entity_id', 'branch_id']);

        return response()->json(['data' => $rows, 'count' => $rows->count(), 'days' => $days]);
    }

    /** POST /api/bench/images — body already lossless-compressed (or a thumb); envelope-encrypted at rest. */
    public function upload(Request $request)
    {
        $d = $request->validate([
            'kind' => ['required', 'in:original,thumb'],
            'codec' => ['required', 'string', 'max:20'],
            'file' => ['required', 'file', 'max:32768'], // 32 MiB
            'sha256' => ['nullable', 'regex:/^[0-9a-f]{64}$/'],
            'width' => ['nullable', 'integer'],
            'height' => ['nullable', 'integer'],
            'bits' => ['nullable', 'integer'],
            'label' => ['nullable', 'string', 'max:80'],
        ]);
        abort_unless(($d['label'] ?? 'SYNTHETIC') === 'SYNTHETIC', 422, 'Bench images must be labeled SYNTHETIC.');
        $plain = file_get_contents($request->file('file')->getRealPath());
        $id = (string) Str::uuid7();
        $tenant = Ctx::current()->tenantId;
        $env = FileEnvelope::encrypt($plain, $tenant, $id, FileEnvelope::masterKeyFromConfig());
        if (! empty($d['sha256']) && ! hash_equals($d['sha256'], $env['sha256'])) {
            return response()->json(['error' => 'hash_mismatch'], 422);
        }
        $dir = storage_path('app/bench-images');
        if (! is_dir($dir)) {
            mkdir($dir, 0770, true);
        }
        file_put_contents($dir.'/'.$id.'.bin', $env['blob']);
        $meta = [
            'id' => $id,
            'tenant_id' => $tenant,
            'kind' => $d['kind'],
            'codec' => $d['codec'],
            'sha256' => $env['sha256'],
            'bytes_plain' => strlen($plain),
            'bytes_envelope' => strlen($env['blob']),
            'width' => $d['width'] ?? null,
            'height' => $d['height'] ?? null,
            'bits' => $d['bits'] ?? null,
            'label' => 'SYNTHETIC',
            'retention_years' => 25,
            'created_at' => now()->toIso8601String(),
        ];
        file_put_contents($dir.'/'.$id.'.json', json_encode($meta, JSON_UNESCAPED_SLASHES));
        Audit::log('unggah', 'image', $id, ['kind' => $d['kind'], 'codec' => $d['codec'], 'bytes' => strlen($env['blob'])]);

        return response()->json($meta, 201);
    }

    public function view(string $id)
    {
        return $this->stream($id, 'original', 'baca');
    }

    public function thumb(string $id)
    {
        return $this->stream($id, 'thumb', 'baca_miniatur');
    }

    private function stream(string $id, string $expectKind, string $action): StreamedResponse
    {
        $dir = storage_path('app/bench-images');
        $metaPath = $dir.'/'.$id.'.json';
        abort_unless(is_file($metaPath), 404);
        $meta = json_decode(file_get_contents($metaPath), true, flags: JSON_THROW_ON_ERROR);
        abort_unless($meta['tenant_id'] === Ctx::current()->tenantId, 404);
        // A thumb route may also stream a file stored as kind=thumb; originals never go out the thumb URL.
        if ($expectKind === 'thumb' && ($meta['kind'] ?? '') !== 'thumb') {
            abort(404);
        }
        $blob = file_get_contents($dir.'/'.$id.'.bin');
        Audit::log($action, 'image', $id, ['kind' => $meta['kind'], 'codec' => $meta['codec']]);
        $tenant = $meta['tenant_id'];
        $sha = $meta['sha256'];
        $key = FileEnvelope::masterKeyFromConfig();

        return response()->stream(function () use ($blob, $tenant, $id, $sha, $key) {
            foreach (FileEnvelope::decryptChunks($blob, $tenant, $id, $sha, $key) as $chunk) {
                echo $chunk;
                if (ob_get_level()) {
                    ob_flush();
                }
                flush();
            }
        }, 200, [
            'Content-Type' => 'application/octet-stream',
            'X-Bench-Image-Id' => $id,
            'X-Bench-Codec' => $meta['codec'],
            'X-Bench-Sha256' => $sha,
            'X-Bench-Label' => 'SYNTHETIC',
            'Cache-Control' => 'no-store',
        ]);
    }
}
