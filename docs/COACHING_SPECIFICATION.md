# Pressureless Ama Coaching Specification

Status: Initial implementation. The immediate breakdown, future-potential and
relative-variation comparison, fixed pairing labels, deterministic summaries,
and core board evidence are available. The complete trigger-probe matrix and
continuation witness paths remain proposed follow-ups.

## Purpose

Tokopuyo coaching helps beginner and intermediate players understand how
Pressureless Ama reads a construction position. It compares the position after
the user's Current placement with the position after Ama's preferred Current
placement, then explains both the immediate board evaluation and the long-chain
results found under Ama's six fixed continuation patterns.

The report answers two separate questions:

1. How did Ama's heuristics evaluate each board immediately after Current?
2. How much long-chain potential did search find under each fixed future pairing
   pattern, and how much did those results vary between patterns?

The first question describes beam-search priority. The second describes the
maximum chain-clear scores found by search and determines Ama's final Current
placement ranking. The report must not present the immediate evaluation as a
causal decomposition of the final ranking.

## Scope

The first coaching implementation includes:

- an immediate post-placement comparison of the user and Ama fields;
- raw heuristic values, configured weights, weighted contributions, and visual
  evidence produced by Ama;
- deterministic plain-language summaries of the most material differences;
- the six existing per-branch maximum chain scores;
- a future-potential summary derived from those six scores; and
- a stability comparison derived from their relative dispersion.

Continuation witness paths, intermediate-field explanations, live-versus
tactics, incoming garbage, opponent state, and claims about the player's likely
real queue are not included.

## Evaluation Points

Both alternatives start from the exact recorded pre-move field, special
fourteenth-row mask, and Current pair.

For each alternative, the diagnostic evaluator must use Ama's normal root
transition:

1. drop Current at the selected legal placement;
2. resolve any immediate clear and gravity;
3. reject a position that exceeds Ama's survival rule;
4. calculate the Current action contribution; and
5. calculate the static evaluation of the resolved field.

The displayed immediate search priority is:

```text
immediate priority = static evaluation + Current action contribution
```

This value is used to prioritize intermediate beam nodes. It is not added to the
six future maximum chain scores. Ama's preferred Current placement can therefore
have a lower immediate priority than the user's placement. The report must state
that fact when it occurs rather than forcing an explanation in Ama's favor.

If the user's placement is excluded by Ama's survival rule, the report explains
the exclusion and does not fabricate an evaluation breakdown.

## Ama Evaluation Breakdown

Diagnostic values must be produced by the Wasm Ama evaluator rather than by a
JavaScript reimplementation. Every signal contains its raw value, active weight,
weighted contribution, and typed visual evidence.

```js
{
  id: "trigger-required-puyos",
  rawValue: 2,
  weight: -200,
  contribution: -400,
  evidence: { type: "trigger-probe", addedCells: [/* ... */] }
}
```

The sum of all static contributions must equal Ama's static evaluation. The sum
of the Current transition contributions must equal Ama's action value for that
root placement.

### Trigger probe

Ama's quiescence evaluator scans a bounded trigger area as follows:

1. Start with the columns reachable from the center without crossing a column
   above Ama's height bound.
2. For each reachable column and each of the four colors, add that color
   vertically one puyo at a time, up to three puyos.
3. Stop adding when the new puyos create a group of at least four.
4. Resolve that hypothetical clear.
5. Ignore the result as a quiet-search candidate if it produces fewer than two
   chain steps.
6. For a multi-chain result, record the chain, trigger column height, required
   puyo count, extension space, and two- and three-connection markers remaining
   after the clear.
7. Select the probe with the highest weighted trigger-probe subtotal.

The selected probe is not necessarily the probe with the greatest chain count.
The report calls it Ama's "best trigger probe," not an available real move or a
predicted future.

The diagnostic payload retains every attempted column/color combination with
one of these outcomes:

- a multi-chain trigger found within one to three additions;
- a clear found but ignored because it produced only one chain step;
- no trigger found within three additions; or
- unavailable because the column is outside the bounded trigger area.

For a successful probe it retains:

- the tested column and color;
- the hypothetical added cells;
- the number of added puyos;
- the resulting chain count and chain-clear score;
- trigger height and extension-space value;
- remaining two- and three-connection evidence; and
- every raw and weighted component of its subtotal.

The default explanation displays only the selected probe. An expanded "How Ama
scanned this field" view may show the complete column-by-color probe matrix.

### Structural signals

The diagnostic evaluator returns the following board evidence:

