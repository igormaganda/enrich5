<?php

use App\Enums\JobStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('enrichment_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default(JobStatus::Pending->value);
            $table->string('input_filename');
            $table->string('output_path')->nullable();
            $table->unsignedBigInteger('total_rows')->default(0);
            $table->unsignedBigInteger('enriched_rows')->default(0);
            $table->unsignedBigInteger('blacklisted_rows')->default(0);
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrichment_jobs');
    }
};
