<?php

namespace Database\Factories;

use App\Enums\JobStatus;
use App\Models\EnrichmentJob;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class EnrichmentJobFactory extends Factory
{
    protected $model = EnrichmentJob::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'status' => JobStatus::Completed,
            'input_filename' => $this->faker->filePath(),
            'output_path' => 'archives/example.zip',
            'total_rows' => $this->faker->numberBetween(100, 1000),
            'enriched_rows' => $this->faker->numberBetween(80, 900),
            'blacklisted_rows' => $this->faker->numberBetween(0, 50),
            'metadata' => [],
        ];
    }
}
