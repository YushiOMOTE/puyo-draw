# Tokopuyo Tsumo Specification

## Status and scope

This document describes the implemented Tokopuyo mode in Puyo Chain Simulator. It covers the modern Sega-style Puyo Puyo Tsu distribution associated with Puyo Puyo eSports and other recent Sega titles, not every historical arcade or console release named Puyo Puyo Tsu.

The distribution is reverse-engineered and community-documented. Sega does not appear to publish an official specification for this randomizer. Requirements marked as **observed** are supported by the sources listed below; requirements marked as **product decision** describe how this application should expose the behavior.

## Terminology

- A **puyo** is one colored piece.
- A **tsumo** is one falling pair of puyos.
- A **pattern** or **seed** is one complete predefined sequence selected at the beginning of a session.
- A **hand** is one tsumo. One hand therefore contains two consecutive puyos in the stored sequence.
- **Axis** is the first/stationary puyo in the pair; **child** is the second puyo. The published sequence format places the axis color first.

## Observed distribution

### Pattern selection

1. At the start of a Tokopuyo session, select one integer seed uniformly from `0` through `65535`.
2. The seed identifies one of exactly `65,536` predefined patterns. For a user-facing pattern number, use `seed + 1`, so the visible range is `1` through `65,536`.
3. The selected pattern is fixed for the session. Do not draw a new independent random color for each hand.
4. Each pattern contains `256` puyos, equivalent to `128` hands. After hand 128, the sequence loops back to hand 1.
5. Given the same seed and color mode, the sequence must be reproducible.

The strongest available evidence for this model is the published 65,536-line data set: each line contains 256 colors and is described as looping after 128 hands. Independent tools expose the same numbering convention (`seed + 1`) and allow all 128 hands to be inspected.

### Color mode

The first Tokopuyo implementation supports only the normal 4-color Tsu distribution. The seed determines both the selected four colors and their order. The user cannot select or cycle the palette in Tokopuyo mode.

The underlying researched distribution also has related 3- and 5-color variants, but they are out of scope. The 3-color sequence remains relevant to data provenance because the official-style 4-color opening is derived from it; the application may consume an already-finalized 4-color pattern without loading or exposing the 3-color sequence.

For the 4-color mode, the documented pool contains 64 puyos of each of the four colors before the opening correction is applied. The final 256-puyo sequence can therefore be slightly non-uniform after that correction.

### Opening correction

The first two hands (the first four puyos) of the 4-color and 5-color sequences are overwritten with the first two hands from the 3-color sequence for the same seed. This is an important part of the modern Sega-style behavior.

Consequences that the implementation must preserve:

- The opening is shared across 3-, 4-, and 5-color modes for a given seed.
- The first four puyos cannot contain all four colors in 4- or 5-color mode.
- The opening has a higher frequency of same-color opportunities than independent uniform sampling would suggest.
- In 4-color mode, the opening overwrite can break the otherwise exact 64-per-color total.

This is an overwrite of the completed mode-specific sequence, not a post-generation rejection-and-retry loop.

### Pair representation

Store each hand as two colors in axis/child order:

```text
pattern[seed][hand] = { axis: Color, child: Color }
```

The public text representation used by the community is a 256-character string. Characters are `r`, `g`, `b`, `y`, and `p` for red, green, blue, yellow, and purple. Characters 0 and 1 form hand 1, characters 2 and 3 form hand 2, and so on. The axis is first.

Axis/child color order is part of the selected sequence and must be passed unchanged to the falling-pair game logic. Orientation is not randomization data: every new active pair starts in the same vertical spawn orientation, with the child above the axis.

## Application modes

The application has two top-level, mutually exclusive modes:

1. **Drawing mode** is the existing free-form board editor and chain simulator.
2. **Tokopuyo mode** is a turn-based practice mode driven by a fixed official-style tsumo pattern.

The Tokopuyo mode button is placed at the bottom of the drawing-mode sidebar, directly above the Help button. Selecting it switches to Tokopuyo mode. Tokopuyo mode provides a corresponding Drawing mode button in the same lower sidebar area.

Mode state is independent. Switching modes preserves the drawing board, drawing history, palette, garbage setting, suggestions, and score for later restoration. It also preserves the active Tokopuyo session unless the user explicitly resets or starts a new pattern. A mode switch is not an Undo/Redo history entry.

