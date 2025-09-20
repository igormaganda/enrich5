<?php

namespace App\Models;

use App\Enums\JobStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EnrichmentJob extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'status',
        'input_filename',
        'output_path',
        'total_rows',
        'enriched_rows',
        'blacklisted_rows',
        'error_message',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'total_rows' => 'integer',
        'enriched_rows' => 'integer',
        'blacklisted_rows' => 'integer',
        'status' => JobStatus::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
