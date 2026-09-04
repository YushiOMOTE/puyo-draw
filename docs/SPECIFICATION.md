# Puyo Chain Simulator — Specification

## Application Modes

- Drawing mode is the existing free-form board editor, manual chain simulator, and suggestion interface.
- Tokopuyo mode is a separate step-driven practice mode using deterministic modern Sega-style four-color Tsu patterns.
- The Tokopuyo button is directly above Help at the bottom of the Drawing-mode sidebar. The same position contains the Drawing-mode button while Tokopuyo is active.
- Switching modes preserves each mode's board, history, score, and mode-specific state. Switching modes does not create a history entry.
- Direct board editing, palette selection, garbage mode, Clear, and manual Simulate are unavailable in Tokopuyo mode. Tokopuyo provides separate long-chain construction and emergency-attack Suggestion behaviors.

## Board Model

- Six columns and thirteen rows.
- The bottom twelve rows are the standard visible field.
- The top stored row is the hidden-area row and uses a distinct background color. Tokopuyo additionally tracks Ama's special fourteenth row as a six-bit occupancy mask outside the normal board; Drawing mode does not use it.
- The hidden-area row is outside chain resolution while occupied: its puyos neither form or join clearing groups nor clear as adjacent garbage. Gravity still applies to the full column, so a puyo that falls into the visible twelve rows participates in later group and chain checks normally.
- The standard choke point is marked with an `X` in the third column at the top of the visible field.
- Board cells are always square, including on narrow mobile screens.
- Narrow mobile Drawing-mode layouts keep forced minimum margins around the field: 16px vertically and 10px horizontally, in addition to device safe-area insets.
- Narrow mobile Tokopuyo layouts use the same outer, card, and field-frame spacing as Drawing mode while retaining square cells and the device safe-area insets.

## Puyo Rules

- Supported colors: red, green, blue, yellow, and purple.
- Garbage puyos are supported as a non-color obstacle.
- Four or more orthogonally connected puyos of the same color clear together.
- Garbage puyos do not form color groups. Only garbage puyos directly adjacent to a clearing color group clear at the same time; connected garbage farther away remains.
- The simulation applies gravity once before the first group check, so floating pieces can form the first chain after falling.
- After clearing, each column applies gravity independently.
- Newly connected groups are checked repeatedly until no group of four remains.
- The simulator reports the number of chains and the total number of cleared puyos.

## Editing

- Holding a cell opens a radial menu with the enabled color and garbage options, plus a centered delete icon.
- Releasing without flicking deletes the tapped cell.
- Flicking toward a radial option selects that tool and applies it to the original cell.
- The radial menu uses the active palette's color options. The palette button cycles through five four-color palettes, each omitting a different color, and a sixth five-color palette containing all colors. Garbage mode independently adds garbage. The initial palette is the first four-color palette.
- Undo and redo maintain board snapshots and are disabled when their respective history is empty.
- Clear empties a non-empty board and creates an undo point; clearing an already empty board is a no-op.
- Reset returns to the initial empty board and records the previous board as an undo point, preserving earlier history. It always removes suggestion markers, even when the board is already identical to the initial board.

## Simulation UI

- The chain count box shows the current chain count and cumulative points on two separate lines. Both values remain visible without requiring a toast.
- Reset and Clear reset the chain count and cumulative score to zero. Undo and Redo restore the board, chain count, and cumulative score together.

The left-side rail is ordered from top to bottom:

1. Reset (trash).
2. Drawing/Tokopuyo mode.
3. Help (`i`).

The right-side rail is ordered from top to bottom:

1. Next and Next Next preview (Tokopuyo only), approximately 1.5 times the compact button width.
2. Chain count and cumulative points, matching the preview width.
3. Undo.
4. Redo.
5. Simulate.
6. Suggestion.
7. Palette.
8. Garbage puyo mode.

The Help (`i`) button is pinned to the bottom of the left rail. The reset and mode buttons have no divider between them; the help button remains visually separated.

## Tokopuyo Mode

