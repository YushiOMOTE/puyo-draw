# Pressureless Ama Technical Validation

## Status and decision

This document records the feasibility work for replacing the current Ama-style
Tokopuyo construction planner with a WebAssembly build of Ama's upstream
construction search. The move-rule, special-row, and color-mapping foundations
described in the parity follow-up are implemented; the Wasm solver itself is not
yet available in the application.

The selected direction is **Pressureless Ama**:

- The application supplies only the settled field, Current, and Next.
- No opponent field, incoming garbage, offset, attack timing, or tactical state
  is supplied.
- The solver uses Ama's upstream build-search behavior and its six predetermined
  continuations for the unknown queue after Next.
- The first implementation targets WebAssembly with SIMD and runs outside the
  UI thread.
- Search duration is a measured product parameter, not a fixed eight-second
  requirement. Faster results are preferred when recommendation quality is
  stable.

This is intentionally Ama's long-chain construction decision under no external
pressure. It is not a simulation of the full adversarial state machine with
neutral values inserted into every opponent-related input.

## Reference baseline

The spike used upstream [citrus610/ama](https://github.com/citrus610/ama) at
commit `dea210bcd92965ae08fbc311f23565b0fab6dbbb` (`v2.0.1` lineage), under its
MIT license.

The reference configuration used the upstream `build` weights and these beam
settings:

| Setting | Spike value |
| --- | ---: |
| Search depth | 16 pairs |
| Beam width | 250 |
| Large-chain trigger | 95,000 points |
| Stretch | Enabled |
| Sampled future queues | 6 |

Current and Next are fixed at the start of every branch. Each branch then
appends one of Ama's six predetermined queues. For each legal Current placement,
the branch records the largest chain score found. The six scores are summed and
the placement with the highest total is selected. This is the upstream policy
described in the source as choosing the highest expected chain score.

The unknown continuation is therefore sampled internally even though the public
input stops at Next. No actual Next Next value is read from Tokopuyo.

## WebAssembly feasibility

The construction-search subset compiled successfully with Emscripten 6.0.9,
C++20, `-O3`, `-msimd128`, and `-msse4.1`. It uses Ama's bitfield and SIMD chain
simulation directly; it is not a JavaScript reimplementation.

The proof-of-concept browser artifacts were 11,885 bytes of JavaScript loader
and 47,686 bytes of WebAssembly before HTTP compression. The search artifact
exposes a small C ABI for a 6-by-13 field, two visible pairs, search parameters,
and ranked placement results. The parity harness additionally accepts the
special-fourteenth-row mask; the production search ABI must include that mask.

Upstream requires a few portability changes before it can become a maintained
build input:

- select Emscripten's SSE compatibility header instead of the umbrella x86
  intrinsic header;
- omit the legacy JSON serialization declarations from the search-only build;
- replace the non-standard `_countof` use with a portable array length; and
- use Ama's portable `pext16` fallback because Wasm SIMD has no direct BMI2
  `pext` equivalent.

The `pext16` fallback is already part of upstream and is behaviorally equivalent,
but it may be slower. SIMD chain simulation remains enabled. These changes need
to live as an auditable patch against the pinned upstream revision rather than
as an untracked fork.

The local development server now serves `.wasm` as `application/wasm`, which is
required for streaming WebAssembly compilation.

## Initial performance results

Measurements below were taken on an Apple M5 MacBook Air with 32 GB RAM. They
are feasibility data, not a release performance target.

### One worker, six branches in sequence

At depth 16 and width 250:

- fourteen empty-field seeds completed in 810–1,218 ms;
- five ten-turn generated midgame runs had per-seed means of 1,112–1,401 ms;
- the slowest observed turn in that sample was 1,770 ms; and
- a twenty-turn in-browser run completed each request in approximately
  0.90–1.38 seconds.

### Six ordinary Web Workers

Each predetermined future branch is independent. Running one branch in each of
six ordinary Web Workers avoids Wasm pthreads and does not require cross-origin
isolation.

On an empty-field benchmark, five repeated cold worker-pool runs completed in
349–365 ms. On a field with three red puyos on the bottom row, the parallel run
completed in 221–230 ms. The latter position produced exactly the same best
placement and aggregate score as sequential search.

Each worker's Wasm heap remained at its initial 16 MiB in these tests, implying
a 96 MiB Wasm-heap baseline for six concurrent workers, plus browser and module
overhead. This is acceptable on the reference desktop but must not be assumed
acceptable on target phones.

### Depth and width sensitivity

One generated twenty-turn field produced the following comparison:

| Depth | Width | Time | Recommended placement |
| ---: | ---: | ---: | --- |
| 8 | 50 | 131 ms | `x=2, right` |
| 12 | 100 | 366 ms | `x=2, right` |
| 12 | 250 | 775 ms | `x=3, up` |
| 16 | 100 | 417 ms | `x=3, up` |
| 16 | 250 | 869 ms | `x=3, up` |
| 16 | 500 | 1,583 ms | `x=3, up` |

This demonstrates that aggressive reductions can change the recommendation.
It does not yet prove that depth 16 and width 100 are generally equivalent to
depth 16 and width 250. A representative position corpus is required before
changing the upstream-like baseline.

## Fidelity and correctness boundaries

### What the spike preserves

- Ama's field bitset and SIMD chain simulation;
- legal-move generation and reachability checks;
- beam expansion, evaluation, quiescence behavior, and transposition table;
- upstream build weights;
- Current/Next plus six predetermined unknown continuations; and
- placement selection by aggregate maximum chain score.

### What Pressureless Ama deliberately excludes

- opponent-field reading;
- incoming garbage and offset state;
- attack and defense action selection;
- harassment, crush, counter, all-clear battle, and tactical timing decisions;
  and
- the real-time Puyo Puyo Champions client.

This boundary is appropriate for the stated coaching question: "What is a good
next construction move when there is no opponent pressure?" It should not be
presented as advice for live versus tactics.

### Move-rule parity follow-up

Tokopuyo now stores Ama's special fourteenth row as a separate six-bit occupancy
mask and uses an exact JavaScript translation of Ama's legal-move generator for
pair placement. The mask is colorless, does not participate in normal field
simulation, and persists through chains and session history.

The validation harness compared the JavaScript generator with upstream Ama's
`move::generate` through Wasm. All 34,154 sampled unequal- and equal-color move
masks matched. A separate 20,000-profile reachability run, including arbitrary
special-row masks, found that every Ama-legal placement was reachable with the
Tokopuyo left, right, rotation, quick-turn, and drop operations, with no extra
committable placements.

Focused repository tests now cover:

- all 22 empty-field placements and same-color deduplication;
- tall columns, floor kicks, quick turns, and blocked paths from the spawn;
- a child placed in or moving through the fourteenth row;
- third-column top-out after chain resolution;
- the hidden row's exclusion from clearing; and
- conversion between the session's four physical colors and Ama's four abstract
  colors.

Physical session colors are mapped by pattern slot to Ama's abstract `R/Y/G/B`
values, so a selected purple puyo requires no special solver behavior.

## Evaluation output and future coaching explanations

Ama's final per-placement value is the maximum chain score found in each sampled
future, aggregated across six branches. Static evaluation features guide beam
retention, but they are not a clean additive explanation of the final result.

Consequently, exposing the raw scalar as "move quality" would be misleading.
The coaching layer should later add instrumentation and counterfactual summaries,
for example:

- best chain potential found per sampled continuation;
- change in reachable trigger height and chain size;
- connected pair/triple, shape, tear, waste, and fourteenth-row feature deltas;
- robustness across the six futures; and
- the strongest alternative move and the first material difference in its
  continuation.

These explanations can use Ama's signals, but their wording and causal claims
need separate validation. They are not a free by-product of compiling Ama.

## Recommended integration architecture

1. Vendor a pinned, license-preserving subset of upstream Ama plus a small,
   reviewed Wasm portability patch.
2. Add a reproducible Emscripten build that emits static versioned assets.
3. Expose only a narrow solver ABI: board, Current, Next, configuration, request
   identifier, candidates, branch scores, and diagnostic timing.
4. Lazily initialize a reusable Worker pool and keep all search off the UI
   thread. Support one through six workers so concurrency can be selected from
   device measurements.
5. Preserve stale-request rejection, cancellation, timeout recovery, and worker
   recreation already expected by the application's suggestion architecture.
6. Establish legal-move and result-parity tests before replacing the existing
   planner.
7. Build a versioned benchmark corpus of early, middle, tall, damaged, and
   near-top-out fields. Use it to choose depth, width, concurrency, and timeout.

The six-worker desktop result is promising, but the initial production default
should not be fixed until target-phone latency and memory are measured. The
implementation should make concurrency adjustable without rebuilding Wasm.

## Remaining validation gates

- **Target mobile browsers:** latency, peak memory, worker startup, thermal
  behavior, and cancellation on at least one recent iPhone and one representative
  Android device.
- **Native parity:** compare Wasm placements and scores against an unmodified
  x86-64 upstream build on a shared corpus. The local Apple Silicon environment
  could compile the x86 reference but could not execute it without Rosetta.
- **Quality corpus:** quantify top-1 and top-k recommendation changes across
  depth and width settings, rather than tuning from one generated field.
- **Licensing and provenance:** retain the upstream MIT notice and record the
  exact commit and patch in generated artifacts or build metadata.

No user assistance is required for the next Wasm integration work. Assistance
will be useful at the mobile validation gate: running a small benchmark page on
the actual phones the product intends to support and returning its generated
results. Running the native parity check can either use an available x86-64
machine or a CI job once repository publication of that job is explicitly
authorized.