| Signal | Raw meaning | Required visual evidence |
| --- | --- | --- |
| Form match | Best score among Ama's `GTR`, `FRON`, and `SGTR` templates | Selected template, all template scores, and matched board cells |
| Two-connections | Ama's two-connection marker count | Per-color cell masks counted by Ama |
| Three-connections | Ama's three-connection marker count | Per-color cell masks counted by Ama |
| Shape deviation | Sum of per-column distance from Ama's ideal relative height profile | Six heights, ideal relative line, and per-column deviations |
| Wells | Total depth of columns lower than their applicable neighbors | Contributing columns and depths |
| Bumps | Total height of interior columns above both neighbors | Contributing columns and heights |
| Row 14 blockage | Lost reachable space calculated from the special-row mask | Occupied special-row cells and the remaining reachable span |
| Garbage | Garbage-puyo count | Counted cell mask |
| Side bias | Ama's left/right-versus-center height feature | Six heights and raw value; hidden by default while its weight is zero |

Two- and three-connection values are Ama-specific marker counts, not a general
count of every group of size two or three. Their highlighted masks are part of
the explanation so the UI does not imply a different definition.

A form-match result means that the bottom portion of the field satisfies some of
the selected template's relative color constraints. It must not certify that the
player has built a canonical named form.

### Current placement action signals

Action signals are presented separately from board features:

| Signal | Meaning | Visual evidence |
| --- | --- | --- |
| Pair split | The horizontal pair landed at different heights | Both landing cells and their height difference |
| Immediate clear cost | Number of chain steps fired immediately by Current | Chain-step count and the cells cleared at each step |

Pair split is a binary placement cost in the current Ama implementation. It is
not a general elapsed-time estimate. Ama names the second action signal `waste`,
but the implementation passes the number of chain steps returned by
`Field::pop()`, not the number of puyos removed. The UI therefore uses
"immediate clear cost." It affects search priority but does not subtract from a
chain score already found.

## Six Fixed Future Pairing Patterns

Current and Next are observed inputs. After them, Ama appends fourteen unknown
pairs at the current depth-16 configuration. Each branch alternates two fixed
unequal-color pairs seven times.

Using Ama's four abstract color slots `C1`, `C2`, `C3`, and `C4`, the patterns
are:

| Branch | Repeating pair pattern |
| ---: | --- |
| 1 | `C1-C2`, `C3-C4` |
| 2 | `C1-C3`, `C2-C4` |
| 3 | `C1-C4`, `C2-C3` |
| 4 | `C2-C3`, `C1-C4` |
| 5 | `C2-C4`, `C1-C3` |
| 6 | `C3-C4`, `C1-C2` |

The UI maps these slots to the session's physical colors and displays colored
pair icons. These are deterministic synthetic test continuations, not six random
draws and not six calibrated, equally likely real futures.

For Current placement `m` and branch `b`, let `s(m,b)` be the largest actual
chain-clear score found anywhere in the bounded beam search rooted at `m`.
Ama's ranking value is:

```text
aggregate(m) = sum(s(m, 1), ..., s(m, 6))
```

The search does not discount a score because it was found at a later depth.
Static evaluation and action cost affect which intermediate nodes survive but do
not reduce a maximum chain score after it has been found.

## Future Potential

The six values together form the move's future-potential profile. The primary
summary is their arithmetic mean:

```text
potential(m) = aggregate(m) / 6
```

The implementation retains full precision for comparisons and rounds only for
display. Using the mean instead of the sum does not change placement ordering.

User-facing wording qualifies the metric:

> Across Ama's six test continuations, this placement produced a higher average
> maximum found score.

It must not say that the value is an expected real-game score, the probability of
a long chain, or a proven upper bound. "Future potential" always means potential
found within Ama's six fixed patterns, depth, beam width, and early-stop rules.

## Stability

Stability is a coaching-derived comparison. It is not a feature used by Ama to
rank Current placements.

Raw variance is retained for exact diagnostics:

```text
mean(m) = sum(scores) / 6
variance(m) = sum((score - mean(m))^2) / 6
standardDeviation(m) = sqrt(variance(m))
```

Raw variance or standard deviation cannot be compared fairly by itself because
higher-scoring profiles naturally operate at a larger scale. The report therefore
uses relative dispersion for its stability wording:

```text
relativeDispersion(m) = standardDeviation(m) / mean(m)
```

Lower relative dispersion means the found results varied less across the six
pairing patterns. The UI shows the range and relative dispersion up front, and
keeps the exact six scores in a collapsed comparison chart. It does not convert
them into an arbitrary 0-100 stability grade.

Edge cases:

- If all six scores are zero, future potential is zero and stability is
  unavailable; six equal failures are not described as usefully stable.
