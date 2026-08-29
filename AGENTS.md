# Contribution Guidelines

## Before Making Changes

Read the project documentation in `docs/` before changing the application. The current product concept is in `docs/CONCEPT.md`, and the behavioral and UI requirements are in `docs/SPECIFICATION.md`.

Keep the existing mobile-first interaction model and preserve the core chain rules unless a specification change is explicitly requested.

## Documentation Synchronization

- Treat `docs/SPECIFICATION.md` as the behavioral source of truth for the implementation.
- When changing behavior, update the specification in the same change; do not leave implementation and documentation updates for a later commit.
- Before committing, compare the documented controls, board dimensions, interaction rules, and simulation rules against `index.html`, `app.js`, and `engine.js`.
- Add or update a focused test when a documented rule changes, especially for chain clearing, gravity, garbage puyos, or history behavior.
- Do not describe controls as available if they are hidden or unavailable in the current UI.

## Language and Style

- Write all documentation, code comments, UI labels, accessibility labels, status messages, and generated content in English.
- Prefer clear, concise, human-readable wording.
- Keep the dependency-free static architecture unless a change clearly requires a different approach.
- Keep touch targets large and test layouts at narrow mobile widths.
- When changing `styles.css`, increment the stylesheet version query in `index.html` so GitHub Pages users receive the updated CSS without waiting for the browser cache to expire.

## Verification

Run the following checks after changes:

```sh
node --check app.js
node tests.mjs
git diff --check
```

For UI changes, also serve the repository with a static file server and verify the app in a mobile-sized browser viewport.
