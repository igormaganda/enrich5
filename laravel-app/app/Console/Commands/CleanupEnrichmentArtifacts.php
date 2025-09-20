<?php

namespace App\Console\Commands;

use App\Models\EnrichmentJob;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class CleanupEnrichmentArtifacts extends Command
{
    protected $signature = 'enrichment:cleanup {--force : Supprime sans confirmation}';

    protected $description = "Supprime les archives et dossiers temporaires expirés";

    public function handle(): int
    {
        $retention = (int) config('enrichment.retention_days', 1);
        $threshold = Carbon::now()->subDays($retention);

        $expiredJobs = EnrichmentJob::where('created_at', '<', $threshold)->get();

        $diskName = config('enrichment.output_disk', config('filesystems.default'));
        if (! $diskName || ! config("filesystems.disks.$diskName")) {
            $this->warn('Aucun disque valide configuré pour l\'archivage.');
            return self::SUCCESS;
        }

        $disk = Storage::disk($diskName);

        foreach ($expiredJobs as $job) {
            if ($job->output_path && $disk->exists($job->output_path)) {
                $disk->delete($job->output_path);
                $this->info("Archive supprimée pour le job {$job->id}");
            }
        }

        return self::SUCCESS;
    }
}
