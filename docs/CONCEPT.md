# Puyo Chain Simulator — Product Concept

## Purpose

Puyo Chain Simulator is a lightweight web app for practicing Tokopuyo, designing Puyo Puyo boards, and previewing chain reactions. It opens in Tokopuyo mode with a randomly selected standard pattern. Drawing mode is a secondary board-building submode that can be opened from Tokopuyo when the user wants to design or inspect a field.

## Mode Hierarchy

- Tokopuyo mode is the default entry point and the main step-driven practice experience. It presents the active pair, the next two pairs, and the controls for playing a pattern.
- Drawing mode is a submode for freely editing a board, simulating its chain reaction, and asking for chain-extension suggestions.
- Switching from Tokopuyo to Drawing imports the current settled Tokopuyo field for inspection. Switching back returns to the retained Tokopuyo session; Drawing edits do not replace that session unless the user explicitly starts Tokopuyo from the Drawing board.

## Core Experience

1. The user enters Tokopuyo mode and receives a randomly selected standard pattern with a movable four-color pair.
2. The user uses the five-button bottom bar to move the pair left or right, rotate it, and drop it. The active pair preview updates after every move or rotation, and chains resolve automatically after each placement.
3. The user can switch to Drawing mode to hold a board cell and flick toward a radial menu option for an enabled color or garbage puyo.
4. The user releases without flicking to delete the selected Drawing-mode cell, then starts a simulation to watch groups disappear, pieces fall, and subsequent chains trigger.
5. Drawing mode shows the chain count with the compact right-side controls, while Tokopuyo shows points and chains below the field.
6. The palette button selects the available Drawing-mode color flick options, and a separate control can enable or disable garbage flicking. The palette button cycles through five four-color choices and a five-color choice.
7. The user can ask for suggestions that extend the board's existing latent chain, normally by two or three chains, and compare several distinct dotted-puyo alternatives. The long-chain-focused search follows incomplete structures across several additions, including structures that become connected only after the existing chain fires. Each displayed alternative is a completed, meaningful chain milestone and includes both extension and trigger placements without changing the board. Suggestions are available only after every puyo has landed and while the current board has not yet reached an immediate firing state.
8. In Tokopuyo, Pressureless Ama runs the upstream long-chain construction search in WebAssembly, using only the settled field, Current, and Next as observed input, and recommends the current legal placement with the strongest result across Ama's six sampled unknown continuations.
9. A separate Tokopuyo emergency-attack suggestion searches the current, Next, and Next Next pairs for the highest-scoring safe firing routes. It rotates through up to ten routes in score order and favors faster, shorter-chain attacks when points are equal.
10. After committing a Tokopuyo pair, the user can review that move against Pressureless Ama's analysis of the exact pre-move field, Current, and Next. The review compares Ama's immediate post-move heuristic signals, explains their raw values and weighted contributions, reports future potential and relative variation across six fixed color-pairing tests, and preserves the exact branch results without assigning an absolute grade or claiming that an immediate feature caused Ama's final choice.

## Design Principles

- Mobile-first and comfortable for one-handed use.
- The board is the primary visual element and should use as much available space as possible.
- Controls should be compact, recognizable, and reachable with a thumb.
- The field must remain geometrically accurate: every cell is square.
- The app must work as a dependency-free static site suitable for GitHub Pages.

## Out of Scope

The current concept does not include real-time multiplayer, accounts, cloud storage, scoreboards, sound effects, a real-time falling-piece loop, garbage attacks in Tokopuyo, or a complete competitive Puyo Puyo AI. Tokopuyo suggestions are heuristic construction guidance, not an optimality proof for every field or future sequence.
