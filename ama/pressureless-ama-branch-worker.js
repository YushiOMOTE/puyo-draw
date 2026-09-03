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
    if (request.operation === "inspect") {
      const callNumber = (name, args = []) => ama.ccall(
        name,
        "number",
        Array(args.length).fill("number"),
        args,
      );
      const readString = (name) => ama.ccall(name, "string", [], []);
      const readDiagnostic = () => {
        const signalCount = callNumber("ama_diag_signal_count");
        const signals = Array.from({ length: signalCount }, (_, index) => ({
          rawValue: callNumber("ama_diag_signal_raw", [index]),
          weight: callNumber("ama_diag_signal_weight", [index]),
          contribution: callNumber("ama_diag_signal_contribution", [index]),
        }));
        const probes = Array.from({ length: 24 }, (_, index) => ({
          column: Math.floor(index / 4),
          color: index % 4,
          status: callNumber("ama_diag_probe_status", [index]),
          requiredPuyos: callNumber("ama_diag_probe_required", [index]),
          chainCount: callNumber("ama_diag_probe_chain_count", [index]),
          chainScore: callNumber("ama_diag_probe_chain_score", [index]),
          subtotal: callNumber("ama_diag_probe_subtotal", [index]),
        }));
        return {
          valid: Boolean(callNumber("ama_diag_valid")),
          survives: Boolean(callNumber("ama_diag_survives")),
          staticTotal: callNumber("ama_diag_static_total"),
          actionTotal: callNumber("ama_diag_action_total"),
          matchesEvaluator: Boolean(callNumber("ama_diag_matches_evaluator")),
          signals,
          heights: Array.from({ length: 6 }, (_, index) =>
            callNumber("ama_diag_height", [index])),
          shapeDeviation: Array.from({ length: 6 }, (_, index) =>
            callNumber("ama_diag_shape_deviation", [index])),
          wellDepth: Array.from({ length: 6 }, (_, index) =>
            callNumber("ama_diag_well_depth", [index])),
          bumpHeight: Array.from({ length: 6 }, (_, index) =>
            callNumber("ama_diag_bump_height", [index])),
          formScores: Array.from({ length: 3 }, (_, index) =>
            callNumber("ama_diag_form_score", [index])),
          bestForm: callNumber("ama_diag_best_form"),
          probes,
          selectedProbe: callNumber("ama_diag_selected_probe"),
          row14: callNumber("ama_diag_row14"),
          immediateChainScore: callNumber("ama_diag_immediate_chain_score"),
          board: readString("ama_diag_board"),
          link2Mask: readString("ama_diag_link_2_mask"),
          link3Mask: readString("ama_diag_link_3_mask"),
          clearedMask: readString("ama_diag_cleared_mask"),
        };
      };
      const diagnostics = request.placements.map((placement) => {
        const accepted = ama.ccall(
          "ama_inspect_placement",
          "number",
          ["string", "number", "number", "number", "number", "number"],
          [
            request.board,
            request.row14,
            request.current.axis,
            request.current.child,
            placement.col,
            placement.orientation,
          ],
        );
        if (accepted < 0) throw new Error("Pressureless Ama rejected diagnostic input");
        return accepted ? readDiagnostic() : null;
      });
      self.postMessage({ type: "result", requestId, diagnostics });
      return;
    }
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
