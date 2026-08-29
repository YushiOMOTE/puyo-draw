import { solveWithBeam } from "./beam-solver.js";

self.addEventListener("message", ({ data }) => {
  const { requestId, request } = data;
  try {
    self.postMessage({ requestId, ...solveWithBeam(request) });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Suggestion search failed",
    });
  }
});
