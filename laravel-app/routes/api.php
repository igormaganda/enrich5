<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Enrichment\EnrichmentJobController;
use App\Http\Controllers\Enrichment\UploadController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::post('/login', [AuthenticatedSessionController::class, 'store']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);

    Route::post('/uploads', [UploadController::class, 'store']);
    Route::get('/jobs', [EnrichmentJobController::class, 'index']);
    Route::get('/jobs/{job}', [EnrichmentJobController::class, 'show']);
});
