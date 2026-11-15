<?php

namespace App\Modules\ClinicalSummary\Domain;

use DateTimeInterface;

// Everything read for one summary (signed/final data only), already decrypted: in memory only, never logged.
// Shapes = the read contracts (Clinical\Contracts\ClinicalHistory, Patients\Contracts\MedicalHistoryReader, Prescriptions\Contracts\PrescriptionHistory).
final readonly class SummarySources
{
    public function __construct(
        public array $history,        // ClinicalHistory::signedHistory()
        public ?array $medical,       // MedicalHistoryReader::current()
        public array $prescriptions,  // PrescriptionHistory::activeSigned()
        public DateTimeInterface $now,
    ) {}

    public function isEmpty(): bool
    {
        return $this->history['notes'] === [] && $this->history['findings'] === [] && $this->history['baseline'] === null
            && $this->medical === null && $this->prescriptions === [];
    }

    public function daysAgo(?DateTimeInterface $at): int
    {
        if ($at === null) {
            return 0;
        }
        // Day boundaries in WIB (branch time zones beyond Jakarta: later).
        $tz = new \DateTimeZone('Asia/Jakarta');
        $a = (new \DateTimeImmutable('@'.$at->getTimestamp()))->setTimezone($tz)->setTime(0, 0);
        $b = (new \DateTimeImmutable('@'.$this->now->getTimestamp()))->setTimezone($tz)->setTime(0, 0);

        return max(0, (int) $a->diff($b)->days);
    }

    /** References to every source record + version (ids only), for agent_run.input_refs. */
    public function refs(): array
    {
        $refs = [];
        foreach ($this->history['notes'] as $n) {
            $refs[] = ['type' => SourceType::NoteVersion->value, 'id' => $n['id'], 'version' => $n['version']];
        }
        foreach ($this->history['findings'] as $f) {
            $refs[] = ['type' => SourceType::Finding->value, 'id' => $f['id'], 'version' => 1];
        }
        if ($b = $this->history['baseline']) {
            $refs[] = ['type' => SourceType::Baseline->value, 'id' => $b['id'], 'version' => $b['version']];
        }
        if ($m = $this->medical) {
            $refs[] = ['type' => SourceType::MedicalHistory->value, 'id' => $m['id'], 'version' => $m['version']];
        }
        foreach ($this->prescriptions as $rx) {
            $refs[] = ['type' => SourceType::Prescription->value, 'id' => $rx['id'], 'version' => 1];
        }

        return $refs;
    }

    /** SHA-256 of the canonical source manifest (ids + versions + note content hashes). Changes when anything new is signed => "usang". */
    public function manifestHash(): string
    {
        $hashes = array_column($this->history['notes'], 'content_hash', 'id');
        $rows = array_map(fn ($r) => $r['type'].':'.$r['id'].':'.$r['version'].':'.($hashes[$r['id']] ?? ''), $this->refs());
        sort($rows);

        return hash('sha256', implode("\n", $rows));
    }
}
