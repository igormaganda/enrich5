<?php

namespace Database\Seeders;

use App\Models\BlacklistEntry;
use App\Models\Contact;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@company.com'],
            [
                'name' => 'Administrateur',
                'password' => Hash::make('password'),
                'role' => 'admin',
            ]
        );

        Contact::factory()->count(20)->create();

        BlacklistEntry::factory()->count(5)->create();
    }
}
