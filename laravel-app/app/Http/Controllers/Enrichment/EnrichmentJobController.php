<?php

namespace App\Http\Controllers\Enrichment;

use App\Http\Controllers\Controller;
use App\Models\EnrichmentJob;
use Illuminate\Http\Request;

class EnrichmentJobController extends Controller
{
    public function index(Request $request)
    {
        $jobs = EnrichmentJob::query()
            ->with('user')
            ->orderByDesc('created_at')
            ->paginate(15);

        return response()->json($jobs);
    }

    public function show(EnrichmentJob $job)
    {
        $job->load('user');

        return response()->json($job);
    }
}
