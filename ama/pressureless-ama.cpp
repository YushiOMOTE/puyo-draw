#include <algorithm>
#include <chrono>
#include <cstring>
#include <vector>

#include <emscripten/emscripten.h>

#include "../third_party/ama/core/core.h"
#include "../third_party/ama/ai/search/beam/beam.h"

namespace
{

std::vector<beam::Candidate> last_candidates;
i32 last_elapsed_ms = 0;

beam::eval::Weight build_weight()
{
    return beam::eval::Weight {
        .chain = 1000,
        .y = 289,
        .key = -200,
        .chi = 200,
        .shape = -100,
        .well = -100,
        .bump = -100,
        .form = 50,
        .link_2 = 150,
        .link_3 = 250,
        .waste_14 = -50,
        .side = 0,
        .nuisance = -250,
        .tear = -250,
        .waste = -250,
    };
}

cell::Type decode_cell(char value)
{
    switch (value) {
    case 'R': return cell::Type::RED;
    case 'Y': return cell::Type::YELLOW;
    case 'G': return cell::Type::GREEN;
    case 'B': return cell::Type::BLUE;
    case '#': return cell::Type::GARBAGE;
    default: return cell::Type::NONE;
    }
}

Field decode_field(const char* board, i32 row14)
{
    Field field;
    for (i32 row = 0; row < 13; ++row) {
        for (i32 col = 0; col < 6; ++col) {
            const auto type = decode_cell(board[row * 6 + col]);
            if (type != cell::Type::NONE) field.set_cell(col, 12 - row, type);
        }
    }
    field.row14 = static_cast<u8>(row14);
    return field;
}

}

extern "C"
{

EMSCRIPTEN_KEEPALIVE int ama_solve_branch(
    const char* board,
    int row14,
    int current_axis,
    int current_child,
    int next_axis,
    int next_child,
    int depth,
    int width,
    int branch
)
{
    if (
        board == nullptr ||
        std::strlen(board) != 78 ||
        row14 < 0 || row14 >= 64 ||
        current_axis < 0 || current_axis > 3 ||
        current_child < 0 || current_child > 3 ||
        next_axis < 0 || next_axis > 3 ||
        next_child < 0 || next_child > 3 ||
        depth < 2 || width < 1 ||
        branch < 0 || branch >= beam::BRANCH
    ) {
        return -1;
    }

    auto field = decode_field(board, row14);
    cell::Queue queue = {
        { cell::Type(current_axis), cell::Type(current_child) },
        { cell::Type(next_axis), cell::Type(next_child) },
    };
    auto future = beam::get_queue_random(branch, depth - queue.size());
    queue.insert(queue.end(), future.begin(), future.end());
    const beam::Configs configs {
        .width = static_cast<size_t>(width),
        .depth = static_cast<size_t>(depth),
        .trigger = 95000,
        .stretch = true,
    };

    const auto started = std::chrono::steady_clock::now();
    const auto result = beam::search(field, queue, build_weight(), configs);
    last_candidates = result.candidates;
    last_elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - started
    ).count();
    return static_cast<int>(last_candidates.size());
}

EMSCRIPTEN_KEEPALIVE int ama_candidate_x(int index)
{
    return last_candidates.at(index).placement.x;
}

EMSCRIPTEN_KEEPALIVE int ama_candidate_rotation(int index)
{
    return static_cast<int>(last_candidates.at(index).placement.r);
}

EMSCRIPTEN_KEEPALIVE int ama_candidate_score(int index)
{
    return static_cast<int>(last_candidates.at(index).score);
}

EMSCRIPTEN_KEEPALIVE int ama_elapsed_ms()
{
    return last_elapsed_ms;
}

}
