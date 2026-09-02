# Ama upstream provenance

- Project: [citrus610/ama](https://github.com/citrus610/ama)
- Revision: `dea210bcd92965ae08fbc311f23565b0fab6dbbb`
- License: MIT; see `LICENSE` in this directory.
- Imported subset: `core`, `ai/search/beam`, and `lib/rapidhash/rapidhash.h`.
- `rapidhash.h` retains its embedded BSD 2-Clause license notice.

The vendored subset has three portability changes for the search-only Wasm
build:

1. `core/def.h` selects Emscripten's SSE4 compatibility header.
2. `ai/search/beam/eval.h` omits legacy JSON serialization declarations under
   Emscripten or `AMA_PRESSURELESS`.
3. `ai/search/beam/form.h` replaces the non-standard `_countof` expression with
   a portable compile-time array length.

No search policy, field rule, evaluation weight, or predetermined future queue
is changed by these patches. Vendored text files use LF line endings and omit
trailing horizontal whitespace so the repository's checks remain clean.
