<?php

namespace App\Modules\Agents\Contracts;

// agent_run.agent (docs/database.md 3.9) + `ringkasan` (docs/ai/ringkasan-rekam-medis.md, PR #1).
enum AgentKind: string
{
    case Pendaftaran = 'pendaftaran';
    case Penjadwalan = 'penjadwalan';
    case Scribe = 'scribe';
    case Koding = 'koding';
    case Recall = 'recall';
    case Tagihan = 'tagihan';
    case Ringkasan = 'ringkasan';
    case SaranTindakan = 'saran_tindakan'; // A2, generator deterministik (rules), no model
}
