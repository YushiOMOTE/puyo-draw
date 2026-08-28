# Contribution Guidelines

## Before Making Changes

Read the project documentation in `docs/` before changing the application. The current product concept is in `docs/CONCEPT.md`, and the behavioral and UI requirements are in `docs/SPECIFICATION.md`.

Keep the existing mobile-first interaction model and preserve the core chain rules unless a specification change is explicitly requested.

## Language and Style

- Write all documentation, code comments, UI labels, accessibility labels, status messages, and generated content in English.
- Prefer clear, concise, human-readable wording.
- Keep the dependency-free static architecture unless a change clearly requires a different approach.
- Keep touch targets large and test layouts at narrow mobile widths.

## Verification

Run the following checks after changes:

```sh
node --check app.js
node tests.mjs
git diff --check
```

For UI changes, also serve the repository with a static file server and verify the app in a mobile-sized browser viewport.
