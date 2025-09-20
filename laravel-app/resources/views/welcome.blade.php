<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name') }}</title>
    <link rel="stylesheet" href="https://unpkg.com/@tailwindcss/ui/dist/tailwind-ui.min.css">
</head>
<body class="bg-gray-900 text-white">
    <section class="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 class="text-4xl font-bold mb-6">Pipeline d'enrichissement Laravel</h1>
        <p class="text-lg max-w-2xl text-center">
            Cette application Laravel 11 orchestre l'upload, l'enrichissement et la distribution de référentiels CSV
            au format FTTH, 4GBOX et Mobile. Toutes les opérations sont historisées dans PostgreSQL et peuvent être
            supervisées via l'API REST.
        </p>
        <p class="mt-6 text-sm text-gray-400">Consultez la documentation de l'API pour démarrer.</p>
    </section>
</body>
</html>
