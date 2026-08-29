import { boardKey } from "./contract.js";

export class SuggestionController {
  constructor() {
    this.requestId = 0;
    this.pending = new Map();
    this.createWorker();
  }

  createWorker() {
    const worker = new Worker(new URL("./suggestion-worker.js", import.meta.url), {
      type: "module",
    });
    this.worker = worker;
    worker.addEventListener("message", ({ data }) => {
      if (worker !== this.worker) return;
      const pending = this.pending.get(data.requestId);
      if (!pending) return;
      this.pending.delete(data.requestId);
      clearTimeout(pending.timeoutId);
      data.error ? pending.reject(new Error(data.error)) : pending.resolve(data);
    });
    worker.addEventListener("error", () => {
      if (worker !== this.worker) return;
      this.restartWorker(new Error("Suggestion worker failed"));
    });
  }

  restartWorker(error) {
    this.worker.terminate();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pending.clear();
    this.createWorker();
  }

  solve(request) {
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timeoutMs =
        request.timeBudgetMs + (request.minimizationBudgetMs ?? 300) + 1_000;
      const timeoutId = setTimeout(() => {
        if (!this.pending.has(requestId)) return;
        this.restartWorker(new Error("Suggestion search timed out"));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeoutId });
      this.worker.postMessage({ requestId, request });
    });
  }

  key(board, colors) {
    return boardKey(board, colors);
  }
}
