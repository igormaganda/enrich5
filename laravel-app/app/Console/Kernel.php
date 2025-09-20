<?php

namespace App\Console;

use App\Console\Commands\CleanupEnrichmentArtifacts;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected $commands = [
        CleanupEnrichmentArtifacts::class,
    ];

    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('enrichment:cleanup')->dailyAt('01:00');
    }

    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');
    }
}
