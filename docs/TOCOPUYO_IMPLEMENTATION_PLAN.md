# Tokopuyo Implementation Plan

## Status

This plan covers the first step-driven, 4-color Tokopuyo release described in `TOCOPUYO_TSUMO_SPECIFICATION.md`. It intentionally excludes Tokopuyo suggestions, real-time falling, garbage attacks, multiplayer behavior, 3-/5-color modes, and free board editing inside Tokopuyo mode.

Implemented and verified on 2026-08-30. The implementation uses the documented deterministic generator instead of distributing a complete pattern asset.

## Architecture

Keep four concerns separate:

```text
official-style pattern data
  -> deterministic tsumo provider
  -> pure active-pair/session model
  -> DOM rendering and flick controls
  -> existing chain animation and scoring
```

The Drawing mode state remains owned by the existing application behavior. Tokopuyo receives its own board, history, score, seed, hand index, active pair, and busy/game-over flags. A top-level mode controller chooses which state and controls are rendered.

## Phase 1: Pattern data and deterministic provider

1. Reproduce the documented modern 32-bit generator and three-pass pool shuffle on demand.
2. Keep generation DOM-independent and validate seed boundaries, hand lookup, preview lookup, and 128-hand wraparound.
3. Do not fall back to independent random colors.
4. Verify a known seed-to-opening mapping from an independent published example.

Deliverable: a tested API that returns the current, Next, and Next Next pairs for any valid seed and hand index.

## Phase 2: Pure pair-placement model

1. Define active-pair state as axis position, orientation, axis color, and child color.
2. Represent the extra spawn row in active-pair coordinates without expanding the locked 13-row board.
3. Implement pure collision checks, one-column movement, clockwise/counterclockwise rotation, hard-drop distance, split horizontal landing, and lock conversion.
4. Implement the chosen rotation-correction and game-over rules.
5. Add tests for every orientation at both walls, uneven columns, blocked movement, blocked rotation, hidden-row interaction, split landing, and top-out.

Deliverable: deterministic state transitions with no DOM or animation dependency.

## Phase 3: Tokopuyo session and history

1. Add a session model containing seed, selected colors, hand index, board, active pair, previews, score, history, future, phase, and game-over state.
2. Make hand commit atomic: capture the pre-hand snapshot, lock the pair, resolve chains, advance the hand, and store the stable result for Redo.
3. Restore the active pair at spawn orientation when Undo returns to a previous hand.
4. Implement Reset according to the finalized seed policy.
5. Keep Drawing and Tokopuyo session state separate across mode switches.

Deliverable: a headless Tokopuyo run that can advance, undo, redo, reset, switch away, and resume reproducibly.

## Phase 4: Mode-aware layout and controls

1. Add a top-level mode state and a Tokopuyo mode button above Help in Drawing mode.
2. Refactor the right rail into a mode-aware panel. In Tokopuyo mode, render Next/Next Next above the controls and show only Chain, Undo, Redo, Reset, Drawing mode, and Help.
3. Render the active pair in a board-relative overlay so it may occupy the virtual fourteenth row.
4. Disable board-cell pointer handlers in Tokopuyo mode.
5. Add mode-specific accessibility labels, tooltips, focus behavior, and English UI/help text.
6. Recalculate responsive sizing so the field remains square-celled and the document does not scroll at narrow mobile dimensions.

Deliverable: both modes render correctly and preserve the existing compact sidebar design.

## Phase 5: Flick interaction and animation integration

1. Build a direct-manipulation column preview rather than showing a flick menu.
2. Map horizontal movement to 90-degree rotation and vertical movement to cancel or 180-degree rotation, with vertical intent taking priority.
3. Show split/chigiri landing positions during horizontal previews and restore the spawn preview on cancellation.
4. On hard drop, animate placement, run the existing clear/gravity animation automatically when needed, then spawn the next pair.
5. Disable pair and history input during lock and chain animation.
6. Ensure stale pointer events cannot mutate a session after Reset or a mode switch.

Deliverable: the complete step-driven touch interaction.

## Phase 6: Verification and documentation synchronization

1. Add focused logic tests to `tests.mjs` or split tests into dedicated dependency-free modules if the file becomes difficult to maintain.
2. Update `docs/SPECIFICATION.md` only when the feature is implemented, so it continues to describe controls that actually exist.
3. Update Help content for both modes and compare documented controls, board dimensions, interaction rules, and simulation rules against `index.html`, `app.js`, and `engine.js`.
4. Run `node --check app.js`, `node tests.mjs`, and `git diff --check`.
5. Run `npm run dev` and verify at narrow mobile viewports, including touch flicks, virtual spawn-row clipping, preview spacing, rotation at walls, split drops, automatic chains, game over, Undo/Redo, Reset, and both mode switches.

Deliverable: verified implementation with current-behavior documentation synchronized in the same change.

## Main risks

- The current 13-row board was designed for settled cells; active-pair coordinates need a carefully isolated virtual row.
- Official rotation and top-out rules are more detailed than the four visible commands and must be agreed before tests can define correctness.
- Existing history snapshots contain only board/score data, so sharing them between modes would lose seed and hand state.
- The current sidebar fills most narrow screens. Adding previews above it requires responsive layout testing early, not only at final polish.
