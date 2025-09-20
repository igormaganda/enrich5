<?php

namespace App\Jobs;

use App\Enums\JobStatus;
use App\Mail\EnrichmentCompletedMail;
use App\Models\EnrichmentJob;
use App\Services\Enrichment\EnrichmentPipeline;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ProcessEnrichmentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $connection = 'database';

    public function __construct(protected EnrichmentJob $job, protected string $archivePath)
    {
        $this->onQueue('enrichment');
    }

    public function handle(EnrichmentPipeline $pipeline): void
    {
        $localPath = Storage::disk('local')->path($this->archivePath);

        try {
            $pipeline->handle($this->job, $localPath);

            if ($this->job->user?->email) {
                Mail::to($this->job->user->email)->send(new EnrichmentCompletedMail($this->job));
            }
        } catch (Throwable $exception) {
            $this->job->update([
                'status' => JobStatus::Failed,
                'error_message' => $exception->getMessage(),
            ]);

            throw $exception;
        } finally {
            Storage::disk('local')->delete($this->archivePath);
        }
    }
}
