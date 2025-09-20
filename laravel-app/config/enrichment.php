<?php

return [
    'supported_files' => [
        'Referentiel_Zone_FTTH_%s.csv',
        'Referentiel_Zone_4GBOX_%s.csv',
        'Referentiel_mobile_%s.csv',
        'Blacklist_mobile_%s.csv',
    ],
    'chunk_size' => env('ENRICHMENT_CHUNK_SIZE', 500),
    'retention_days' => env('ENRICHMENT_RETENTION_DAYS', 1),
    'output_disk' => env('ENRICHMENT_OUTPUT_DISK', env('FILESYSTEM_DISK', 'local')),
    'cloud_disk' => env('ENRICHMENT_CLOUD_DISK', 'r2'),
    'cloud_prefix' => env('CLOUD_R2_PREFIX', 'enriched'),
];