- The first entry starts immediately with a uniformly selected seed from 0 through 65,535. Reset clears Tokopuyo state and starts another randomly selected pattern.
- The selected four-color pattern contains 128 axis/child pairs and loops after hand 128. The displayed pattern number is `seed + 1` and remains visible near the previews.
- The active pair starts vertically over the third column, with the child above the axis. A virtual row above the modeled thirteen-row board allows the spawn position to be rendered without changing the locked-board model.
- Tokopuyo legal placements match Ama's move generator, including spawn-path checks, floor kicks, quick turns, the special fourteenth row, and the standard third-column death check. Manual movement and rotation can reach every placement accepted by that generator, and a drop cannot commit a placement it rejects.
- A child that locks in the special fourteenth row is recorded as colorless occupancy outside the normal board. It does not fall, clear, or join a group and remains occupied across later hands, chains, and Undo/Redo. It prevents another child from locking in the same special cell when Ama's move rules test that destination, but does not obstruct an active pair merely moving through the virtual display row.
- Next and Next Next appear in a compact preview area above the Tokopuyo sidebar.
- A five-button bottom bar spans the full bottom edge in Tokopuyo mode. Its left side has Move Left and Move Right. Its right side has Rotate Counterclockwise, Drop, and Rotate Clockwise.
- Each movement or rotation immediately updates the active-pair preview above the field. Drop hard-drops the previewed pair into its current position; field cells do not select or place pairs.
- Quarter-turn rotations use the existing Tsu-style wall kicks.
- On lock, horizontally separated puyos fall independently when their columns have different heights. The current hand advances only after lock.
- Groups of four or more trigger the existing chain animation and scoring automatically. Pair input and history controls are disabled until resolution finishes.
- The chain count and cumulative score describe the most recently committed hand. A non-clearing hand resets both to zero, and both values are shown in the two-line chain box.
- Tokopuyo Undo/Redo is independent from Drawing mode. One committed pair and its complete chain result form one atomic history entry; pre-lock movement and rotation are not history entries. Redo restores the resolved state without replaying animation.
- After chain resolution, occupancy of the marked third-column choke point ends the session. Reset, Undo, Drawing mode, and Help remain available at game over.
- The Tokopuyo right-side rail ends above the bottom control bar and contains, below the previews: Chain count, Undo, Redo, long-chain Suggestion, emergency-attack Suggestion, and Palette/Garbage controls are hidden. Reset and the Drawing mode switch are on the left rail, with Help pinned at the bottom.
- The Tokopuyo right-side rail also contains Review Last Move below the two Suggestion actions. It is enabled after a completed committed pair, including at game over, and disabled while a pair is resolving or any Ama search is running.
- The Tokopuyo right-side rail contains a chain step-mode toggle. The same blue highlight used for enabled garbage mode identifies when step mode is enabled. When enabled, a committed pair that starts a chain replaces the five pair controls at the bottom with Previous Step, Next Step, Play, and Stop controls. Previous and Next move between the locked field and each completed chain round; advancing a round shows its clearing and gravity animation. Play advances the remaining rounds automatically, and Stop pauses that automatic playback without discarding the current step.
- While a Tokopuyo chain is in step mode, Undo, Redo, and Reset remain available. Undo or Redo first cancels the in-progress step view and then restores the normal atomic pre-placement or post-placement history snapshot; Reset cancels it and starts a new pattern.
- The Help overlay shows instructions for the active mode.

The detailed generator, interaction, history, and verification contract is in `docs/TOCOPUYO_TSUMO_SPECIFICATION.md`.

The Palette button cycles through all five four-color palettes and then the five-color palette. The five-color state is shown with five colored circles arranged like the face of a die.

During the clearing animation, directly adjacent garbage puyos receive the same clearing animation and timing as the color puyos that trigger their removal.

The rail uses square icon buttons without explanatory labels in the compact layout. Accessibility labels and tooltips must still describe each action in English.

Long-pressing the board or controls must not enter browser text-selection or touch-callout mode.

The document itself must not scroll on mobile; the field and controls fit within the app's actual available area, including device safe-area insets, by reducing the field size when necessary.

The Help button opens a modal instruction overlay. The overlay contains a visual example of the radial flick menu and short explanations for color placement, garbage placement, deletion, Suggestion, Palette, and Garbage mode. It closes from the top-right close button, by clicking outside the card, or with the Escape key. The help card scrolls internally when its content exceeds the viewport; the page behind it must not scroll.

Toast notifications use the browser language: Japanese for Japanese locales and English otherwise. Toasts are used for reset, undo, redo, clear, and no-chain feedback. Chain progress/completion and suggestion searches, results, and precondition feedback are shown without toasts. Cell placement messages are not shown as toasts.

