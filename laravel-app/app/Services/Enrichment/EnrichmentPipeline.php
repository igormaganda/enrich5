<?php

namespace App\Services\Enrichment;

use App\Enums\JobStatus;
use App\Models\BlacklistEntry;
use App\Models\Contact;
use App\Models\EnrichmentJob;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;

class EnrichmentPipeline
{
    public function handle(EnrichmentJob $job, string $archivePath): string
    {
        $job->update(['status' => JobStatus::Running]);

        $temporaryDir = storage_path('app/tmp/job-'.$job->id);
        File::ensureDirectoryExists($temporaryDir);

        $extractPath = $temporaryDir.'/extracted';
        File::ensureDirectoryExists($extractPath);

        $zip = new ZipArchive();
        if ($zip->open($archivePath) !== true) {
            throw new \RuntimeException('Impossible d\'ouvrir l\'archive transmise');
        }

        $zip->extractTo($extractPath);
        $zip->close();

        [$datasets, $blacklist] = $this->categorizeFiles($extractPath);

        $blacklistedNumbers = $this->loadBlacklist($blacklist);

        $stats = [
            'total' => 0,
            'enriched' => 0,
            'blacklisted' => 0,
        ];

        $outputDirectory = storage_path('app/enriched/job-'.$job->id);
        File::ensureDirectoryExists($outputDirectory);

        foreach ($datasets as $datasetFile) {
            $result = $this->enrichDataset($datasetFile, $blacklistedNumbers, $outputDirectory);
            $stats['total'] += $result['total'];
            $stats['enriched'] += $result['enriched'];
            $stats['blacklisted'] += $result['blacklisted'];
        }

        $archiveRelativePath = 'archives/job-'.$job->id.'-'.Str::random(8).'.zip';
        $archiveFullPath = storage_path('app/'.$archiveRelativePath);
        File::ensureDirectoryExists(dirname($archiveFullPath));

        $outputArchive = new ZipArchive();
        $outputArchive->open($archiveFullPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        foreach (File::files($outputDirectory) as $file) {
            $outputArchive->addFile($file->getPathname(), $file->getFilename());
        }

        $outputArchive->close();

        $this->pushToCloud($archiveRelativePath);

        $metadata = $job->metadata ?? [];
        $metadata['datasets'] = array_map('basename', $datasets);

        $job->update([
            'status' => JobStatus::Completed,
            'output_path' => $archiveRelativePath,
            'total_rows' => $stats['total'],
            'enriched_rows' => $stats['enriched'],
            'blacklisted_rows' => $stats['blacklisted'],
            'metadata' => $metadata,
        ]);

        File::deleteDirectory($temporaryDir);

        return $archiveRelativePath;
    }

    protected function categorizeFiles(string $directory): array
    {
        $datasets = [];
        $blacklist = null;

        foreach (File::allFiles($directory) as $file) {
            $lower = Str::lower($file->getFilename());
            if (Str::contains($lower, 'blacklist')) {
                $blacklist = $file->getPathname();
                continue;
            }
            if ($file->getExtension() === 'csv') {
                $datasets[] = $file->getPathname();
            }
        }

        if (! $blacklist) {
            $fallback = storage_path('app/tmp/blacklist-cache.csv');
            if (File::exists($fallback)) {
                $blacklist = $fallback;
            }
        }

        return [$datasets, $blacklist];
    }

    protected function loadBlacklist(?string $path): array
    {
        if (! $path || ! File::exists($path)) {
            return BlacklistEntry::pluck('telephone')->all();
        }

        $numbers = [];

        if (($handle = fopen($path, 'r')) !== false) {
            $header = null;
            while (($row = fgetcsv($handle, 0, ';')) !== false) {
                if (! $header) {
                    $header = array_map('strtoupper', $row);
                    continue;
                }
                $record = $this->mapRow($header, $row);
                $numbers[] = Arr::get($record, 'TELEPHONE') ?? Arr::get($record, 'NUMERO');
            }
            fclose($handle);
        }

        return array_filter(array_unique(array_merge($numbers, BlacklistEntry::pluck('telephone')->all())));
    }

    protected function enrichDataset(string $path, array $blacklistedNumbers, string $outputDirectory): array
    {
        $total = $enriched = $blacklisted = 0;
        $outputPath = $outputDirectory.'/'.basename($path);

        $input = fopen($path, 'r');
        $output = fopen($outputPath, 'w');

        if (! $input || ! $output) {
            throw new \RuntimeException('Impossible de lire ou d\'écrire le fichier '.$path);
        }

        $header = null;
        while (($row = fgetcsv($input, 0, ';')) !== false) {
            if (! $header) {
                $header = array_map('strtoupper', $row);
                $extendedHeader = array_merge($row, ['prenom', 'nom', 'email', 'telephone_interne']);
                fputcsv($output, $extendedHeader, ';');
                continue;
            }

            $total++;
            $record = $this->mapRow($header, $row);
            $hexacle = Arr::get($record, 'HEXACLE') ?? Arr::get($record, 'ID_HEXACLE');

            $contact = $hexacle ? Contact::where('hexacle', $hexacle)->first() : null;
            $telephone = $contact?->telephone ?? Arr::get($record, 'TELEPHONE');
            $isBlacklisted = $telephone && in_array($telephone, $blacklistedNumbers, true);

            if ($isBlacklisted) {
                $blacklisted++;
                continue;
            }

            if ($contact) {
                $enriched++;
                $row = array_merge($row, [
                    $contact->prenom,
                    $contact->nom,
                    $contact->email,
                    $contact->telephone,
                ]);
            } else {
                $row = array_merge($row, [null, null, null, null]);
            }

            fputcsv($output, $row, ';');
        }

        fclose($input);
        fclose($output);

        return [
            'total' => $total,
            'enriched' => $enriched,
            'blacklisted' => $blacklisted,
        ];
    }

    protected function mapRow(array $header, array $row): array
    {
        $record = [];
        foreach ($header as $index => $column) {
            $record[$column] = $row[$index] ?? null;
        }

        return $record;
    }

    protected function pushToCloud(string $archiveRelativePath): void
    {
        $disk = config('enrichment.cloud_disk');
        if (! $disk || ! config("filesystems.disks.$disk")) {
            return;
        }

        $storage = Storage::disk($disk);

        $contents = File::get(storage_path('app/'.$archiveRelativePath));
        $target = trim(config('enrichment.cloud_prefix'), '/').'/'.basename($archiveRelativePath);

        try {
            $storage->put($target, $contents);
        } catch (\Throwable $exception) {
            Log::warning('Upload R2 échoué: '.$exception->getMessage());
        }
    }
}
