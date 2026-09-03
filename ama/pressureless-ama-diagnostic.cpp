#include <algorithm>
#include <array>
#include <cstdint>
#include <cmath>
#include <numeric>
#include <string>

#include <emscripten/emscripten.h>

#include "pressureless-ama-diagnostic.h"
#include "../third_party/ama/ai/search/beam/form.h"
#include "../third_party/ama/ai/search/beam/quiet.h"

namespace
{

enum Signal : i32
{
    POTENTIAL_CHAIN,
    TRIGGER_HEIGHT,
    REQUIRED_PUYOS,
    EXTENSION_SPACE,
    QUIET_LINK_2,
    QUIET_LINK_3,
    FORM_MATCH,
    SHAPE_DEVIATION,
    WELLS,
    BUMPS,
    BOARD_LINK_2,
    BOARD_LINK_3,
    ROW_14_BLOCKAGE,
    SIDE_BIAS,
    GARBAGE_COUNT,
    PAIR_SPLIT,
    IMMEDIATE_CLEAR,
    SIGNAL_COUNT,
};

enum ProbeStatus : i32
{
    PROBE_UNAVAILABLE,
    PROBE_NO_TRIGGER,
    PROBE_SINGLE_CHAIN,
    PROBE_MULTI_CHAIN,
};

struct Probe
{
    ProbeStatus status = PROBE_UNAVAILABLE;
    i32 column = 0;
    i32 color = 0;
    i32 required = 0;
    i32 chain_count = 0;
    i32 chain_score = 0;
    i32 trigger_height = 0;
    i32 extension_space = 0;
    i32 remain_link_2 = 0;
    i32 remain_link_3 = 0;
    i32 subtotal = 0;
};

struct LinkEvidence
{
    Field link_2;
    Field link_3;
    i32 count_2 = 0;
    i32 count_3 = 0;
};

struct Diagnostic
{
    bool valid = false;
    bool survives = false;
    Field field;
    Field link_2;
    Field link_3;
    Field cleared;
    i32 static_total = 0;
    i32 action_total = 0;
    bool matches_evaluator = false;
    std::array<i32, SIGNAL_COUNT> raw = {};
    std::array<i32, SIGNAL_COUNT> weights = {};
    std::array<i32, SIGNAL_COUNT> contributions = {};
    std::array<i32, 6> heights = {};
    std::array<i32, 6> shape_deviation = {};
    std::array<i32, 6> well_depth = {};
    std::array<i32, 6> bump_height = {};
    std::array<i32, beam::form::COUNT> form_scores = {};
    i32 best_form = -1;
    std::array<Probe, 24> probes = {};
    i32 selected_probe = -1;
    i32 row14 = 0;
    i32 immediate_chain_score = 0;
};

Diagnostic last;
std::string encoded;

LinkEvidence get_link_evidence(Field& field)
{
    LinkEvidence result;
    for (u8 p = 0; p < cell::COUNT - 1; ++p) {
        __m128i m12 = field.data[p].get_mask_12().data;
        __m128i r = _mm_srli_si128(m12, 2) & m12;
        __m128i l = _mm_slli_si128(m12, 2) & m12;
        __m128i u = _mm_srli_epi16(m12, 1) & m12;
        __m128i d = _mm_slli_epi16(m12, 1) & m12;
        __m128i ud_and = u & d;
        __m128i lr_and = l & r;
        __m128i ud_or = u | d;
        __m128i lr_or = l | r;

        FieldBit link_3;
        link_3.data = (ud_or & lr_or) | ud_and | lr_and;
        FieldBit link_2;
        link_2.data = _mm_andnot_si128(link_3.get_expand().data, u | l);

        result.link_2.data[p].data = link_2.data;
        result.link_3.data[p].data = link_3.data;
        result.count_2 += link_2.get_count();
        result.count_3 += link_3.get_count();
    }
    return result;
}

std::string encode_field(Field& field)
{
    std::string result;
    result.reserve(78);
    for (i32 row = 0; row < 13; ++row) {
        for (i32 col = 0; col < 6; ++col) {
            result.push_back(cell::to_char(field.get_cell(col, 12 - row)));
        }
    }
    return result;
}

void set_signal(Signal signal, i32 raw, i32 weight)
{
    last.raw[signal] = raw;
    last.weights[signal] = weight;
    last.contributions[signal] = raw * weight;
}

void collect_height_evidence(const std::array<i32, 6>& heights)
{
    const i32 average = std::accumulate(heights.begin(), heights.end(), 0) / 6;
    const i32 shape_coef[6] = { 1, 1, 1, -1, -1, -1 };
    for (i32 x = 0; x < 6; ++x) {
        last.shape_deviation[x] = std::abs(heights[x] - average - shape_coef[x]);
    }
    if (heights[0] < heights[1]) last.well_depth[0] = heights[1] - heights[0];
    if (heights[5] < heights[4]) last.well_depth[5] = heights[4] - heights[5];
    for (i32 x = 1; x < 5; ++x) {
        if (heights[x] < heights[x - 1] && heights[x] < heights[x + 1]) {
            last.well_depth[x] = std::min(heights[x - 1], heights[x + 1]) - heights[x];
        }
        if (heights[x] > heights[x - 1] && heights[x] > heights[x + 1]) {
            last.bump_height[x] = heights[x] - std::max(heights[x - 1], heights[x + 1]);
        }
    }
}

void collect_form(Field& field, const beam::eval::Weight& weight)
{
    i32 form = -100;
    auto mask_garbage = field.data[static_cast<i32>(cell::Type::GARBAGE)];
    mask_garbage.data &= _mm_set_epi16(0, 0, 0, 0, 0xF, 0xF, 0xF, 0xF);
    if (mask_garbage.get_count() > 0) {
        form = 0;
    }
    else {
        u8 heights[6];
        field.get_heights(heights);
        for (i32 i = 0; i < beam::form::COUNT; ++i) {
            const i32 score = beam::form::evaluate(field, heights, beam::form::list[i]);
            last.form_scores[i] = score;
            if (score > form) {
                form = score;
                last.best_form = i;
            }
        }
    }
    set_signal(FORM_MATCH, form, weight.form);
}

void collect_probes(Field& field, const beam::eval::Weight& weight)
{
    u8 raw_heights[6];
    field.get_heights(raw_heights);
    auto [x_min, x_max] = beam::quiet::get_bound(raw_heights);
    i32 best_score = INT32_MIN;

    for (i32 x = 0; x < 6; ++x) {
        for (i32 p = 0; p < 4; ++p) {
            auto& probe = last.probes[x * 4 + p];
            probe.column = x;
            probe.color = p;
            if (x < x_min || x > x_max) continue;
            probe.status = PROBE_NO_TRIGGER;
            const i32 drop_max = std::min(3, 12 - i32(raw_heights[x]));
            if (drop_max <= 0) continue;

            auto copy = field;
            for (i32 i = 0; i < drop_max; ++i) {
                copy.data[p].set_bit(x, raw_heights[x] + i);
                if (copy.data[p].get_mask_group_4(x, raw_heights[x]).get_count() < 4) {
                    continue;
                }

                probe.required = i + 1;
                auto plan = field;
                for (i32 added = 0; added < probe.required; ++added) {
                    plan.data[p].set_bit(x, raw_heights[x] + added);
                }
                auto popped = plan.pop();
                probe.chain_count = popped.get_size();
                auto popped_for_score = popped;
                probe.chain_score = chain::get_score(popped_for_score).score;
                if (probe.chain_count < 2) {
                    probe.status = PROBE_SINGLE_CHAIN;
                    break;
                }

                probe.status = PROBE_MULTI_CHAIN;
                probe.trigger_height = raw_heights[x];
                probe.extension_space = beam::eval::get_chi(raw_heights, x);
                const auto links = get_link_evidence(plan);
                probe.remain_link_2 = links.count_2;
                probe.remain_link_3 = links.count_3;
                probe.subtotal =
                    probe.chain_count * weight.chain +
                    probe.trigger_height * weight.y +
                    probe.required * weight.key +
                    probe.extension_space * weight.chi +
                    probe.remain_link_2 * weight.link_2 +
                    probe.remain_link_3 * weight.link_3;
                if (probe.subtotal > best_score) {
                    best_score = probe.subtotal;
                    last.selected_probe = x * 4 + p;
                }
                break;
            }
        }
    }

    if (last.selected_probe < 0) return;
    const auto& selected = last.probes[last.selected_probe];
    set_signal(POTENTIAL_CHAIN, selected.chain_count, weight.chain);
    set_signal(TRIGGER_HEIGHT, selected.trigger_height, weight.y);
    set_signal(REQUIRED_PUYOS, selected.required, weight.key);
    set_signal(EXTENSION_SPACE, selected.extension_space, weight.chi);
    set_signal(QUIET_LINK_2, selected.remain_link_2, weight.link_2);
    set_signal(QUIET_LINK_3, selected.remain_link_3, weight.link_3);
}

}

