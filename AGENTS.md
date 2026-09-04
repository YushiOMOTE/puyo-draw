# Contribution Guidelines

## Before Making Changes

Read only the relevant project documentation in `docs/` before changing the application. The current product concept is in `docs/CONCEPT.md`, and the behavioral and UI requirements are in `docs/SPECIFICATION.md`.

Keep the existing mobile-first interaction model and preserve the core chain rules unless a specification change is explicitly requested.

### Working with Codex

- Treat context as scarce: use `rg` to locate relevant symbols first, read focused ranges, keep command output concise, and do not reread unchanged material or scan unrelated areas.
- Separate the user's goal from a proposed implementation. Before editing, surface material trade-offs, objections, and any inferred product or architectural rule; challenge an approach that would materially worsen behavior, maintainability, or scope.
- If plausible interpretations would materially change behavior, architecture, API, data, or UI, ask one concise clarifying question before editing. For low-impact, reversible details, make the smallest reasonable assumption and state it.
- Keep progress updates terse: report only decisions, ambiguities, unexpected findings, blockers, and final results.

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
- Do not add manual cache-version query strings to source imports or asset URLs. The Pages preparation script versions every JavaScript and CSS URL with the deployment commit SHA.

## Verification

Use risk-based validation. For small, iterative CSS/layout tweaks, defer browser and full-test cycles until the change is near-final; group nearby tweaks and verify once. Run targeted checks first for local behavior changes and broader checks for cross-cutting changes. Do not repeat an expensive check unless a later change could invalidate it.

For application changes, run the following checks as appropriate:

```sh
node --check app.js
node tests.mjs
git diff --check
```

For UI changes, also serve the repository with a static file server and verify the app in a mobile-sized browser viewport.

Use `npm run dev` for local browser verification. Its `no-store` responses prevent stale ES modules from surviving reloads on the same port.
