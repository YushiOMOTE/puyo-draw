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

Direct cell editing, color selection, garbage mode, manual simulation, and Clear are unavailable in Tokopuyo mode. Suggestion is available as the separate long-chain construction planner described below.

## Tokopuyo layout

### Field and pair display

- The existing six-column, thirteen-row field remains the board model.
- The active pair appears at the official-style spawn position centered over the third column from the left.
- Because the child of the initial vertical pair can occupy the unmodeled fourteenth row, the active pair is rendered in a positioning overlay rather than inserted into board cells before lock.
- The active pair is visually distinct from locked board puyos while retaining the normal puyo appearance.
- Next and Next Next show hands `handIndex + 1` and `handIndex + 2` without consuming them.
- The preview area sits above the Tokopuyo sidebar, in the upper-right space next to the field. It is outside the ordered control list.
- The right-side panel may reduce the field size as needed, but the page must remain non-scrolling and retain the existing mobile safe-area and square-cell requirements.

### Tokopuyo sidebar

The Tokopuyo sidebar follows the current square-button visual language. Below the preview area, controls are ordered from top to bottom:

1. Chain count.
2. Undo.
3. Redo.
4. Suggestion.
5. Reset.

The Drawing mode button is placed in the lower mode-switch area. The Help button remains pinned at the bottom and opens mode-appropriate instructions.

Palette, garbage, Clear, and Simulate controls are hidden rather than merely disabled.

## Long-chain construction suggestions

Tokopuyo Suggestion is a receding-horizon construction aid. Its default objective is a thirteen-chain field, with the objective stored as replaceable configuration rather than embedded in the traversal code.

The long-term planner uses verified chain fields supporting configurable goals from one through fourteen chains. It adapts each structural field through physical-color permutations and horizontal reflection, selects variants compatible with the locked board, and treats the firing cell specially so completing a small chain early is not mistaken for useful progress.

The short-term planner exhausts legal pair shapes within a bounded beam for exactly the three visible hands: current, Next, and Next Next. It simulates split horizontal landings and automatic resolution after each pair. It must not use hands beyond Next Next even though the deterministic pattern is internally available.

The result is advisory rather than an optimality proof. An arbitrary field or unfavorable future sequence may make the configured goal unreachable, and a bounded beam can discard a globally superior continuation.

The current pair is shown at its final landing cells as two colored dashed circles with centered sparkles. The next two searched placements are lighter, numbered dashed circles. A small set of still fainter circles shows the next accessible target cells after the visible plan; these roadmap cells may change after every committed hand as the planner adapts to the new field and visible queue.

## Active-pair interaction

Tokopuyo is step-driven and has no real-time gravity or movement timer. The active pair waits at its spawn position until the user acts.

Pressing anywhere in the field, including the visual gaps between cells, begins direct manipulation and targets the pressed column. The start area extends by 0.35 cell around the field within the board card, so it does not overlap the sidebar controls. A press in this extension beyond the left or right field edge targets the nearest outer column. The upper pair preview moves directly from its spawn column to that column while retaining its current orientation. If locked puyos prevent the pair from occupying the target column at spawn height, the preview retains its current spawn column. Subsequent horizontal pointer travel moves the upper preview left or right one column at a time. Column thresholds are based on the rendered cell size and use hysteresis so small reversals near a boundary do not make the preview oscillate.

Pointer displacement controls movement and rotation on independent axes for the complete gesture:

- Every 0.7-cell horizontal step from the press point requests one column of movement in the same direction.
- Every 0.7-cell upward step requests one 90-degree clockwise rotation.
- Every 0.7-cell downward step requests one 90-degree counterclockwise rotation.
- Continued vertical travel requests successive quarter turns at 180, 270, and 360 degrees. Four steps return to the initial orientation.
- A diagonal drag can change the requested column and orientation in the same pointer update. There is no translation/rotation mode switch.
- Returning toward the press position reverses the corresponding horizontal or vertical steps. After a step is entered, the pointer must return 0.18 cell past its entry boundary before that step is removed, preventing boundary jitter.

All rotation candidates are constructed directly at the upper preview position. Tokopuyo placement applies no wall kicks or floor kicks. If a requested quarter-turn orientation would put either puyo outside the active-pair area or over a locked puyo, that orientation is skipped and the last valid preview remains visible. Continued vertical movement still evaluates the next quarter-turn, so a blocked 90-degree orientation may jump directly to a valid 180-degree orientation. Horizontal movement similarly retains the last valid column if the current orientation does not fit in a requested adjacent column.

The pair preview updates continuously, while the hand advances only when the originating pointer is released. Additional simultaneous pointers are ignored. Releasing normally commits the last valid column and orientation. Four visible corner targets appear during manipulation. Entering one arms cancellation and previews the original spawn state; releasing inside it cancels, while moving back out disarms cancellation and restores the last valid preview. A gesture that begins inside a corner target must leave and re-enter it before the target can arm, preserving the ability to start anywhere in the field. A browser `pointercancel` also cancels safely.

### Lock and automatic simulation

1. A normal release computes the lowest valid position for the last accepted upper-preview orientation without applying a rotation kick.
2. The two puyos lock into the board. If the pair is horizontal and the two columns have different heights, each puyo falls independently until supported.
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

The current application is a board editor and chain simulator. Its existing six-column, thirteen-row board model and chain-clearing rules remain authoritative for simulation. Tokopuyo adds a source of falling pairs and a session loop; it does not change the existing color-group, gravity, or scoring rules unless a later feature specification explicitly says so. Garbage puyos are not generated in Tokopuyo mode.

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
- No Tokopuyo rotation uses wall kicks or floor kicks in the direct-manipulation interaction variant.
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
- top-out behavior after the game-over decision is finalized.

Statistical tests should not assert that the sequence is independently uniform. The documented distribution is a finite, deterministic set with mode-specific construction and an opening overwrite. Tests should instead verify the data contract and selected known fixtures.

## Evidence and limitations

The following sources were consulted on 2026-08-30:

- [Puyo Camp: Sega Puyo distribution data](https://puyo-camp.jp/posts/86154) — describes 65,536 lines, 256 puyos per line, 128-hand looping, color symbols, and axis-first ordering; it also notes that the data is an observed/community reconstruction rather than an official publication.
- [Puyo Camp: 65,536-pattern Tokopuyo simulator](https://puyo-camp.jp/posts/91012) — documents selecting a pattern at random from the 65,536 patterns, numbering patterns 1–65,536, and searching by the first hands.
- [Puyo Seed Search](https://puyotsumo.oiu-piponeer.com/) — documents the modern 3-/4-/5-color relationship, seed numbering, 128-hand display, and the first-two-hand overwrite from 3-color mode into 4- and 5-color modes.
- [Puyo Nexus: Upcoming Pair Randomizer](https://puyonexus.com/wiki/Puyo_Puyo_Tsu/Upcoming_Pair_Randomizer) — reverse-engineering notes on finite color pools, shuffle bias, and the non-independent nature of the classic Tsu randomizer.
- [Puyo Nexus: Falling Pair Spawning Process](https://puyonexus.com/wiki/Puyo_Puyo_Tsu/Falling_Pair_Spawning_Process) — reverse-engineering notes confirming that pairs are taken successively from randomized pools and that the stored pair colors are used as the falling pair.

These sources do not establish that every historical release has identical data or that Sega officially guarantees this format. The application should label the mode as compatible with the researched modern Sega-style distribution and keep the data source replaceable if a target title or platform is later specified.
