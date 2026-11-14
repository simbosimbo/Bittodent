<?php

namespace Tests\Modules\Compensation;

use App\Modules\Compensation\Domain\CompensationBasis;
use PHPUnit\Framework\TestCase;

class CompensationBasisTest extends TestCase
{
    public function test_default_basis_is_after_material_and_lab(): void
    {
        $this->assertSame('after_material_and_lab', CompensationBasis::default()->value);
        $this->assertSame(700000, CompensationBasis::default()->baseRp(1000000, 200000, 100000));
        $this->assertSame(1000000, CompensationBasis::BeforeCosts->baseRp(1000000, 200000, 100000));
    }
}
