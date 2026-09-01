import { solveSuggestion } from "./solver-registry.js";
import { solveTokopuyoSuggestion } from "../tokopuyo/suggestion-solver.js";
import {
  solveTokopuyoAttackSuggestion,
} from "../tokopuyo/attack-suggestion-solver.js";

self.postMessage({ type: "ready" });

self.addEventListener("message", ({ data }) => {
  const { requestId, request } = data;
  try {
    const result = request.kind === "tokopuyo"
      ? solveTokopuyoSuggestion(request)
      : request.kind === "tokopuyo-attack"
        ? solveTokopuyoAttackSuggestion(request)
        : solveSuggestion(request);
    self.postMessage({ requestId, ...result });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Suggestion search failed",
    });
  }
});
