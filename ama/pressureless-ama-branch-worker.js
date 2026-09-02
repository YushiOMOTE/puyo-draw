importScripts("./pressureless-ama.js");

const amaPromise = createPressurelessAma({
  locateFile(path) {
    const url = new URL(path, self.location.href);
    url.search = self.location.search;
    return url.href;
  },
});

amaPromise.then(
  () => self.postMessage({ type: "ready" }),
  (error) => self.postMessage({
    type: "startup-error",
    error: error instanceof Error ? error.message : String(error),
  }),
);

self.addEventListener("message", async ({ data }) => {
  const { requestId, request } = data;
  try {
    const ama = await amaPromise;
    const count = ama.ccall(
      "ama_solve_branch",
      "number",
      [
        "string",
        "number",
        "number",
        "number",
        "number",
        "number",
        "number",
        "number",
        "number",
      ],
      [
        request.board,
        request.row14,
        request.current.axis,
        request.current.child,
        request.next.axis,
        request.next.child,
        request.depth,
        request.width,
        request.branch,
      ],
    );
    if (count < 0) throw new Error("Pressureless Ama rejected its input");

    const candidates = [];
    for (let index = 0; index < count; index++) {
      candidates.push({
        col: ama.ccall("ama_candidate_x", "number", ["number"], [index]),
        orientation: ama.ccall(
          "ama_candidate_rotation",
          "number",
          ["number"],
          [index],
        ),
        score: ama.ccall(
          "ama_candidate_score",
          "number",
          ["number"],
          [index],
        ),
      });
    }
    self.postMessage({
      type: "result",
      requestId,
      branch: request.branch,
      elapsedMs: ama.ccall("ama_elapsed_ms", "number", [], []),
      candidates,
    });
  } catch (error) {
    self.postMessage({
      type: "result",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
