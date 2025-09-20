<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthenticatedSessionController extends Controller
{
    public function store(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            return response()->json(['message' => 'Identifiants invalides'], 422);
        }

        $request->session()->regenerate();

        $token = $request->user()->createToken('api');

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => $request->user(),
        ]);
    }

    public function destroy(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Déconnecté']);
    }
}
