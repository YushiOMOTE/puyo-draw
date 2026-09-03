# Pressureless Ama WebAssembly

This directory contains the application-owned ABI, browser worker, and generated
WebAssembly artifacts for the Pressureless Ama Tokopuyo planner.

The application-owned diagnostic source evaluates a legal Current placement
with the same upstream feature functions and `build` weights. The Worker checks
its reconstructed static and action totals against Ama's evaluator before the
coaching report uses them.

Maximum-score coaching replay reruns one fixed future branch with an optional
observer on the shared upstream beam-search loop. The observer records a
parent-linked placement witness for one requested Current move; it does not
duplicate or alter expansion, evaluation, pruning, or candidate selection. The
browser accepts the witness only if the rerun reproduces the original candidate
score vector and selected score.

`pressureless-ama.js` and `pressureless-ama.wasm` are generated with Emscripten
6.0.9 by running:

```sh
npm run build-ama
```

The build uses the pinned, MIT-licensed upstream subset in `third_party/ama`.
The generated files are committed so the dependency-free GitHub Pages deployment
does not download a compiler or third-party source at deploy time.
