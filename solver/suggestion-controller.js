import { boardKey } from "./contract.js";

export class SuggestionController {
  constructor() {
    this.requestId = 0;
    this.pending = new Map();
    this.queued = [];
    this.worker = null;
    this.workerReady = false;
    this.startupTimeoutId = null;
  }

  createWorker() {
    if (typeof Worker === "undefined") {
      this.failWorker(new Error("Suggestion workers are not supported"));
      return;
    }

    let worker;
    try {
      worker = new Worker(
        new URL("./suggestion-worker.js", import.meta.url),
        { type: "module" },
      );
    } catch (error) {
      this.failWorker(error);
      return;
    }

    this.worker = worker;
    this.workerReady = false;
    this.startupTimeoutId = setTimeout(() => {
      if (worker === this.worker && !this.workerReady) {
        this.failWorker(new Error("Suggestion worker startup timed out"));
      }
    }, 10_000);

    worker.addEventListener("message", ({ data }) => {
      if (worker !== this.worker) return;

      if (data.type === "ready") {
        clearTimeout(this.startupTimeoutId);
        this.workerReady = true;
        const queued = this.queued.splice(0);
        queued.forEach((item) => this.dispatch(item));
        return;
      }

      const pending = this.pending.get(data.requestId);
      if (!pending) return;
      this.pending.delete(data.requestId);
      clearTimeout(pending.timeoutId);
      data.error ? pending.reject(new Error(data.error)) : pending.resolve(data);
    });
    worker.addEventListener("error", () => {
      if (worker !== this.worker) return;
      this.failWorker(new Error("Suggestion worker failed"));
    });
  }

  failWorker(error) {
    clearTimeout(this.startupTimeoutId);
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.workerReady = false;
    this.startupTimeoutId = null;

    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pending.clear();
    for (const queued of this.queued.splice(0)) queued.reject(error);
  }

  solve(request) {
    return new Promise((resolve, reject) => {
      const item = { request, resolve, reject };
      if (this.workerReady) {
        this.dispatch(item);
      } else {
        this.queued.push(item);
        if (!this.worker) this.createWorker();
      }
    });
  }

  dispatch({ request, resolve, reject }) {
    const requestId = ++this.requestId;
    const minimizationBudgetMs =
      request.minimizationBudgetMs === undefined
        ? 300
        : request.minimizationBudgetMs;
    const timeoutMs =
      request.timeBudgetMs + minimizationBudgetMs + 5_000;
    const timeoutId = setTimeout(() => {
      if (!this.pending.has(requestId)) return;
      this.failWorker(new Error("Suggestion search timed out"));
    }, timeoutMs);
    this.pending.set(requestId, { resolve, reject, timeoutId });
    try {
      this.worker.postMessage({ requestId, request });
    } catch (error) {
      this.failWorker(error);
    }
  }

  key(board, colors) {
    return boardKey(board, colors);
  }
}
