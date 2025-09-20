<?php

use App\Jobs\ProcessEnrichmentJob;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

it('launches an enrichment job after upload', function () {
    Queue::fake();
    Storage::fake('local');

    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $archive = UploadedFile::fake()->create('referentiels.zip', 10, 'application/zip');

    $response = $this->postJson('/api/uploads', [
        'archive' => $archive,
    ]);

    $response->assertStatus(202);

    Queue::assertPushed(ProcessEnrichmentJob::class);
});
