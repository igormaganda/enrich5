<?php

namespace App\Mail;

use App\Models\EnrichmentJob;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EnrichmentCompletedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public EnrichmentJob $job)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Votre enrichissement est terminé',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.enrichment-completed',
            with: [
                'job' => $this->job,
            ],
        );
    }
}
