<?php

namespace App\Modules\Integrations\Contracts;

use LogicException;

// Configuration that would break D-009 (region outside Jakarta, Geo/Global inference profile). Fails at construction.
final class ModelNotAllowed extends LogicException {}
