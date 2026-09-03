import {
  decodeAmaBoard,
  encodeAmaBoard,
  encodeAmaPair,
} from "./ama-color-map.js";
import {
  AMA_BRANCH_COUNT,
  analyzeAmaBranches,
} from "./pressureless-ama.js";

const STARTUP_TIMEOUT_MS = 10_000;
const AMA_SIGNAL_IDS = [
  "potentialChain",
  "triggerHeight",
  "requiredPuyos",
  "extensionSpace",
  "quietLink2",
  "quietLink3",
  "formMatch",
  "shapeDeviation",
  "wells",
  "bumps",
  "boardLink2",
  "boardLink3",
  "row14Blockage",
  "sideBias",
  "garbageCount",
  "pairSplit",
  "immediateClear",
];
const PROBE_STATUSES = [
  "unavailable",
  "no-trigger",
  "single-chain",
  "multi-chain",
];

function defaultWorkerCount() {
  const cores = globalThis.navigator?.hardwareConcurrency || 2;
  return Math.min(3, Math.max(1, cores - 1));
}

class AmaWorkerSlot {
  constructor(url) {
    this.worker = new Worker(url);
    this.nextRequestId = 0;
    this.pending = null;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.startupTimeoutId = setTimeout(() => {
      this.fail(new Error("Pressureless Ama worker startup timed out"));
    }, STARTUP_TIMEOUT_MS);

    this.worker.addEventListener("message", ({ data }) => {
      if (data.type === "ready") {
        clearTimeout(this.startupTimeoutId);
        this.resolveReady();
        return;
      }
      if (data.type === "startup-error") {
        this.fail(new Error(data.error || "Pressureless Ama failed to load"));
        return;
      }
      if (data.type !== "result" || !this.pending) return;
      if (data.requestId !== this.pending.requestId) return;
      const { resolve, reject } = this.pending;
      this.pending = null;
      data.error ? reject(new Error(data.error)) : resolve(data);
    });
    this.worker.addEventListener("error", () => {
      this.fail(new Error("Pressureless Ama worker failed"));
    });
  }

  run(request) {
    if (this.pending) {
      return Promise.reject(new Error("Pressureless Ama worker is busy"));
    }
    return new Promise((resolve, reject) => {
      const requestId = ++this.nextRequestId;
      this.pending = { requestId, resolve, reject };
      try {
        this.worker.postMessage({ requestId, request });
      } catch (error) {
        this.pending = null;
        reject(error);
      }
    });
  }

  fail(error) {
    clearTimeout(this.startupTimeoutId);
    this.rejectReady(error);
    if (this.pending) this.pending.reject(error);
    this.pending = null;
    this.worker.terminate();
  }

  terminate(error = new Error("Pressureless Ama worker stopped")) {
    clearTimeout(this.startupTimeoutId);
    if (this.pending) this.pending.reject(error);
    this.pending = null;
    this.worker.terminate();
  }
}

export class PressurelessAmaController {
  constructor({ workerCount = defaultWorkerCount() } = {}) {
    this.workerCount = Math.min(
      AMA_BRANCH_COUNT,
      Math.max(1, Math.floor(workerCount)),
    );
    this.slots = [];
    this.initializing = null;
    this.busy = false;
  }

  async ensureWorkers() {
    if (typeof Worker === "undefined") {
      throw new Error("Pressureless Ama workers are not supported");
    }
    if (this.slots.length) return;
    if (this.initializing) return this.initializing;

    this.initializing = (async () => {
      const url = new URL(
        "../ama/pressureless-ama-branch-worker.js",
        import.meta.url,
      );
      this.slots = Array.from(
        { length: this.workerCount },
        () => new AmaWorkerSlot(url),
      );
      await Promise.all(this.slots.map((slot) => slot.ready));
    })();
    try {
      await this.initializing;
    } catch (error) {
      this.reset(error);
      throw error;
    } finally {
      this.initializing = null;
    }
  }

  reset(error = new Error("Pressureless Ama worker pool reset")) {
    this.slots.forEach((slot) => slot.terminate(error));
    this.slots = [];
  }

