<?php

use App\Http\Controllers\AiAnalystController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::inertia('dashboard', 'dashboard')->name('dashboard');

Route::prefix('api/ai')->group(function () {
    Route::post('site-assessment', [AiAnalystController::class, 'assessParcel'])->name('ai.parcel.assessment');
    Route::post('ask-analyst', [AiAnalystController::class, 'askAnalyst'])->name('ai.analyst.ask');
});

require __DIR__.'/settings.php';
