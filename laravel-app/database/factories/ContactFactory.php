<?php

namespace Database\Factories;

use App\Models\Contact;
use Illuminate\Database\Eloquent\Factories\Factory;

class ContactFactory extends Factory
{
    protected $model = Contact::class;

    public function definition(): array
    {
        return [
            'hexacle' => strtoupper($this->faker->lexify('HEX???')), 
            'prenom' => $this->faker->firstName(),
            'nom' => $this->faker->lastName(),
            'email' => $this->faker->safeEmail(),
            'telephone' => $this->faker->numerify('06########'),
            'age' => $this->faker->numberBetween(18, 80),
        ];
    }
}