namespace ama::diagnostic
{

bool inspect(
    Field field,
    const cell::Pair& pair,
    i8 x,
    direction::Type rotation,
    const beam::eval::Weight& weight
)
{
    last = Diagnostic();
    auto legal = move::generate(field, pair.first == pair.second);
    bool found = false;
    for (i32 i = 0; i < legal.get_size(); ++i) {
        if (legal[i].x == x && legal[i].r == rotation) {
            found = true;
            break;
        }
    }
    if (!found) return false;

    last.valid = true;
    const i32 pair_split = field.get_drop_pair_frame(x, rotation) - 1;
    field.drop_pair(x, rotation, pair);
    auto popped = field.pop();
    const i32 immediate_chain = popped.get_size();
    auto popped_for_score = popped;
    last.immediate_chain_score = chain::get_score(popped_for_score).score;
    for (i32 step = 0; step < popped.get_size(); ++step) {
        for (u8 p = 0; p < cell::COUNT - 1; ++p) {
            last.cleared.data[p] = last.cleared.data[p] | popped[step].data[p];
        }
    }

    last.field = field;
    last.row14 = field.row14;
    last.survives = field.get_height(2) <= 11;
    set_signal(PAIR_SPLIT, pair_split, weight.tear);
    set_signal(IMMEDIATE_CLEAR, immediate_chain, weight.waste);
    last.action_total = last.contributions[PAIR_SPLIT] + last.contributions[IMMEDIATE_CLEAR];
    if (!last.survives) return true;

    u8 raw_heights[6];
    field.get_heights(raw_heights);
    for (i32 x_index = 0; x_index < 6; ++x_index) {
        last.heights[x_index] = raw_heights[x_index];
    }
    collect_height_evidence(last.heights);
    collect_form(field, weight);
    collect_probes(field, weight);

    const auto links = get_link_evidence(field);
    last.link_2 = links.link_2;
    last.link_3 = links.link_3;
    const i32 height_left = raw_heights[0] + raw_heights[1];
    const i32 height_right = raw_heights[3] + raw_heights[4] + raw_heights[5];

    set_signal(SHAPE_DEVIATION, beam::eval::get_shape(raw_heights), weight.shape);
    set_signal(WELLS, beam::eval::get_well(raw_heights), weight.well);
    set_signal(BUMPS, beam::eval::get_bump(raw_heights), weight.bump);
    set_signal(BOARD_LINK_2, links.count_2, weight.link_2);
    set_signal(BOARD_LINK_3, links.count_3, weight.link_3);
    set_signal(ROW_14_BLOCKAGE, beam::eval::get_waste_14(field.row14), weight.waste_14);
    set_signal(SIDE_BIAS, std::max(height_left, height_right) - i32(raw_heights[2]), weight.side);
    set_signal(
        GARBAGE_COUNT,
        field.data[static_cast<u8>(cell::Type::GARBAGE)].get_count(),
        weight.nuisance
    );

    for (i32 i = 0; i < PAIR_SPLIT; ++i) {
        last.static_total += last.contributions[i];
    }
    auto reference = beam::node::Data { .field = field };
    beam::eval::action(reference, pair_split, immediate_chain, weight);
    beam::eval::evaluate(reference, weight);
    last.matches_evaluator =
        reference.score.action == last.action_total &&
        reference.score.eval == last.static_total;
    return true;
}

}

