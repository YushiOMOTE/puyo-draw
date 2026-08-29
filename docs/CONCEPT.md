# Puyo Chain Simulator — Product Concept

## Purpose

Puyo Chain Simulator is a lightweight web app for designing Puyo Puyo boards and previewing chain reactions. It is intended for quick experimentation on a phone, with touch interaction taking priority over dense controls.

## Core Experience

1. The user holds a board cell and flicks toward a radial menu to choose one of five colors or garbage.
2. The user releases without flicking to delete the cell.
3. The user starts a simulation to watch groups disappear, pieces fall, and subsequent chains trigger.
4. The chain count and compact controls are shown in the right-side control rail.

## Design Principles

- Mobile-first and comfortable for one-handed use.
- The board is the primary visual element and should use as much available space as possible.
- Controls should be compact, recognizable, and reachable with a thumb.
- The field must remain geometrically accurate: every cell is square.
- The app must work as a dependency-free static site suitable for GitHub Pages.

## Out of Scope

The current concept does not include real-time multiplayer, accounts, cloud storage, scoreboards, sound effects, or a full falling-piece game loop. It is a board editor and deterministic chain visualizer.
