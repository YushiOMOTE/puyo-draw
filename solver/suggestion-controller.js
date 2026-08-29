import { boardKey } from "./contract.js";

export class SuggestionController {
  constructor() {
    this.worker = new Worker(new URL("./suggestion-worker.js", import.meta.url), {
      type: "module",
    });
    this.requestId = 0;
    this.pending = new Map();
    this.worker.addEventListener("message", ({ data }) => {
      const pending = this.pending.get(data.requestId);
      if (!pending) return;
      this.pending.delete(data.requestId);
      data.error ? pending.reject(new Error(data.error)) : pending.resolve(data);
    });
  }

  solve(request) {
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker.postMessage({ requestId, request });
    });
  }

  key(board, colors) {
    return boardKey(board, colors);
  }
}