extern "C"
{

EMSCRIPTEN_KEEPALIVE int ama_diag_valid() { return last.valid; }
EMSCRIPTEN_KEEPALIVE int ama_diag_survives() { return last.survives; }
EMSCRIPTEN_KEEPALIVE int ama_diag_static_total() { return last.static_total; }
EMSCRIPTEN_KEEPALIVE int ama_diag_action_total() { return last.action_total; }
EMSCRIPTEN_KEEPALIVE int ama_diag_matches_evaluator() { return last.matches_evaluator; }
EMSCRIPTEN_KEEPALIVE int ama_diag_signal_count() { return SIGNAL_COUNT; }
EMSCRIPTEN_KEEPALIVE int ama_diag_signal_raw(int index) { return last.raw.at(index); }
EMSCRIPTEN_KEEPALIVE int ama_diag_signal_weight(int index) { return last.weights.at(index); }
EMSCRIPTEN_KEEPALIVE int ama_diag_signal_contribution(int index) { return last.contributions.at(index); }
EMSCRIPTEN_KEEPALIVE int ama_diag_height(int column) { return last.heights.at(column); }
EMSCRIPTEN_KEEPALIVE int ama_diag_shape_deviation(int column) { return last.shape_deviation.at(column); }
EMSCRIPTEN_KEEPALIVE int ama_diag_well_depth(int column) { return last.well_depth.at(column); }
EMSCRIPTEN_KEEPALIVE int ama_diag_bump_height(int column) { return last.bump_height.at(column); }
EMSCRIPTEN_KEEPALIVE int ama_diag_form_score(int index) { return last.form_scores.at(index); }
EMSCRIPTEN_KEEPALIVE int ama_diag_best_form() { return last.best_form; }
EMSCRIPTEN_KEEPALIVE int ama_diag_probe_status(int index) { return last.probes.at(index).status; }
EMSCRIPTEN_KEEPALIVE int ama_diag_probe_required(int index) { return last.probes.at(index).required; }
EMSCRIPTEN_KEEPALIVE int ama_diag_probe_chain_count(int index) { return last.probes.at(index).chain_count; }
EMSCRIPTEN_KEEPALIVE int ama_diag_probe_chain_score(int index) { return last.probes.at(index).chain_score; }
EMSCRIPTEN_KEEPALIVE int ama_diag_probe_subtotal(int index) { return last.probes.at(index).subtotal; }
EMSCRIPTEN_KEEPALIVE int ama_diag_selected_probe() { return last.selected_probe; }
EMSCRIPTEN_KEEPALIVE int ama_diag_row14() { return last.row14; }
EMSCRIPTEN_KEEPALIVE int ama_diag_immediate_chain_score() { return last.immediate_chain_score; }

EMSCRIPTEN_KEEPALIVE const char* ama_diag_board()
{
    encoded = encode_field(last.field);
    return encoded.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* ama_diag_link_2_mask()
{
    encoded = encode_field(last.link_2);
    return encoded.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* ama_diag_link_3_mask()
{
    encoded = encode_field(last.link_3);
    return encoded.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* ama_diag_cleared_mask()
{
    encoded = encode_field(last.cleared);
    return encoded.c_str();
}

}
