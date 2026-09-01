# Puyo Chain Simulator — Specification

## Application Modes

- Drawing mode is the existing free-form board editor, manual chain simulator, and suggestion interface.
- Tokopuyo mode is a separate step-driven practice mode using deterministic modern Sega-style four-color Tsu patterns.
- The Tokopuyo button is directly above Help at the bottom of the Drawing-mode sidebar. The same position contains the Drawing-mode button while Tokopuyo is active.
- Switching modes preserves each mode's board, history, score, and mode-specific state. Switching modes does not create a history entry.
- Direct board editing, palette selection, garbage mode, Clear, and manual Simulate are unavailable in Tokopuyo mode. Tokopuyo provides its own long-chain construction Suggestion behavior.

## Board Model

- Six columns and thirteen rows.
- The bottom twelve rows are the standard visible field.
- The top row is the hidden-area row and uses a distinct background color; the former fourteenth row is not modeled because puyos do not fall into it.
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

- The chain count button shows the current chain count and displays the cumulative chain-clear score in a toast when tapped. Each chain toast displays that step's score and the cumulative score.
- Reset and Clear reset the chain count and cumulative score to zero. Undo and Redo restore the board, chain count, and cumulative score together.

The right-side rail is ordered from top to bottom:

1. Chain count.
2. Undo.
3. Redo.
4. Simulate.
5. Suggestion.
6. Reset.
7. Palette.
8. Garbage puyo mode.
9. Tokopuyo mode.

The Help (`i`) button is pinned to the bottom of the rail.

## Tokopuyo Mode

- The first entry starts immediately with a uniformly selected seed from 0 through 65,535. Reset clears Tokopuyo state and starts another randomly selected pattern.
- The selected four-color pattern contains 128 axis/child pairs and loops after hand 128. The displayed pattern number is `seed + 1` and remains visible near the previews.
- The active pair starts vertically over the third column, with the child above the axis. A virtual row above the modeled thirteen-row board allows the spawn position to be rendered without changing the locked-board model.
- Next and Next Next appear in a compact preview area above the Tokopuyo sidebar.
- A five-button bottom bar spans the full bottom edge in Tokopuyo mode. Its left side has Move Left and Move Right. Its right side has Rotate Counterclockwise, Drop, and Rotate Clockwise.
- Each movement or rotation immediately updates the active-pair preview above the field. Drop hard-drops the previewed pair into its current position; field cells do not select or place pairs.
- Quarter-turn rotations use the existing Tsu-style wall kicks.
- On lock, horizontally separated puyos fall independently when their columns have different heights. The current hand advances only after lock.
- Groups of four or more trigger the existing chain animation and scoring automatically. Pair input and history controls are disabled until resolution finishes.
- The chain count and cumulative score describe the most recently committed hand. A non-clearing hand resets both to zero.
- Tokopuyo Undo/Redo is independent from Drawing mode. One committed pair and its complete chain result form one atomic history entry; pre-lock movement and rotation are not history entries. Redo restores the resolved state without replaying animation.
- After chain resolution, occupancy of the marked third-column choke point ends the session. Reset, Undo, Drawing mode, and Help remain available at game over.
- The Tokopuyo sidebar ends above the bottom control bar and contains, below the previews: Chain count, Undo, Redo, Suggestion, and Reset. Drawing mode is in the lower mode-switch position and Help remains pinned at the bottom.
- The Help overlay shows instructions for the active mode.

The detailed generator, interaction, history, and verification contract is in `docs/TOCOPUYO_TSUMO_SPECIFICATION.md`.

The Palette button cycles through all five four-color palettes and then the five-color palette. The five-color state is shown with five colored circles arranged like the face of a die.

During the clearing animation, directly adjacent garbage puyos receive the same clearing animation and timing as the color puyos that trigger their removal.

The rail uses square icon buttons without explanatory labels in the compact layout. Accessibility labels and tooltips must still describe each action in English.

Long-pressing the board or controls must not enter browser text-selection or touch-callout mode.

The document itself must not scroll on mobile; the field and controls fit within the app's actual available area, including device safe-area insets, by reducing the field size when necessary.

The Help button opens a modal instruction overlay. The overlay contains a visual example of the radial flick menu and short explanations for color placement, garbage placement, deletion, Suggestion, Palette, and Garbage mode. It closes from the top-right close button, by clicking outside the card, or with the Escape key. The help card scrolls internally when its content exceeds the viewport; the page behind it must not scroll.

Toast notifications use the browser language: Japanese for Japanese locales and English otherwise. Toasts are used for chains, reset, undo, redo, clear, and no-chain feedback. Cell placement messages are not shown as toasts.

Suggestion precondition errors also use localized toasts. A floating board asks the user to land every puyo, while a board that already contains a clearing group explains that it can already fire.

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

