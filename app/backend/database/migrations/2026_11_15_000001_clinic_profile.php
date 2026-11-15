<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Pengaturan Klinik (profil): contact + licence on the tenant, address + phone per branch. All nullable: existing clinics keep
// working and the UI shows the branch name until an address is filled in (replaces the hardcoded ADDRESSES map in Shell.tsx).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenant', function (Blueprint $t) {
            $t->string('address', 255)->nullable();
            $t->string('phone', 30)->nullable();
            $t->string('email', 120)->nullable();
            $t->string('license_no', 60)->nullable();      // nomor izin operasional klinik
            $t->date('license_valid_until')->nullable();
        });
        Schema::table('branch', function (Blueprint $t) {
            $t->string('address', 255)->nullable();
            $t->string('phone', 30)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tenant', fn (Blueprint $t) => $t->dropColumn(['address', 'phone', 'email', 'license_no', 'license_valid_until']));
        Schema::table('branch', fn (Blueprint $t) => $t->dropColumn(['address', 'phone']));
    }
};
