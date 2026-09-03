#pragma once

#include "layer.h"
#include "eval.h"

namespace beam
{

constexpr size_t BRANCH = 6;
constexpr size_t PRUNE = 5000;

struct Configs
{
    size_t width = 250;
    size_t depth = 16;
    size_t trigger = 95000;
    bool stretch = true;
};

struct Candidate
{
    move::Placement placement = move::Placement();
    size_t score = 0;
};

struct Result
{
    std::vector<Candidate> candidates = {};
};

class Observer
{
public:
    virtual ~Observer() = default;
    virtual void on_child(
        const node::Data& parent,
        node::Data& child,
        const move::Placement& placement
    ) = 0;
    virtual void on_score(
        const node::Data& child,
        const chain::Score& chain
    ) = 0;
};

void expand(
    const cell::Pair& pair,
    node::Data& node,
    const eval::Weight& w,
    std::function<void(node::Data&, const move::Placement&, const chain::Score&)> callback
);

void think(
    const cell::Pair& pair,
    std::vector<Candidate>& candidates,
    Layer& parents,
    Layer& children,
    const eval::Weight& w,
    Observer* observer = nullptr
);

Result search(
    Field field,
    cell::Queue queue,
    eval::Weight w,
    Configs configs = Configs(),
    Observer* observer = nullptr
);

Result search_multi(
    Field field,
    cell::Queue queue,
    eval::Weight w,
    Configs configs = Configs()
);

cell::Queue get_queue_random(i32 id, size_t count);

inline bool operator < (const Candidate& a, const Candidate& b)
{
    return a.score < b.score;
};

};