- Tokopuyo Suggestion recommends the current pair placement as part of a long-chain construction plan. It does not prioritize a small chain merely because that chain can fire within the visible three hands.
- The requested chain goal is centralized as `targetChains` in `tokopuyo/suggestion-config.js`. The default is thirteen chains, and verified goal fields support values from one through fourteen without changing the search implementation.
- Each supported chain count has independently verified goal fields. Every goal has a stable, non-firing construction board with one empty legal ignition cell; placing its specified color in that cell reproduces the verified chain count. The planner maps the four abstract colors to the session's physical colors and can reflect the goal horizontally.
- The planner ranks the goal variants against the current field, then searches legal placements for the current, Next, and Next Next pairs. It uses only these three visible pairs and does not inspect later hands from the deterministic pattern.
- Pair search observes axis/child colors, all legal columns and orientations, independent landing of horizontal puyos, automatic chain resolution after every hand, the hidden area, and the choke point.
- Before ranking construction moves, the planner analyzes the current main chain. The current main chain is the greatest chain count reachable by dropping one legal single puyo into the stable field. All equally long one-puyo ignition routes are retained, including their cells and colors.
- A non-clearing current-pair move is rejected when it reduces the current main chain's one-puyo-accessible chain count. This safety rule is applied to the current recommended hand; the planner recalculates the main chain after every committed hand.
- After each shortlisted current, Next, and Next Next route, the planner evaluates all sixteen ordered color pairs that may appear beyond the visible preview. A pair is covered when at least one legal response either fires the horizon's analyzed main chain or leaves one of its best ignition routes legally accessible. Higher unknown-pair coverage ranks ahead of long-term template progress.
- Remaining legal columns, left/right occupied-capacity difference, surface roughness, and dangerous peak height form a secondary field-balance score. This measures usable capacity rather than requiring a visually symmetric field.
- Building the selected goal and preserving field capacity rank ahead of short immediate chains. A construction move that occupies or builds over the protected ignition point without firing is rejected. A clear below the configured minimum firing ratio is excluded while any non-clearing continuation exists; it is returned only as an explicitly labeled emergency-clear fallback.
- At every visible hand, the planner checks whether a legal pair placement can put the required color in the protected ignition cell, place the partner safely, and produce at least the configured minimum chain count. This can recognize a vertical pair that supplies the last support and ignition puyo together.
- The current pair's two landing cells use colored dashed circles with centered sparkles. The searched Next and Next Next placements use progressively lighter dashed circles with step numbers `2` and `3`.
- The long-term roadmap shows a bounded set of faint colored dashed circles. These are the next accessible cells of the currently selected goal structure, not promises about unseen future pairs.
- The current main-chain ignition cell is shown as a colored double dashed circle with a lightning mark. It pulses when the current pair can fire it. The long-term goal ignition uses a lighter lightning marker. A current-pair marker keeps its centered sparkle and adds the lightning as a corner badge when meanings share a cell.
- The toast reports the current main-chain size, whether the current pair can fire it, unknown-pair coverage out of sixteen, and the long-term goal ignition. When no one-puyo main chain exists yet, it identifies the move as main-chain base construction.
- Pressing Suggestion again cycles through cached alternatives with distinct current-pair placements. Committing a pair, Undo, Redo, or Reset removes the Tokopuyo suggestion and its cache.
- Tokopuyo suggestion work uses the existing lazy Web Worker and stale-result protection. Pair input and relevant controls are disabled while it runs.

## Technical Constraints

- Use plain HTML, CSS, and JavaScript modules.
- Keep the chain engine independent from the DOM so it can be tested with Node.js.
- Keep suggestion solvers independent from the DOM. The worker-facing solver contract lives in `solver/contract.js`. `solver/solver-registry.js` selects a traversal implementation, `solver/search-policy.js` applies shared search rules and records raw milestones, and `solver/candidate-pipeline.js` creates public display candidates.
- Keep Tokopuyo queue generation, active-pair movement, pure pair placement, long-chain planning, and session history independent from the DOM in `tokopuyo/queue.js`, `tokopuyo/pair-engine.js`, `tokopuyo/suggestion-solver.js`, and `tokopuyo/session.js`.
- Do not add a build step or runtime dependency without an explicit product decision.
- GitHub Pages deployment is provided by `.github/workflows/deploy.yml`.
- The Pages workflow appends the deployment commit SHA to every local JavaScript and CSS reference, including transitive module imports and the suggestion worker URL, so a browser cannot combine modules from different releases.
- Local development uses the dependency-free `npm run dev` server, which listens on `0.0.0.0` for same-network device testing and sends `Cache-Control: no-store` for every response.

## Verification

The logic tests cover four-puyo clearing, gravity, settled and floating board detection, a gravity-created second chain, direct garbage clearing, one-puyo and configurable two-puyo latent triggers, rejection of suggestions for already confirmed triggers, clean failure when workers are unavailable, shared stable-state policy, preservation of full raw search paths, meaningful display-candidate minimization, hybrid long-chain discovery, beam and Ama-inspired traversal, trigger display data, complete-suggestion deduplication, configurable extension-goal ranking, six-column board width, deterministic Tokopuyo generation and wraparound, Tokopuyo active-pair movement and rotation, orientation previews, quarter-turn wall kicks, pure split-pair placement, stable non-firing construction goals with legal ignition cells for chain counts one through fourteen, visible-pair ignition, visible-three-hand Tokopuyo planning, automatic chains, atomic history, and choke-point game over. UI changes should also be checked in a mobile-sized browser viewport.
