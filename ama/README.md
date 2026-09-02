# Pressureless Ama WebAssembly

This directory contains the application-owned ABI, browser worker, and generated
WebAssembly artifacts for the Pressureless Ama Tokopuyo planner.

`pressureless-ama.js` and `pressureless-ama.wasm` are generated with Emscripten
6.0.9 by running:

```sh
npm run build-ama
```

The build uses the pinned, MIT-licensed upstream subset in `third_party/ama`.
The generated files are committed so the dependency-free GitHub Pages deployment
does not download a compiler or third-party source at deploy time.
