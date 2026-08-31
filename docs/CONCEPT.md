# Puyo Chain Simulator — Product Concept

## Purpose

Puyo Chain Simulator is a lightweight web app for designing Puyo Puyo boards and previewing chain reactions. It is intended for quick experimentation on a phone, with touch interaction taking priority over dense controls.

## Core Experience

1. The user holds a board cell and flicks toward a radial menu to choose an enabled color or garbage option.
2. The user releases without flicking to delete the cell.
3. The user starts a simulation to watch groups disappear, pieces fall, and subsequent chains trigger.
4. The chain count and compact controls are shown in the right-side control rail.
5. The palette button selects the available color flick options, and a separate control can enable or disable garbage flicking.
6. The palette button cycles through five four-color choices and a five-color choice.
7. The user can ask for suggestions that extend the board's existing latent chain, normally by two or three chains, and compare several distinct dotted-puyo alternatives. The long-chain-focused search follows incomplete structures across several additions, including structures that become connected only after the existing chain fires. Each displayed alternative is a completed, meaningful chain milestone and includes both extension and trigger placements without changing the board. Suggestions are available only after every puyo has landed and while the current board has not yet reached an immediate firing state.
8. The user can switch to a separate step-driven Tokopuyo practice mode, drag official-style four-color pairs horizontally, rotate them according to vertical drag distance, preview the next two pairs, and let chains resolve automatically after each placement. A Tokopuyo suggestion planner can recommend the current legal pair placement while steering the field toward a configurable long-chain goal and showing an adaptable dotted roadmap.

## Design Principles

- Mobile-first and comfortable for one-handed use.
- The board is the primary visual element and should use as much available space as possible.
- Controls should be compact, recognizable, and reachable with a thumb.
- The field must remain geometrically accurate: every cell is square.
- The app must work as a dependency-free static site suitable for GitHub Pages.

## Out of Scope

The current concept does not include real-time multiplayer, accounts, cloud storage, scoreboards, sound effects, a real-time falling-piece loop, garbage attacks in Tokopuyo, or a complete competitive Puyo Puyo AI. Tokopuyo suggestions are heuristic construction guidance, not a proof that the requested chain count is reachable from every field or future sequence.