Direct cell editing, color selection, garbage mode, manual simulation, and Clear are unavailable in Tokopuyo mode. Separate long-chain construction and emergency-attack Suggestion actions are available as described below.

## Tokopuyo layout

### Field and pair display

- The visible and hidden locked field remains a six-column, thirteen-row color board. Tokopuyo also stores a six-bit, colorless occupancy mask for Ama's special fourteenth row.
- The active pair appears at the official-style spawn position centered over the third column from the left.
- Because the child of the initial vertical pair can occupy the special fourteenth row, the active pair is rendered in a positioning overlay rather than inserted into board cells before lock.
- A child locked in the special fourteenth row disappears from the colored field and sets that column's occupancy bit. It never falls, clears, or participates in a group. The bit persists across later chains and hands and is included in Undo/Redo snapshots.
- The active pair is visually distinct from locked board puyos while retaining the normal puyo appearance.
- Next and Next Next show hands `handIndex + 1` and `handIndex + 2` without consuming them.
- The preview area sits above the Tokopuyo sidebar, in the upper-right space next to the field. It is outside the ordered control list.
- The right-side panel may reduce the field size as needed, but the page must remain non-scrolling and retain the existing mobile safe-area and square-cell requirements.

### Tokopuyo sidebar

The Tokopuyo sidebar follows the current square-button visual language. Below the preview area, controls are ordered from top to bottom:

1. Chain count.
2. Undo.
3. Redo.
4. Long-chain Suggestion.
5. Emergency-attack Suggestion.
6. Review Last Move.

Reset and the Drawing mode button are in the left-side app rail. The Help button remains pinned at the bottom and opens mode-appropriate instructions.

Palette, garbage, Clear, and Simulate controls are hidden rather than merely disabled.

## Long-chain construction suggestions

Tokopuyo Suggestion is Pressureless Ama: the pinned upstream Ama build-search implementation running in WebAssembly without opponent pressure. Its public observation is the settled thirteen-row color field, special-fourteenth-row occupancy, Current, and Next. The actual Next Next and all later hands in the deterministic Tokopuyo pattern are deliberately hidden from it.

Each search fixes Current and Next, then runs Ama's six predetermined unknown continuations. A branch records the maximum chain score found for each legal Current placement. The six values are summed and candidates rank by the aggregate, preserving Ama's selection policy. The initial configuration is depth 16, beam width 250, trigger 95,000, stretch enabled, and the upstream `build` evaluation weights.

The Wasm build retains Ama's bitfield and SIMD simulation, legal-move generator, beam expansion, static and pattern evaluation, quiescence search, and transposition table. Only opponent reading, attack/defense action selection, real-time control, and other versus state are excluded.

Six branches are distributed over a reusable pool of three ordinary Workers. The pool loads lazily on the first request. Initialization does not consume the eight-second search timeout. A timeout, initialization error, or runtime error destroys the pool; the next request may create a fresh pool. Wasm pthreads and cross-origin isolation are not required.

## Last-Move Review

Each completed hand stores its exact pre-move field, special-row occupancy, Current, Next, locked cells, canonical placement, and resolution outcome as part of the atomic session snapshot. Review Last Move reruns or reuses the complete Pressureless Ama analysis for that pre-move position and compares the user's locked-cell set with all returned legal placements. Undo and Redo restore the corresponding review target; Reset starts without one.

The review reports exact agreement, a score tie, or a different Ama recommendation; the user's rank; and both six-future average, minimum, and maximum found chain scores. A six-row, common-scale chart retains the exact score and identifies each physical-color pairing pattern with compact puyo icons and an accessible text label. The six-score mean is future potential; relative standard deviation supports a comparative stability description across these synthetic tests but does not affect Ama's ranking. These are counterfactual bounded-search observations, not probabilities, an absolute move grade, or a causal decomposition of Ama's final choice. A different move at or above 90% of Ama's aggregate score may be described factually as within 10%, without assigning a quality label.

For each matched surviving placement, the review calls a diagnostic Wasm entry point that applies Current, resolves its immediate chain, and exposes Ama's exact immediate static and action evaluation. The two comparison boards initially show the user's and Ama's locked Current pairs before chain resolution, with both landed puyos outlined and firing moves labeled. Selecting Show on boards replaces those previews with Ama's resolved evaluation fields and selected evidence; pre-clear outlines are never drawn on a post-clear field. The report includes raw heuristic values, active weights, weighted contributions, definitions, the selected within-three-puyo multi-chain trigger probe, and available cell or column evidence. Potential, variation, immediate priority, and the largest weighted feature gaps use compact comparison bars. Summary terms, feature definitions, and raw calculations open from adjacent question-mark controls; tapping elsewhere in the report closes the open explanation. The six future rows and complete feature table are collapsed initially. The UI keeps immediate beam priority separate from the six-future maximum-score ranking and verifies diagnostic totals against the evaluator before displaying them.

