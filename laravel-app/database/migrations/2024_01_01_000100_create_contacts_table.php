<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->string('hexacle')->unique();
            $table->string('prenom')->nullable();
            $table->string('nom')->nullable();
            $table->string('email')->nullable();
            $table->string('telephone')->nullable();
            $table->unsignedInteger('age')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
