export const DRAG_STEP_RATIO = 0.7;
export const DRAG_RETURN_HYSTERESIS_RATIO = 0.18;
export const CANCEL_TARGET_MIN_SIZE = 56;

function quantizedDragSteps(
  displacement,
  currentSteps,
  stepSize,
  returnHysteresis,
) {
  let steps = currentSteps;

  while (
    steps > 0 &&
    displacement <= steps * stepSize - returnHysteresis
  ) {
    steps--;
  }

  while (
    steps < 0 &&
    displacement >= steps * stepSize + returnHysteresis
  ) {
    steps++;
  }

  while (displacement >= (steps + 1) * stepSize && steps >= 0) steps++;
  while (displacement <= (steps - 1) * stepSize && steps <= 0) steps--;

  return steps;
}

export function cornerTargetAt(
  x,
  y,
  viewportWidth,
  viewportHeight,
  cellSize,
) {
  const size = Math.max(CANCEL_TARGET_MIN_SIZE, cellSize * 1.35);
  const horizontal = x <= size ? "left" : x >= viewportWidth - size ? "right" : null;
  const vertical = y <= size ? "top" : y >= viewportHeight - size ? "bottom" : null;
  return horizontal && vertical ? `${vertical}-${horizontal}` : null;
}

export function createTokopuyoGesture(x, y, options = null) {
  return {
    startX: x,
    startY: y,
    columnSteps: 0,
    rotationSteps: 0,
    cancelCorner: null,
    ignoredCancelCorner: options
      ? cornerTargetAt(
          x,
          y,
          options.viewportWidth,
          options.viewportHeight,
          options.cellSize,
        )
      : null,
  };
}

export function updateTokopuyoGesture(
  current,
  x,
  y,
  { cellSize, viewportWidth, viewportHeight },
) {
  const state = { ...current };
  const result = {
    state,
    columnDelta: 0,
    rotationSteps: null,
    cancelChanged: false,
  };

  let corner = cornerTargetAt(
    x,
    y,
    viewportWidth,
    viewportHeight,
    cellSize,
  );
  if (corner === state.ignoredCancelCorner) {
    corner = null;
  } else if (!corner) {
    state.ignoredCancelCorner = null;
  }
  if (corner !== state.cancelCorner) {
    result.cancelChanged = true;
    state.cancelCorner = corner;
  }
  if (corner || result.cancelChanged) return result;

  const stepSize = cellSize * DRAG_STEP_RATIO;
  const returnHysteresis = cellSize * DRAG_RETURN_HYSTERESIS_RATIO;
  const columnSteps = quantizedDragSteps(
    x - state.startX,
    state.columnSteps,
    stepSize,
    returnHysteresis,
  );
  const verticalSteps = quantizedDragSteps(
    y - state.startY,
    -state.rotationSteps,
    stepSize,
    returnHysteresis,
  );

  if (columnSteps !== state.columnSteps) {
    result.columnDelta = columnSteps - state.columnSteps;
    state.columnSteps = columnSteps;
  }
  const rotationSteps = verticalSteps === 0 ? 0 : -verticalSteps;
  if (rotationSteps !== state.rotationSteps) {
    state.rotationSteps = rotationSteps;
    result.rotationSteps = rotationSteps;
  }

  return result;
}