A read-only dialog shows the pre-move field with the user's pair and Ama's preferred pair side by side. It never modifies the live field or history. A choke-point game-over move may be absent from Ama's surviving candidates and is explained as excluded rather than assigned a synthetic score; if no placement survives, no Ama choice is invented.

Each side with a surviving positive-score candidate provides a Best future replay. The replay uses the first branch tied for that candidate's maximum among the six fixed future patterns and discloses how many branches share that maximum. Opening it reruns the same branch with optional witness observation in the shared Ama beam search. The trace is accepted only when the complete Current-placement score vector, selected Current move, final score, and chain count reproduce the original analysis.

Replay starts at the recorded pre-move field. Next processes one whole hand: show its pair, lock it at the traced placement, run the complete chain using the main field's clear and gravity animation timing, then show the next pair. Play repeats Next automatically; Pause stops before a later hand, and Start restores the initial replay field. These controls are read-only with respect to the live Tokopuyo session and history. Zero-score and excluded cases disable replay. `Replay unavailable` is a defensive timeout or parity-failure state, not a normal enabled-replay outcome.

Up to four ranked Current placements are cached. The current pair is shown at its final landing cells as colored dashed circles with centered sparkles, including a virtual-row marker when the child occupies the special fourteenth row. Pressing Suggestion again cycles through cached alternatives without searching again. A committed hand, Undo, Redo, Reset, or mode change invalidates the cache and stale in-flight results.

The status line reports the candidate index, the average of its six sampled maximum-chain scores, and elapsed search time. That scalar is search evidence rather than a calibrated probability, an optimality proof, or a causal coaching explanation.

## Emergency-attack suggestions

The separate emergency-attack Suggestion searches only the current, Next, and Next Next pairs for the highest-scoring safe firing routes. It exhaustively enumerates legal pair placements within its time budget and stops each route at its first clear. Later visible hands are not placed after that clear.

Routes rank by the existing Tsu chain-clear point total. Equal-point routes rank by the earliest firing hand and then by fewer chains, favoring speed over chain length. Routes that leave the third-column choke point occupied after any committed hand, including after the attack resolves, are excluded. Display-identical routes are collapsed and the best ten are cached in rank order.

The current placement uses colored dashed circles with centered sparkles. Next and Next Next placements use the same progressively lighter numbered circles as the long-chain planner. No ignition, lightning, or roadmap markers are added because following the complete displayed route directly produces the attack. Repeated presses rotate through the cached routes. Committing a pair, Undo, Redo, or Reset clears both Suggestion caches.

## Active-pair interaction

Tokopuyo is step-driven and has no real-time gravity or movement timer. The active pair waits at its spawn position until the user acts.

The authoritative legal-placement set is Ama's `move::generate` behavior. It includes the spawn-side path checks, floor-kick and quick-turn reachability, axis/child orientation, the third-column death condition, and special-fourteenth-row occupancy. Every placement accepted by that generator must be reachable using Tokopuyo movement and rotation controls, and Drop must reject every placement outside that set.

Special-fourteenth-row occupancy prevents another child from locking in that same special cell when the Ama destination check applies. It does not behave like a normal colored collision cell while the active pair is moving through the virtual display row.

The bottom bar is the only active-pair input. Move Left and Move Right shift the preview by one column when the intermediate position fits. Rotate Counterclockwise and Rotate Clockwise update the orientation immediately, apply the established wall kick when needed, and perform a quick turn after the same blocked rotation is requested twice. Drop attempts the previewed placement. Field cells do not select, move, rotate, or place the pair.

A movement or rotation that cannot fit leaves the pair in place. A preview may move through the virtual display row, but Drop succeeds only when the resulting column and orientation are in the Ama-compatible legal-placement set.

### Lock and automatic simulation

