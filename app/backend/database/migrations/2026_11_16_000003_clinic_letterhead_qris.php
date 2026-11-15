<?php

// Owning modules: Tenancy (tenant: npwp, logo, receipt paper) and Billing (payment_account: QRIS photo). Boards KL10-KL13
// (design/kasir-laporan@b4c5bee): one logo + name for every branch, address per branch (already on branch), QRIS static photo
// per QRIS account, receipt paper 58/80 mm. Files live on the private disk; columns hold the relative path only.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenant', function (Blueprint $t) {
            $t->string('npwp', 30)->nullable();
            $t->string('logo_path', 200)->nullable();
            $t->unsignedTinyInteger('receipt_paper_mm')->default(80); // 58 | 80
        });
        Schema::table('payment_account', fn (Blueprint $t) => $t->string('qris_image_path', 200)->nullable());
    }

    public function down(): void
    {
        Schema::table('tenant', fn (Blueprint $t) => $t->dropColumn(['npwp', 'logo_path', 'receipt_paper_mm']));
        Schema::table('payment_account', fn (Blueprint $t) => $t->dropColumn('qris_image_path'));
    }
};
