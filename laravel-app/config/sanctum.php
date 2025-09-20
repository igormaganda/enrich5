<?php

return [
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:80,localhost:8000,localhost:8080,',
        parse_url(env('APP_URL', 'http://localhost'), PHP_URL_HOST)
    ))),

    'guard' => ['web'],

    'expiration' => env('SANCTUM_EXPIRATION'),

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),
];
