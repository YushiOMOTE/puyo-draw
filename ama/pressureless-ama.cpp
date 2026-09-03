#include <algorithm>
#include <chrono>
#include <cstring>
#include <vector>

#include <emscripten/emscripten.h>

#include "../third_party/ama/core/core.h"
#include "../third_party/ama/ai/search/beam/beam.h"
#include "pressureless-ama-diagnostic.h"

namespace
{

std::vector<beam::Candidate> last_candidates;
std::vector<move::Placement> last_witness;
i32 last_witness_score = 0;
i32 last_witness_chain_count = 0;
i32 last_elapsed_ms = 0;

struct TraceEntry
{
    u32 parent = 0;
    move::Placement placement = move::Placement();
};

class WitnessRecorder final : public beam::Observer
{
private:
    move::Placement target;
    std::vector<TraceEntry> traces = { TraceEntry() };
    u32 best_trace = 0;
public:
    i32 score = 0;
    i32 chain_count = 0;
public:
    explicit WitnessRecorder(move::Placement placement) : target(placement) {}

    void on_child(
        const beam::node::Data& parent,
        beam::node::Data& child,
        const move::Placement& placement
    ) override
    {
        if (parent.index < 0) {
            child.trace = placement == target ? append(0, placement) : 0;
            return;
        }
        child.trace = parent.trace == 0
            ? 0
            : append(parent.trace, placement);
    }

    void on_score(
        const beam::node::Data& child,
        const chain::Score& chain
    ) override
    {
        if (child.trace == 0 || chain.score <= score) return;
        best_trace = child.trace;
        score = chain.score;
        chain_count = chain.count;
    }

    std::vector<move::Placement> get_witness() const
    {
        std::vector<move::Placement> result;
        for (u32 trace = best_trace; trace != 0; trace = traces[trace].parent) {
            result.push_back(traces[trace].placement);
        }
        std::reverse(result.begin(), result.end());
        return result;
    }
private:
    u32 append(u32 parent, const move::Placement& placement)
    {
        traces.push_back({ .parent = parent, .placement = placement });
        return static_cast<u32>(traces.size() - 1);
    }
};

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

cell::Queue build_queue(
    i32 current_axis,
    i32 current_child,
    i32 next_axis,
    i32 next_child,
    i32 depth,
    i32 branch
)
{
    cell::Queue queue = {
        { cell::Type(current_axis), cell::Type(current_child) },
        { cell::Type(next_axis), cell::Type(next_child) },
    };
    auto future = beam::get_queue_random(branch, depth - queue.size());
    queue.insert(queue.end(), future.begin(), future.end());
    return queue;
}

beam::Configs build_configs(i32 depth, i32 width)
{
    return {
        .width = static_cast<size_t>(width),
        .depth = static_cast<size_t>(depth),
        .trigger = 95000,
        .stretch = true,
    };
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
    auto queue = build_queue(
        current_axis, current_child, next_axis, next_child, depth, branch
    );
    const auto configs = build_configs(depth, width);

    const auto started = std::chrono::steady_clock::now();
    const auto result = beam::search(field, queue, build_weight(), configs);
    last_candidates = result.candidates;
    last_elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - started
    ).count();
    return static_cast<int>(last_candidates.size());
}

EMSCRIPTEN_KEEPALIVE int ama_trace_branch(
    const char* board,
    int row14,
    int current_axis,
    int current_child,
    int next_axis,
    int next_child,
    int depth,
    int width,
    int branch,
    int target_x,
    int target_rotation,
    int expected_score
)
{
    last_witness.clear();
    last_witness_score = 0;
    last_witness_chain_count = 0;
    if (
        board == nullptr ||
        std::strlen(board) != 78 ||
        row14 < 0 || row14 >= 64 ||
        current_axis < 0 || current_axis > 3 ||
        current_child < 0 || current_child > 3 ||
        next_axis < 0 || next_axis > 3 ||
        next_child < 0 || next_child > 3 ||
        depth < 2 || width < 1 ||
        branch < 0 || branch >= beam::BRANCH ||
        target_x < 0 || target_x > 5 ||
        target_rotation < 0 || target_rotation >= static_cast<int>(direction::COUNT) ||
        expected_score < 0
    ) {
        return -1;
    }

    const move::Placement target = {
        .x = static_cast<i8>(target_x),
        .r = static_cast<direction::Type>(target_rotation),
    };
    auto queue = build_queue(
        current_axis, current_child, next_axis, next_child, depth, branch
    );
    WitnessRecorder recorder(target);
    const auto started = std::chrono::steady_clock::now();
    const auto result = beam::search(
        decode_field(board, row14),
        queue,
        build_weight(),
        build_configs(depth, width),
        &recorder
    );
    last_candidates = result.candidates;
    last_elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - started
    ).count();

    const auto candidate = std::find_if(
        last_candidates.begin(),
        last_candidates.end(),
        [&] (const beam::Candidate& value) { return value.placement == target; }
    );
    if (
        candidate == last_candidates.end() ||
        candidate->score != static_cast<size_t>(expected_score) ||
        recorder.score != expected_score
    ) {
        return -2;
    }
    last_witness = recorder.get_witness();
    last_witness_score = recorder.score;
    last_witness_chain_count = recorder.chain_count;
    return static_cast<int>(last_witness.size());
}

EMSCRIPTEN_KEEPALIVE int ama_candidate_x(int index)
{
    return last_candidates.at(index).placement.x;
}

EMSCRIPTEN_KEEPALIVE int ama_candidate_count()
{
    return static_cast<int>(last_candidates.size());
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

EMSCRIPTEN_KEEPALIVE int ama_trace_score()
{
    return last_witness_score;
}

EMSCRIPTEN_KEEPALIVE int ama_trace_chain_count()
{
    return last_witness_chain_count;
}

EMSCRIPTEN_KEEPALIVE int ama_trace_move_x(int index)
{
    return last_witness.at(index).x;
}

EMSCRIPTEN_KEEPALIVE int ama_trace_move_rotation(int index)
{
    return static_cast<int>(last_witness.at(index).r);
}

EMSCRIPTEN_KEEPALIVE int ama_inspect_placement(
    const char* board,
    int row14,
    int current_axis,
    int current_child,
    int x,
    int rotation
)
{
    if (
        board == nullptr ||
        std::strlen(board) != 78 ||
        row14 < 0 || row14 >= 64 ||
        current_axis < 0 || current_axis > 3 ||
        current_child < 0 || current_child > 3 ||
        x < 0 || x > 5 ||
        rotation < 0 || rotation >= static_cast<int>(direction::COUNT)
    ) {
        return -1;
    }

    return ama::diagnostic::inspect(
        decode_field(board, row14),
        { cell::Type(current_axis), cell::Type(current_child) },
        static_cast<i8>(x),
        static_cast<direction::Type>(rotation),
        build_weight()
    ) ? 1 : 0;
}

}