Suggestion precondition errors do not use toasts; the suggestion action leaves the current board unchanged when it is floating or already able to fire.

## Chain Suggestions

The following requirements describe Drawing-mode suggestions. Tokopuyo uses the separate long-chain planner below.

- The Suggestion button searches for additions that produce a chain from the current board and shows one candidate at a time as colored, dashed circles in the field.
- Suggestions are calculated only when every puyo is already resting at the bottom of its column or on another puyo. A board with any floating puyo is rejected before search.
- A candidate can contain multiple puyos. Suggested puyos are visual only: they do not change the board or create history entries.
- Pressing Suggestion again cycles through the cached alternatives for the unchanged board and active palette.
- Suggestions use only the active four- or five-color palette. They never suggest garbage puyos.
- The solver adds puyos only to the next available position in a column and never suggests the hidden row or choke point. It searches up to twenty added puyos, returns up to eight candidates, and has a five-second search budget followed by a separate 300ms candidate-minimization budget.
- The default solver is a long-chain-focused hybrid search. It uses a depth-stratified beam so highly rated shallow states cannot indefinitely starve deeper construction paths, retains candidates across distinct column-height profiles, and combines one-puyo moves with selected stable two-puyo same-column macro moves.
- The hybrid evaluation combines the Ama-inspired connected-group, bridge, field-height, roughness, hole, and hidden-area score with a separate score for the residue left after the state's best legal trigger. This rewards incomplete chain parts that become connected only after the existing latent chain fires.
- The Ama-inspired best-first solver and the original beam solver remain available through the solver registry for comparison and future tuning. This project does not claim to port the complete Ama engine, opponent model, pair-piece search, or its exact evaluation weights.
- Hybrid, Ama, and Beam are responsible only for traversal order, frontier management, macro generation, and solver-specific scoring. A shared search policy evaluates states, rejects unstable immediate-clearing additions, and records raw chain milestones consistently for every solver.
- The design is informed by the [Ama project](https://github.com/citrus610/ama) and the paper [Playing PuyoPuyo: Two Search Algorithms for Constructing Chain and Tactical Heuristics](https://hdl.handle.net/10119/10925). No source code is copied from Ama.
- Before searching, the solver estimates the board's latent chain count. By default, a non-immediate chain must have a legal one-puyo trigger completing an existing connected group of three.
- Trigger plans requiring two specific puyos are excluded by default. This avoids suggestions that depend on a specific 1/8 two-color pair or 1/16 same-color pair. The limit is configurable through `maxTriggerPuyos`.
- Trigger placements are tracked separately from extension placements. The selected trigger uses the same colored dotted-circle style with a small centered sparkle, and the toast's addition count includes both kinds of placement.
- Extension placements must leave the board stable after every addition. Any search move that creates an immediate clearing group is rejected as an extension; the legal trigger plan is calculated separately after evaluating the stable extended board.
- If the current board already clears immediately, including after the simulator's initial gravity step, all solvers return no suggestions. The solver does not rewind, remove, or replace an already confirmed trigger.
- A candidate must increase the latent chain count. The default goal is an extension of at least two chains, with three additional chains as the preferred target. One-chain extensions are returned only as a fallback when the preferred minimum is not found.
- Search limits and extension goals are centralized in `solver/suggestion-config.js`, so the target chain gain, trigger-puyo limit, time budget, result count, and search size can be tuned without changing solver implementations.
- Raw search milestones retain their full placement paths, including pieces that may become useful to a deeper descendant and both placements from any macro move. Before display, a shared candidate pipeline greedily minimizes a bounded shortlist. A placement is removed when it supports no higher puyo and removing it does not reduce the candidate's chain count; the trigger plan is recalculated after every removal. Placements required as structural support are preserved even if they do not clear directly.
- An unfinished future-oriented cluster remains available to continued internal search but is hidden from its current lower-chain milestone. If a descendant uses that cluster to complete another chain, the longer descendant is eligible as a new completed candidate and ranks ahead of the lower milestone. If minimization cannot fully validate a candidate within its budget, that candidate is not displayed.
- Candidate identity is the canonical set of all visible extension and trigger cells with their colors. Candidates with the same visible suggestion are collapsed, regardless of placement order or whether a cell was internally classified as an extension or trigger. Colors absent from the original board are treated as interchangeable when detecting color-symmetric duplicates; colors already present on the board remain distinct.
- Longer chains rank ahead of shorter chains even when they require more added puyos. For equal chain counts, fewer total extension and trigger additions rank ahead of cleared-puyo count.
- Editing a suggested cell removes that cell's marker. Editing any cell invalidates the candidate cycle while leaving other visible markers in place.
- Starting a simulation, clearing, resetting, undoing, redoing, or changing palette/mode removes all suggestion markers and cached alternatives. Clear and Reset do so even when the underlying board would otherwise be a no-op, and an in-flight search cannot restore suggestions after either action.
- While a suggestion search is running, board cells, Undo, Redo, Simulate, and Reset are disabled, and a translucent spinner overlay is centered over the field. The board and controls become available again when the search succeeds or fails.
- Suggestions run in a Web Worker and stale results are ignored when the board or palette has changed. The worker is created lazily on the first Suggestion action, so loading the page never initializes the solver or blocks board rendering. The search timeout starts only after the worker reports that its modules are ready, so initial loading time on a mobile device does not consume the search budget. A failed or unresponsive worker is discarded and may be started fresh by the next Suggestion action. Solver code is never run on the UI thread.

## Tokopuyo Long-Chain Suggestions

- Tokopuyo Suggestion uses Pressureless Ama's upstream build-search implementation compiled to WebAssembly. It asks which Current placement best develops a long-chain field when there is no opponent pressure; it is not versus-tactical advice.
- The observed solver input is exactly the settled field, special-fourteenth-row mask, Current, and Next. It does not inspect the session's actual Next Next or any later deterministic hand.
- After Current and Next, Ama appends each of its six predetermined unknown continuations. For every legal Current placement, each branch records the maximum chain score found, and the six branch scores are summed. Candidates rank by that aggregate, matching Ama's expected-chain-score selection policy.
- The initial search baseline is depth 16, beam width 250, the upstream `build` weights, a 95,000-point early trigger, and stretch enabled. Search parameters remain centralized for benchmark-driven tuning.
- The field bitset, SIMD chain simulation, legal moves, beam expansion, static evaluation, quiescence behavior, transposition table, pattern evaluation, and sampled queues come from the pinned upstream Ama revision. Tokopuyo does not replace them with JavaScript heuristics.
- The current pair's final landing cells are shown as colored dashed circles with centered sparkles. A child recommended for the special fourteenth row is shown in the virtual row above the stored board. Conditional future placements are not displayed.
- Up to four ranked Current alternatives are cached. Pressing Suggestion again cycles through them without rerunning search. Committing a pair, Undo, Redo, Reset, or changing mode removes the cache.
- The status line identifies Pressureless Ama and reports the average of the six per-branch maximum chain scores. This number describes sampled search output, not a calibrated probability or a complete explanation of move quality.
- Search uses a lazily initialized pool of three ordinary Web Workers. The six independent branches are distributed across the pool without Wasm pthreads or cross-origin isolation. Changing pool size affects latency and memory, not the aggregated result.
- The initial timeout is eight seconds after Worker initialization. A timeout or Worker failure discards the pool so the next request starts cleanly. Stale results are ignored when the field, hand index, seed, or special-row mask changes.

## Tokopuyo Emergency-Attack Suggestions

- Tokopuyo provides a separate emergency-attack Suggestion button below the long-chain construction Suggestion. It searches only the current, Next, and Next Next pairs and recommends ways to produce the highest chain-clear score visible within those hands.
- Search exhaustively considers legal pair placements until the configured time budget. A route stops at its first firing hand; hands after that clear are neither searched nor displayed. A route that reaches game over after any committed hand, including after its attack resolves, is excluded.
- Candidates rank by total chain-clear points. Equal-point candidates rank by an earlier firing hand, then by fewer chains, then by a deterministic placement order.
- The current pair uses the existing colored dashed circles with centered sparkles. Next and Next Next use the existing progressively lighter numbered circles. Emergency-attack suggestions do not add ignition or roadmap markers.
- Display-identical routes are collapsed and up to ten candidates are cached. Pressing the emergency-attack Suggestion again rotates through them from strongest to weakest. Its cache is independent from the long-chain construction cache, but only the most recently requested suggestion type is drawn.
- Committing a pair, Undo, Redo, or Reset removes both Tokopuyo suggestion caches. Both Suggestion buttons and pair input are disabled while either search runs. Worker results are ignored when the field or visible queue has changed.

## Tokopuyo Last-Move Review

- Every committed pair records a self-contained description of the immediately preceding position: the settled field, special-fourteenth-row mask, hand index, Current, Next, final locked cells, canonical column and orientation, and the resulting chain, score, and game-over state.
- Last-move data is part of the atomic Tokopuyo snapshot. Undo and Redo restore the appropriate review target. Reset or a new pattern removes it. Moving or rotating the following active pair does not change it.
- Review Last Move runs Pressureless Ama against the recorded pre-move position with the same depth, width, six predetermined future queues, and Current/Next boundary as long-chain Suggestion. It never evaluates the already-advanced field with the new queue.
- The underlying analysis retains every Ama-ranked legal Current placement. Long-chain Suggestion displays only its first four, while review matches the user's final locked-cell set against the complete result. Cell-set matching treats display-equivalent same-color and kicked placements as the same move.
- The review identifies whether the user's move is Ama's first choice, a score-tied alternative, or a different recommendation. It reports the user's ordinal rank among the returned legal moves, the actual committed hand's chain and score, both six-branch average, minimum, and maximum found chain scores, their average difference, and a single compact table of how many branches favor the user, tie, or favor Ama's aggregate-best move. Potential retained is the user's six-branch aggregate divided by Ama's aggregate; it is not a probability or accuracy score.
- A six-row comparison chart shows the user's and Ama's maximum found chain score in each sampled future. Bars share one scale within the report and retain exact numeric labels. The chart is search evidence, not a probability distribution; the six predetermined continuations are not presented as six equally likely real queues.
- Each chart row identifies its fixed alternating unequal-color pair pattern using compact physical-color puyo icons with an accessible text label. The patterns are synthetic test continuations after Current and Next, not draws from the session seed.
- The mean of the six maximum found scores is labeled future potential. Population standard deviation divided by that unrounded mean is displayed as relative variation. Lower relative variation may be described comparatively as more stable across Ama's six pairing tests, but stability does not affect Ama's candidate ordering and does not describe versus resilience, timing, or real-queue probability. Stability is unavailable when the mean is zero, and differences below five percentage points are described as similar.
- When a different user move retains at least 90% of Ama's aggregate six-branch score, the report may state only the objective fact that the aggregate scores are within 10%. It does not relabel the move as good or assign a letter or numeric grade.
- For matched surviving placements, a diagnostic Wasm entry point evaluates both resolved Current-placement fields with Ama's exact `build` weights. The report separates immediate beam priority from final six-future ranking and states when the user's field has the higher immediate value even though Ama selected another placement.
- The two comparison boards initially show the field immediately after the user's locked Current pair and Ama's chosen Current pair land, before resolving an immediate clear. Both landed puyos remain outlined, and a compact label identifies a firing move. This placement preview is intentionally distinct from Ama's resolved evaluation field. Selecting Show on boards replaces both previews with the resolved post-clear fields and overlays the selected cell or column evidence; pre-clear placement outlines are not carried onto a resolved field. The diagnostic report exposes each heuristic's raw value and weighted contribution, explains how Ama measures it, and identifies the best hypothetical multi-chain trigger probe within three same-color additions. Trigger additions are hypothetical evaluator probes, not real known future pieces. Pair split and immediate-clear action costs are separate from static board signals.
- Potential, variation, immediate priority, and the largest weighted feature gaps use paired or diverging bars. The top summary metrics and report terms have adjacent question-mark disclosures. Long definitions and raw calculations stay behind those disclosures, and tapping elsewhere in the report closes any open disclosure. The six detailed future rows and complete feature table are collapsed by default.
- Runtime diagnostics verify that the displayed static and action contribution totals exactly match Ama's evaluator. A mismatch makes diagnostics unavailable rather than presenting divergent calculations.
- The reported values are bounded search and heuristic results, not an absolute grade or proof that a move is good or bad. Immediate feature differences are not presented as causes of later maximum chain scores.
- A review dialog contains a compact read-only comparison of the recorded pre-move field with the user's locked cells and Ama's preferred locked cells. It does not mutate the current session or history.
- Each surviving comparison move with a positive found score offers a Best future replay. It selects the first of that move's six fixed future branches that attained its highest score, reruns the same Ama beam search with path observation enabled, and rejects the replay unless every Current-placement score, the selected Current placement, and the final chain score match the original analysis exactly. A tie across future branches is disclosed in the replay metadata.
- Replay begins from the recorded pre-move field and uses Current, Next, then the selected synthetic branch's repeating physical-color pair pattern. Next advances one complete hand: it displays the pair, locks it at Ama's placement, resolves the full chain with the same clear and gravity animation timing as the main Tokopuyo field, and then displays the following pair. Play repeats that operation automatically and may be paused; Start restores the untouched pre-move field. Replay never changes the live session, score, Undo/Redo history, or suggestion caches.
- A zero-score future, an excluded Current placement, or a position without a surviving comparison move has no replay button. `Replay unavailable` is reserved for defensive trace timeout or parity-validation failure and is not an expected normal result for an enabled replay.
- If the committed move caused game over and therefore is absent from Ama's surviving candidates, the dialog explains that Ama excluded the move because it occupied the choke point. If no placement survives, the dialog says so without inventing an Ama choice. Other unmatched results are reported as unavailable rather than assigned a fabricated score.
- A completed position analysis is cached by the pre-move field, special-row mask, seed, and hand index. A review immediately following a matching long-chain Suggestion reuses that analysis; otherwise it starts one normal Pressureless Ama search. Stale review results are ignored if the review target changes during the search.
- Closing the dialog, clicking its backdrop, or pressing Escape returns to the unchanged current field. The dialog scrolls internally when necessary and remains usable at narrow mobile widths.

## Technical Constraints

- Use plain HTML, CSS, and JavaScript modules.
- Keep the chain engine independent from the DOM so it can be tested with Node.js.
- Keep suggestion solvers independent from the DOM. The worker-facing solver contract lives in `solver/contract.js`. `solver/solver-registry.js` selects a traversal implementation, `solver/search-policy.js` applies shared search rules and records raw milestones, and `solver/candidate-pipeline.js` creates public display candidates.
- Keep Tokopuyo queue generation, active-pair movement, pure pair placement, long-chain planning, last-move comparison, and session history independent from the DOM in `tokopuyo/queue.js`, `tokopuyo/pair-engine.js`, `tokopuyo/pressureless-ama.js`, and `tokopuyo/session.js`.
- At the Ama boundary, map `pattern.colors[0..3]` to Ama `RED`, `YELLOW`, `GREEN`, and `BLUE` respectively. This is an abstract-color mapping: a physical purple puyo is valid when purple occupies one of those four pattern slots. Reject any board color outside the session's selected four colors.
- Pressureless Ama is the explicit exception to the otherwise dependency-free build policy. Its pinned C++ source is compiled with Emscripten by `npm run build-ama`; generated JavaScript and WebAssembly are committed, so local use and deployment do not require Emscripten or a runtime package dependency.
- GitHub Pages deployment is provided by `.github/workflows/deploy.yml`.
- The Pages workflow appends the deployment commit SHA to every local JavaScript and CSS reference, including transitive module imports and the suggestion worker URL, so a browser cannot combine modules from different releases.
- Local development uses the dependency-free `npm run dev` server, which listens on `0.0.0.0` for same-network device testing and sends `Cache-Control: no-store` for every response.

## Verification

The logic tests cover four-puyo clearing, gravity, settled and floating board detection, a gravity-created second chain, direct garbage clearing, one-puyo and configurable two-puyo latent triggers, rejection of suggestions for already confirmed triggers, clean failure when workers are unavailable, shared stable-state policy, preservation of full raw search paths, meaningful display-candidate minimization, hybrid long-chain discovery, beam and Ama-inspired traversal, trigger display data, complete-suggestion deduplication, configurable extension-goal ranking, six-column board width, deterministic Tokopuyo generation and wraparound, Tokopuyo active-pair movement and rotation, orientation previews, quarter-turn wall kicks, pure split-pair placement, Pressureless Ama color conversion, six-branch aggregation, complete-placement review ranking, tied and excluded review results, last-turn Undo/Redo restoration, preservation of an existing one-puyo main chain in the legacy comparison solver, automatic chains, atomic history, and choke-point game over. UI changes should also be checked in a mobile-sized browser viewport.
