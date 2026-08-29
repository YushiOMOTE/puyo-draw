import { solveSuggestion } from "./solver-registry.js";

self.postMessage({ type: "ready" });

self.addEventListener("message", ({ data }) => {
  const { requestId, request } = data;
  try {
    self.postMessage({ requestId, ...solveSuggestion(request) });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Suggestion search failed",
    });
  }
});
