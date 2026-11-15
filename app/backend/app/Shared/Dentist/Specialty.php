<?php

namespace App\Shared\Dentist;

// Dentist category + specialist field codes, shared by Tenancy (dentist_profile) and Tariffs (price cells per field).
final class Specialty
{
    public const CATEGORIES = ['general', 'specialist'];

    public const FIELDS = ['sp_ort' => 'Sp.Ort', 'sp_bm' => 'Sp.BM', 'sp_kg' => 'Sp.KG', 'sp_pros' => 'Sp.Pros', 'sp_perio' => 'Sp.Perio', 'sp_kga' => 'Sp.KGA'];
}
