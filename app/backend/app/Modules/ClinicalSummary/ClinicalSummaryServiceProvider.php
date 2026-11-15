<?php

namespace App\Modules\ClinicalSummary;

use App\Shared\ModuleServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

// AI medical summary for the treating dentist (docs/ai/ringkasan-rekam-medis.md). A reading aid, never a medical record:
// stored only as agent_draft kind `ringkasan` (never approvable, purged after expiry). Nothing depends on this module.
class ClinicalSummaryServiceProvider extends ModuleServiceProvider
{
    public function boot(): void
    {
        parent::boot();
        // Design 5.7 (starting numbers): 10/min per user and 200/day per tenant.
        RateLimiter::for('ai-summary', fn (Request $r) => [
            Limit::perMinute(10)->by('ai-summary:u:'.$r->user()?->getAuthIdentifier())
                ->response(fn () => response()->json(['error' => 'rate_limited', 'message' => 'Terlalu banyak permintaan ringkasan. Coba lagi sebentar.'], 429)),
            Limit::perDay(200)->by('ai-summary:t:'.$r->session()->get('tenant_id'))
                ->response(fn () => response()->json(['error' => 'rate_limited', 'message' => 'Batas harian ringkasan klinik tercapai.'], 429)),
        ]);
    }
}
