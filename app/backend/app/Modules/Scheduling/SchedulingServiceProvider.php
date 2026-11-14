<?php

namespace App\Modules\Scheduling;

use App\Modules\Scheduling\Contracts\AppointmentDirectory;
use App\Modules\Scheduling\Contracts\OtpSender;
use App\Modules\Scheduling\Services\AppointmentDirectoryService;
use App\Modules\Scheduling\Services\FakeOtpSender;
use App\Modules\Scheduling\Services\LogOtpSender;
use App\Shared\Crypto\Crypto;
use App\Shared\ModuleServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class SchedulingServiceProvider extends ModuleServiceProvider
{
    public array $bindings = [AppointmentDirectory::class => AppointmentDirectoryService::class];

    public function register(): void
    {
        $this->app->bind(OtpSender::class, fn ($app) => config('ehr.booking.otp_driver') === 'fake' && ! $app->isProduction()
            ? new FakeOtpSender : new LogOtpSender);
    }

    public function boot(): void
    {
        parent::boot();
        // Public booking page. Keys never hold a phone number in clear (blind index).
        RateLimiter::for('booking', fn (Request $r) => Limit::perMinute(60)->by('ip:'.$r->ip()));
        RateLimiter::for('booking-otp', function (Request $r) {
            $phone = Crypto::normalizePhone($r->input('phone'));

            return [
                Limit::perMinute(10)->by('otp-ip:'.$r->ip()),
                Limit::perHour(5)->by('otp:'.($phone ? Crypto::blindIndex($phone) : 'c:'.$r->input('challenge_id'))),
            ];
        });
    }
}
