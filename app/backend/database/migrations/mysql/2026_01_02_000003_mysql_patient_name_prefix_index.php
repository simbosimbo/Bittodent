<?php

// Owning module: Patients.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// MySQL only. Name search = word-prefix LIKE on name_normalized (App\Modules\Patients\Services\PatientSearch), backed by a column-prefix
// B-tree index with tenant_id first. Limits vs PostgreSQL pg_trgm: only matches from the START of a word
// ('sari' finds "Sari Dewi" and "Dewi Sari", not "Wulansari"); no typo/similarity matching; the "% word" branch
// scans the tenant's index range instead of seeking. Chosen over FULLTEXT because InnoDB FULLTEXT does not see
// uncommitted rows and ignores tokens < 3 chars / stopwords.
// PostgreSQL equivalent: postgres-target/0004 GIN (name_search gin_trgm_ops) + SECURITY INVOKER function search_patient().
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE INDEX patient_name_prefix_idx ON patient (tenant_id, name_normalized(64))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX patient_name_prefix_idx ON patient');
    }
};