1. Pressing Drop first validates the previewed placement with the Ama-compatible legal-move generator, then computes the lowest valid position for its orientation.
2. The two puyos lock into the board. If the pair is horizontal and the two columns have different heights, each puyo falls independently until supported. A child reaching the special fourteenth row records colorless occupancy instead of entering the normal board.
3. The current hand is consumed only after both puyos have successfully locked.
4. If the locked board contains a connected group of four or more, chain simulation begins automatically. No Simulate button is shown.
5. Input is disabled during clear and gravity animations.
6. Chain count and cumulative score are reset for the newly committed hand, then updated through that hand's automatic chain sequence using the existing scoring and animation rules.
7. After the board becomes stable, the next hand becomes active and the previews advance.
8. If no group clears, the next hand becomes active immediately after the lock animation.

## Tokopuyo session behavior

### Start

- Starting a new Tokopuyo session selects a new seed and resets the board to empty.
- The selected seed, pattern number, selected four colors, and current hand index are session state.
- The first upcoming hand is hand 1 at index 0.
- The UI should expose the pattern number so a session can be reproduced.

### Advance

- When the player requests the next hand, read two colors at `2 * (handIndex mod 128)` and `2 * (handIndex mod 128) + 1`.
- Increment the hand index only after the pair has been successfully committed to the board.
- Preview next hands from the same fixed sequence. Previewing must not consume or regenerate random state.
- After hand 128, wrap to hand 1 and keep the same seed.

### History

Tokopuyo has history independent from Drawing mode.

- A committed hand, including all automatic chain resolution caused by that hand, is one atomic Undo entry.
- Horizontal moves and rotations made before lock are not individual Undo entries.
- Undo restores the board, active hand index, active pair at its initial spawn orientation, chain count, and cumulative score to the state before the reverted hand.
- Redo reapplies the complete committed-hand result, including its final board and score, without replaying the animation.
- Committing a hand after Undo clears the Redo stack.
- Undo and Redo are disabled while a pair is locking or a chain is animating.

### Restart and reproducibility

The data model distinguishes two concepts:

1. **Restart session**: clear the board and reset the hand index to zero while preserving the seed and 4-color pattern. This reproduces the same tsumo sequence.
2. **New pattern**: choose a new seed, clear the board, and reset the hand index to zero.

The first implementation exposes Reset in the sidebar. Reset clears the Tokopuyo board, selects a new random pattern, resets the hand index to zero, and clears Tokopuyo Undo/Redo history. The tooltip and toast must state that a new pattern was selected. Replaying the same seed is retained as a data-model capability for future pattern selection or sharing, but it has no separate control in the first release.

The seed must be stored with any saved or shareable session state. A board alone is insufficient to reproduce a Tokopuyo run.

## Data and implementation strategy

### Deterministic generator

The implementation generates the selected pattern on demand from its 16-bit seed. This avoids shipping the roughly 16.8 million raw color symbols required by a complete table while producing the same finite set of patterns.

The generator:

1. Updates a 32-bit state with `state = state * 0x5d588b65 + 0x00269ec3`, wrapping at 32 bits.
2. Uses the upper 16 bits and multiply-high range reduction for each bounded choice.
3. Selects a permutation of the five physical colors with five random choices.
4. Creates 256-entry 3-, 4-, and 5-color pools from repeating numeric color indices.
5. Shuffles each pool in three passes over adjacent blocks of lengths 16, 32, and 64, consuming two random values per swap.
6. Replaces the first four entries of the 4-color pool with those of the 3-color pool.
7. Maps the numeric 4-color pool through the selected physical-color permutation and groups consecutive values into 128 axis/child pairs.

All three pools are shuffled even though only the 4-color result is exposed, because their shared RNG consumption is part of pattern compatibility. The implementation is checked against the published No.34067 opening `bpbpbpypgybgbpbb...`.

### Module boundary

Keep the distribution independent of the DOM and the chain engine. A future module should expose a small contract similar to:

```js
getPattern(seed) -> Array<{ axis, child }>
getTsumo(seed, handIndex) -> { axis, child }
```

The returned values should be immutable from the caller's perspective, or copied before mutation. The chain engine should receive a placed pair/board update and should not know how the pair was generated.

### Failure handling

- Reject seeds outside `0..65535`.
- Never fall back to per-hand `Math.random()` for a Tokopuyo session; doing so changes the rules and makes replay impossible.

## Relationship to the current application

