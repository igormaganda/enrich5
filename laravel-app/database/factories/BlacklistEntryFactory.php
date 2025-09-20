<?php

namespace Database\Factories;

use App\Models\BlacklistEntry;
use Illuminate\Database\Eloquent\Factories\Factory;

class BlacklistEntryFactory extends Factory
{
    protected $model = BlacklistEntry::class;

    public function definition(): array
    {
        return [
            'telephone' => $this->faker->numerify('07########'),
            'reason' => $this->faker->randomElement(['RGPD', 'Opposition', 'Client']),
        ];
    }
}
