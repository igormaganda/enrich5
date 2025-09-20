<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    $database = true;

    try {
        DB::connection()->getPdo();
    } catch (\Throwable $exception) {
        $database = false;
    }

    return [
        'database' => $database,
        'cache_driver' => config('cache.default'),
        'timestamp' => now()->toIso8601String(),
    ];
});
