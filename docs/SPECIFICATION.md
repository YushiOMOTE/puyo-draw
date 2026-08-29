# Puyo Chain Simulator — Specification

## Board Model

- Six columns and thirteen rows.
- The bottom twelve rows are the standard visible field.
- The top row is the hidden-area row and uses a distinct background color; the former fourteenth row is not modeled because puyos do not fall into it.
- The standard choke point is marked with an `X` in the third column at the top of the visible field.
- Board cells are always square, including on narrow mobile screens.
- Narrow mobile layouts keep forced minimum margins around the field: 16px vertically and 10px horizontally, in addition to device safe-area insets.

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
- The radial menu always includes four color options. Five-color mode uses all five colors; Four-color mode uses one of five palettes, each omitting a different color. Garbage mode adds garbage. Both modes are OFF by default.
- Undo and redo maintain board snapshots and are disabled when their respective history is empty.
- Clear empties a non-empty board and creates an undo point; clearing an already empty board is a no-op.
- Reset returns to the initial empty board and records the previous board as an undo point, preserving earlier history.

## Simulation UI

The right-side rail is ordered from top to bottom:

1. Chain count.
2. Undo.
3. Redo.
4. Simulate.
5. Reset.
6. Suggestion.
7. Five-color mode.
8. Four-color palette.
9. Garbage puyo mode.

The Help (`i`) button is pinned to the bottom of the rail.

The Four-color palette button is enabled only when Five-color mode is OFF. It shows the active four-color palette and cycles through all five possible palettes when pressed. It is gray and disabled in Five-color mode.

During the clearing animation, directly adjacent garbage puyos receive the same clearing animation and timing as the color puyos that trigger their removal.

The rail uses square icon buttons without explanatory labels in the compact layout. Accessibility labels and tooltips must still describe each action in English.

Long-pressing the board or controls must not enter browser text-selection or touch-callout mode.

The document itself must not scroll on mobile; the field and controls fit within the app's actual available area, including device safe-area insets, by reducing the field size when necessary.

The Help button opens a modal instruction overlay. The overlay contains a visual example of the radial flick menu and short explanations for color placement, garbage placement, deletion, Suggestion, Five-color mode, Four-color palette, and Garbage mode. It closes from the top-right close button, by clicking outside the card, or with the Escape key. The help card scrolls internally when its content exceeds the viewport; the page behind it must not scroll.

Toast notifications use the browser language: Japanese for Japanese locales and English otherwise. Toasts are used for chains, reset, undo, redo, clear, and no-chain feedback. Cell placement messages are not shown as toasts.

## Chain Suggestions

- The Suggestion button searches for additions that produce a chain from the current board and shows one candidate at a time as colored, dashed circles in the field.
- A candidate can contain multiple puyos. Suggested puyos are visual only: they do not change the board or create history entries.
- Pressing Suggestion again cycles through the cached alternatives for the unchanged board and active palette.
- Suggestions use only the active four- or five-color palette. They never suggest garbage puyos.
- The solver adds puyos only to the next available position in a column. It searches up to eight added puyos, returns up to five candidates, and has a 700ms worker time budget.
- Longer chains rank ahead of shorter chains even when they require more added puyos. For equal chain counts, fewer additions rank ahead of cleared-puyo count.
- Editing a suggested cell removes that cell's marker. Editing any cell invalidates the candidate cycle while leaving other visible markers in place.
- Starting a simulation, clearing, resetting, undoing, redoing, or changing palette/mode removes all suggestion markers and cached alternatives.
- Suggestions run in a Web Worker and stale results are ignored when the board or palette has changed.

## Technical Constraints

- Use plain HTML, CSS, and JavaScript modules.
- Keep the chain engine independent from the DOM so it can be tested with Node.js.
- Keep suggestion solvers independent from the DOM. The worker-facing solver contract lives in `solver/contract.js` so additional search strategies can be added without changing UI code.
- Do not add a build step or runtime dependency without an explicit product decision.
- GitHub Pages deployment is provided by `.github/workflows/deploy.yml`.

## Verification

The logic tests cover four-puyo clearing, gravity, a gravity-created second chain, direct garbage clearing, a basic chain suggestion, and the six-column board width. UI changes should also be checked in a mobile-sized Chrome viewport.
