<?php

namespace App\Http\Controllers\Enrichment;

use App\Enums\JobStatus;
use App\Http\Controllers\Controller;
use App\Jobs\ProcessEnrichmentJob;
use App\Models\EnrichmentJob;
use Illuminate\Http\Request;

class UploadController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'archive' => ['required', 'file', 'mimes:zip'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $path = $request->file('archive')->store('uploads');

        $job = EnrichmentJob::create([
            'user_id' => $request->user()->id,
            'status' => JobStatus::Pending,
            'input_filename' => $request->file('archive')->getClientOriginalName(),
            'metadata' => [
                'label' => $validated['label'] ?? null,
                'disk_path' => $path,
            ],
        ]);

        ProcessEnrichmentJob::dispatch($job, $path);

        return response()->json([
            'message' => 'Traitement lancé',
            'job_id' => $job->id,
        ], 202);
    }
}
