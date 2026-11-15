<?php

namespace App\Modules\Agents\Contracts;

// agent_run.outcome. `berjalan` = row written before the model call, so a crash mid-call still leaves a trace.
enum RunOutcome: string
{
    case Berjalan = 'berjalan';
    case Berhasil = 'berhasil';
    case Gagal = 'gagal';
    case BerhentiMintaManusia = 'berhenti_minta_manusia';
}