  async solve(request) {
    if (this.busy) throw new Error("Pressureless Ama search is already running");
    if (!request.hands || request.hands.length < 2) {
      throw new TypeError("Pressureless Ama requires Current and Next");
    }

    this.busy = true;
    let timeoutId;
    try {
      await this.ensureWorkers();
      const startedAt = performance.now();
      const branchCount = request.branchCount ?? AMA_BRANCH_COUNT;
      if (branchCount !== AMA_BRANCH_COUNT) {
        throw new RangeError("Pressureless Ama requires all six future branches");
      }
      const workerRequest = {
        board: encodeAmaBoard(request.board, request.colors),
        row14: request.row14 ?? 0,
        current: encodeAmaPair(request.hands[0], request.colors),
        next: encodeAmaPair(request.hands[1], request.colors),
        depth: request.depth ?? 16,
        width: request.width ?? 250,
      };
      const branches = Array(branchCount);
      let nextBranch = 0;
      const runSlot = async (slot) => {
        while (nextBranch < branchCount) {
          const branch = nextBranch++;
          branches[branch] = await slot.run({ ...workerRequest, branch });
        }
      };
      const search = Promise.all(this.slots.map(runSlot)).then(() => branches);
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error("Pressureless Ama search timed out");
          this.reset(error);
          reject(error);
        }, request.timeBudgetMs ?? 8_000);
      });
      const results = await Promise.race([search, timeout]);
      const elapsedMs = Math.round(performance.now() - startedAt);
      const aggregateRequest = {
        ...request,
        current: request.hands[0],
        branchCount,
      };
      const allCandidates = analyzeAmaBranches(
        aggregateRequest,
        results,
      ).map((candidate) => ({ ...candidate, searchElapsedMs: elapsedMs }));
      const candidates = allCandidates.slice(0, request.resultLimit ?? 4);
      return {
        solver: "pressureless-ama",
        candidates,
        allCandidates,
        elapsedMs,
        branchElapsedMs: results.map(({ elapsedMs }) => elapsedMs),
        workerCount: this.slots.length,
      };
    } catch (error) {
      if (this.slots.length) this.reset(error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
      this.busy = false;
    }
  }

  async inspectPlacements(request, placements) {
    if (this.busy) throw new Error("Pressureless Ama is already running");
    if (!Array.isArray(placements) || !placements.length) return [];
    this.busy = true;
    try {
      await this.ensureWorkers();
      const colors = request.colors;
      const result = await this.slots[0].run({
        operation: "inspect",
        board: encodeAmaBoard(request.board, colors),
        row14: request.row14 ?? 0,
        current: encodeAmaPair(request.current, colors),
        placements,
      });
      return result.diagnostics.map((diagnostic) => {
        if (!diagnostic) return null;
        if (diagnostic.signals.length !== AMA_SIGNAL_IDS.length) {
          throw new Error("Ama diagnostic signal contract changed");
        }
        if (diagnostic.survives && !diagnostic.matchesEvaluator) {
          throw new Error("Ama diagnostic total did not match its evaluator");
        }
        const signals = Object.fromEntries(diagnostic.signals.map(
          (signal, index) => [AMA_SIGNAL_IDS[index], { id: AMA_SIGNAL_IDS[index], ...signal }],
        ));
        const selectedProbe = diagnostic.selectedProbe < 0
          ? null
          : diagnostic.probes[diagnostic.selectedProbe];
        return {
          ...diagnostic,
          board: decodeAmaBoard(diagnostic.board, colors),
          link2Mask: decodeAmaBoard(diagnostic.link2Mask, colors),
          link3Mask: decodeAmaBoard(diagnostic.link3Mask, colors),
          clearedMask: decodeAmaBoard(diagnostic.clearedMask, colors),
          signals,
          probes: diagnostic.probes.map((probe) => ({
            ...probe,
            color: colors[probe.color],
            status: PROBE_STATUSES[probe.status],
          })),
          selectedProbe: selectedProbe
            ? {
              ...selectedProbe,
              color: colors[selectedProbe.color],
              status: PROBE_STATUSES[selectedProbe.status],
              addedCells: Array.from(
                { length: selectedProbe.requiredPuyos },
                (_, index) => ({
                  row: 12 - diagnostic.heights[selectedProbe.column] - index,
                  col: selectedProbe.column,
                  color: colors[selectedProbe.color],
                }),
              ),
            }
            : null,
        };
      });
    } catch (error) {
      if (this.slots.length) this.reset(error);
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
