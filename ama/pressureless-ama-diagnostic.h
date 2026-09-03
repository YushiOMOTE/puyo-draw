#pragma once

#include "../third_party/ama/core/core.h"
#include "../third_party/ama/ai/search/beam/eval.h"

namespace ama::diagnostic
{

bool inspect(
    Field field,
    const cell::Pair& pair,
    i8 x,
    direction::Type rotation,
    const beam::eval::Weight& weight
);

}
