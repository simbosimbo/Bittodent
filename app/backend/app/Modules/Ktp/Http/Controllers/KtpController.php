<?php

namespace App\Modules\Ktp\Http\Controllers;

use App\Modules\Ktp\Contracts\KtpInput;
use App\Modules\Ktp\Contracts\KtpPhotoStore;
use App\Modules\Ktp\Contracts\NikCheck;
use App\Modules\Ktp\Contracts\NikValidator;
use App\Modules\Ktp\Http\Requests\KtpFieldsRequest;
use App\Modules\Ktp\Models\PatientKtp;
use App\Modules\Patients\Contracts\PatientDirectory;
use App\Shared\Audit\Audit;
use App\Shared\Http\Controller;
use App\Shared\Identity\NikMask;
use App\Shared\Tenancy\Ctx;
use Illuminate\Http\Request;

// The raw NIK never goes into a response except GET .../ktp (patient.ktp.view), and never into audit detail or logs.
class KtpController extends Controller
{
    /** POST /api/ktp/check: field-level comparison while typing (registration). */
    public function check(KtpFieldsRequest $request, NikValidator $validator)
    {
        return response()->json(self::checkJson($validator->check($request->ktpInput())));
    }

    /** POST /api/ktp/photos (multipart `photo`): optional, encrypted at rest, never sent to a model while the paid switch is off. */
    public function storePhoto(Request $request, KtpPhotoStore $store)
    {
        $request->validate(['photo' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:5120']]);
        $file = $request->file('photo');
        $photo = $store->store(null, $file->get(), $file->getMimeType());
        Audit::log('ktp_foto_simpan', 'ktp_photo', $photo->id);

        return response()->json(['id' => $photo->id], 201);
    }

    /** PUT /api/patients/{id}/ktp: receptionist verification = this save. */
    public function update(string $id, KtpFieldsRequest $request, PatientDirectory $patients, KtpPhotoStore $photos, NikValidator $validator)
    {
        $nik = $patients->nik($id); // 404 other tenant
        $p = $patients->summary($id);
        $in = $request->ktpInput();
        $photo = $in->photoId === null ? null : $photos->get($in->photoId);
        if ($in->photoId !== null && ($photo === null || ($photo->patientId !== null && $photo->patientId !== $id))) {
            abort(404);
        }
        $check = $validator->check(new KtpInput($nik, null, $in->dateOfBirth ?? $p['dob'], $in->sex ?? $p['sex'],
            $in->provinceCode, $in->regencyCode, $in->districtCode));
        $row = PatientKtp::firstOrNew(['patient_id' => $id]);
        $row->fill([
            'province_code' => $in->provinceCode, 'regency_code' => $in->regencyCode, 'district_code' => $in->districtCode,
            'photo_id' => $in->photoId ?? $row->photo_id, 'source' => 'manual',
            'verified_by' => Ctx::current()->userId, 'verified_at' => now(),
        ])->save();
        if ($in->photoId !== null) {
            $photos->attachToPatient($in->photoId, $id);
        }
        Audit::log('ktp_simpan', 'patient', $id, ['mismatches' => $check->mismatches]);

        return response()->json([...self::checkJson($check), 'nik' => NikMask::mask($nik)]);
    }

    /** GET /api/patients/{id}/ktp: the only unmasked NIK view (patient.ktp.view), audited as ktp_lihat. */
    public function show(string $id, PatientDirectory $patients, KtpPhotoStore $photos)
    {
        $nik = $patients->nik($id); // 404 other tenant
        $row = PatientKtp::where('patient_id', $id)->first();
        $photo = $row?->photo_id ? $photos->get($row->photo_id) : null;
        Audit::log('ktp_lihat', 'patient', $id);

        return response()->json([
            'nik' => $nik,
            'province_code' => $row?->province_code,
            'regency_code' => $row?->regency_code,
            'district_code' => $row?->district_code,
            'source' => $row?->source,
            'verified_by' => $row?->verified_by,
            'verified_at' => $row?->verified_at?->toIso8601String(),
            'photo' => $photo ? ['id' => $photo->id, 'mime' => $photo->mime] : null,
        ]);
    }



    /** GET /api/patients/{id}/ktp/attachment: photo metadata only (no NIK). 404 other tenant. */
    public function attachment(string $id, PatientDirectory $patients, KtpPhotoStore $photos)
    {
        $patients->assertExists($id);
        $row = PatientKtp::where('patient_id', $id)->first();
        $photo = $row?->photo_id ? $photos->get($row->photo_id) : null;

        return response()->json(['photo' => $photo ? ['id' => $photo->id, 'mime' => $photo->mime] : null]);
    }

    /** GET /api/patients/{id}/ktp/photo: stream the decrypted image (patient.ktp.view), audited as ktp_foto_lihat. */
    public function showPhoto(string $id, PatientDirectory $patients, KtpPhotoStore $photos)
    {
        $patients->assertExists($id); // 404 other tenant
        $row = PatientKtp::where('patient_id', $id)->first();
        $bytes = $row?->photo_id ? $photos->bytes($row->photo_id) : null;
        $meta = $row?->photo_id ? $photos->get($row->photo_id) : null;
        if ($bytes === null || $bytes === false || $meta === null) {
            abort(404);
        }
        Audit::log('ktp_foto_lihat', 'patient', $id);

        return response($bytes, 200, [
            'Content-Type' => $meta->mime,
            'Content-Disposition' => 'inline; filename="ktp"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private static function checkJson(NikCheck $c): array
    {
        return [
            'valid_length' => $c->validLength,
            'mismatches' => $c->mismatches,
            'parsed' => $c->parsed ? ['province_code' => $c->parsed->provinceCode, 'regency_code' => $c->parsed->regencyCode,
                'district_code' => $c->parsed->districtCode, 'dob' => $c->parsed->dateOfBirth, 'sex' => $c->parsed->sex] : null,
        ];
    }
}
