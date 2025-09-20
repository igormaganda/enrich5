@php($job = $job ?? $enrichmentJob ?? null)
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Enrichissement terminé</title>
</head>
<body>
    <h1>Votre enrichissement est disponible</h1>
    <p>Le traitement du fichier <strong>{{ $job?->input_filename }}</strong> est terminé.</p>
    <ul>
        <li>Total lignes : {{ $job?->total_rows }}</li>
        <li>Lignes enrichies : {{ $job?->enriched_rows }}</li>
        <li>Lignes blacklistées : {{ $job?->blacklisted_rows }}</li>
    </ul>
    @if($job?->output_path)
        <p>Archive disponible sur le disque configuré : {{ $job->output_path }}</p>
    @endif
</body>
</html>