- If the mean is zero, relative dispersion is unavailable.
- A difference below five percentage points of relative dispersion is described
  as similar rather than declaring one move more stable. This presentation
  tolerance must be validated against a representative position corpus before
  release.
- A high potential with high relative dispersion is described as stronger but
  more dependent on Ama's tested color-pairing pattern.
- A lower potential with low relative dispersion is described as more consistent
  across the tests, not automatically better.

The word "stability" must always be tied to variation across the six test
continuations. It must not imply resistance to harassment, garbage, timing
pressure, execution error, or the full distribution of real queues.

## Comparison and Explanation Rules

The report has three evidence layers:

1. **Immediate board reading** compares the two Ama heuristic breakdowns.
2. **Future potential** compares the mean maximum found chain score.
3. **Stability across test continuations** compares relative dispersion while
   retaining the six exact scores.

No combined coaching grade is calculated. A stronger result in one layer must
not erase a contrary result in another layer.

The initial summary uses deterministic templates, not a generative model.
Potential, variation, immediate priority, and the largest weighted feature gaps
are visual comparisons. Definitions and raw calculations open from adjacent
question-mark controls rather than occupying the default report. The six-future
chart and complete feature table are collapsed initially. A short trigger-probe
insight may be shown when available. Examples of supported coaching language
include:

> Ama's field needed one fewer hypothetical puyo for its best trigger probe.

> Your field retained more three-connection markers, while Ama's field matched
> its selected form template more closely.

> Ama's placement had higher future potential and varied less across the six
> tested pairing patterns.

> Your field had the higher immediate search priority, but Ama's sampled search
> found larger chains later.

The report must not turn correlation into causation by claiming that one
immediate feature produced a later branch score. Both evidence layers may be
shown together, but their relationship remains an observation unless a future
witness analysis demonstrates the connection.

## Proposed Data Contract

```js
{
  evaluator: {
    revision: "pinned Ama revision",
    weightProfile: "build",
  },
  user: {
    immediate: {
      survives: true,
      staticTotal: 0,
      actionTotal: 0,
      signals: [],
      triggerProbes: [],
    },
    future: {
      scores: [0, 0, 0, 0, 0, 0],
      total: 0,
      mean: 0,
      variance: 0,
      standardDeviation: 0,
      relativeDispersion: null,
    },
  },
  ama: {
    immediate: {},
    future: {},
  },
  comparison: {
    immediateLeader: "user | ama | tied | unavailable",
    potentialLeader: "user | ama | tied",
    stabilityLeader: "user | ama | similar | unavailable",
  },
}
```

The pure JavaScript comparison layer consumes diagnostic data but does not
recalculate Ama features. It may calculate aggregate statistics from the six
scores and select presentation templates.

## Interface Outline

The existing last-move report is extended in this order:

1. concise outcome and Current-placement comparison;
2. "How Ama reads these fields," containing two synchronized mini-boards and up
   to three explanation cards;
3. an expandable signal list with raw value, weight, contribution, definition,
   and a "Show on board" action;
4. "Future potential and stability," containing the six branch chart, mapped
   color-pair labels, mean, range, standard deviation, and relative dispersion;
   and
5. methodology and limitation notes.

Selecting a signal updates only the read-only comparison boards. It never mutates
the Tokopuyo session or history. The dialog remains internally scrollable and
mobile-first.

## Implementation Stages

1. Add an Ama diagnostic structure and a Wasm inspection entry point for one
   legal Current placement.
2. Verify that diagnostic totals exactly match the existing evaluator and that
   enabling diagnostics does not change candidate scores or ordering.
3. Add pure future-potential, variance, standard-deviation, relative-dispersion,
   and comparison functions with focused tests.
4. Add typed evidence decoding and deterministic explanation selection.
5. Add the synchronized board-evidence UI and replace numeric branch labels with
   physical-color pairing labels.
6. Validate wording and presentation thresholds against a representative corpus
   before enabling absolute stability language.

## Acceptance Criteria

- Search candidates, branch scores, and ordering are identical before and after
  diagnostic instrumentation.
- Every weighted contribution sums exactly to the evaluator total used by Ama.
- Every raw value shown in the UI has evidence generated by the same Wasm
  evaluation, and mask counts match the reported values.
- The selected trigger probe has the maximum subtotal under the active weights,
  and its hypothetical clear replays to the reported chain result.
- Future-potential ordering matches the existing six-score aggregate ordering.
- Stability never affects or is described as affecting Ama's move selection.
- All zero, tied, excluded, and lower-immediate-but-higher-future cases have
  explicit tested wording.
- The report remains usable at narrow mobile widths and all user-facing text is
  in English.