The current application is a board editor and chain simulator. Its existing six-column, thirteen-row color board and chain-clearing rules remain authoritative for simulation. Tokopuyo adds falling pairs, a session loop, and the separate colorless fourteenth-row occupancy mask; it does not change the existing color-group, gravity, or scoring rules. Garbage puyos are not generated in Tokopuyo mode.

The first Tokopuyo design should therefore keep these concerns separate:

```text
pattern selection -> fixed tsumo sequence -> pair placement -> existing chain simulation
```

The existing editor remains available as Drawing mode. Direct cell editing is disabled in Tokopuyo mode.

## Game-over behavior

The active pair cannot be committed if there is no legal landing position for both puyos. After a committed hand and all resulting chains have resolved, the session ends if the standard third-column choke point at the top of the visible field is occupied. While game over is displayed, movement is disabled; Reset, Undo, and Drawing mode remain available.

## Confirmed product decisions

- The first switch to Tokopuyo starts a random pattern immediately without an intermediate Start screen.
- Returning to Drawing mode preserves the Tokopuyo session; switching back resumes it.
- Reset starts a new random pattern rather than replaying the current seed.
- The pattern number is always shown in compact form near Next and Next Next.
- Tokopuyo placement reachability follows Ama, including floor kicks and quick turns. Quarter-turn controls retain their wall-kick behavior; the direct 180-degree flick does not invent a placement outside Ama's legal set.
- Game over is checked at the standard third-column choke point after chain resolution.
- Undo/Redo operates on one committed hand plus its complete automatic chain result, not on individual pre-lock moves or rotations.

## Verification requirements

Before release, add focused tests for:

- seed boundaries 0 and 65,535;
- pattern number conversion (`1 <-> seed 0`, `65,536 <-> seed 65,535`);
- 256-puyo / 128-hand indexing and wraparound;
- axis/child parsing order;
- deterministic repeated reads for the same seed and hand;
- rejection of malformed pattern data;
- restart preserving the seed and new-pattern changing it;
- persistence/replay including seed, selected colors, hand index, and board state;
- one-column horizontal movement and collision rejection;
- clockwise and counterclockwise orientation transitions;
- hard-drop placement for vertical and split horizontal landings;
- automatic simulation after a clearing lock and immediate advance after a non-clearing lock;
- one committed hand plus its chain result forming one atomic history entry;
- independent Drawing and Tokopuyo state across mode switches;
- disabled direct board editing in Tokopuyo mode;
- top-out behavior after the game-over decision is finalized;
- last-move metadata restoration through Undo and Redo;
- full-placement ranking, tied results, cell-set matching, and game-over exclusions in last-move review;
- reuse of a matching completed Pressureless Ama analysis.

Statistical tests should not assert that the sequence is independently uniform. The documented distribution is a finite, deterministic set with mode-specific construction and an opening overwrite. Tests should instead verify the data contract and selected known fixtures.

## Evidence and limitations

The following sources were consulted on 2026-08-30:

- [Puyo Camp: Sega Puyo distribution data](https://puyo-camp.jp/posts/86154) — describes 65,536 lines, 256 puyos per line, 128-hand looping, color symbols, and axis-first ordering; it also notes that the data is an observed/community reconstruction rather than an official publication.
- [Puyo Camp: 65,536-pattern Tokopuyo simulator](https://puyo-camp.jp/posts/91012) — documents selecting a pattern at random from the 65,536 patterns, numbering patterns 1–65,536, and searching by the first hands.
- [Puyo Seed Search](https://puyotsumo.oiu-piponeer.com/) — documents the modern 3-/4-/5-color relationship, seed numbering, 128-hand display, and the first-two-hand overwrite from 3-color mode into 4- and 5-color modes.
- [Puyo Nexus: Upcoming Pair Randomizer](https://puyonexus.com/wiki/Puyo_Puyo_Tsu/Upcoming_Pair_Randomizer) — reverse-engineering notes on finite color pools, shuffle bias, and the non-independent nature of the classic Tsu randomizer.
- [Puyo Nexus: Falling Pair Spawning Process](https://puyonexus.com/wiki/Puyo_Puyo_Tsu/Falling_Pair_Spawning_Process) — reverse-engineering notes confirming that pairs are taken successively from randomized pools and that the stored pair colors are used as the falling pair.

These sources do not establish that every historical release has identical data or that Sega officially guarantees this format. The application should label the mode as compatible with the researched modern Sega-style distribution and keep the data source replaceable if a target title or platform is later specified.
