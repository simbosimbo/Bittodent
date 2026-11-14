<?php

use App\Bench\BenchServiceProvider;
use App\Providers\AppServiceProvider;

// Module providers (app/Modules/*/<Name>ServiceProvider) are registered from config/modules.php by AppServiceProvider.
return [
    AppServiceProvider::class,
    BenchServiceProvider::class,
];
