export const GESTURE_ENTER_DISTANCE = 24;
export const GESTURE_EXIT_DISTANCE = 12;
export const GESTURE_SWITCH_DISTANCE = 34;

export function gestureIntent(startX, startY, x, y, current = "straight") {
  const dx = x - startX;
  const dy = y - startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX <= GESTURE_EXIT_DISTANCE && absY <= GESTURE_EXIT_DISTANCE) {
    return "straight";
  }

  if (current === "straight") {
    if (absY >= GESTURE_ENTER_DISTANCE) return dy < 0 ? "cancel" : "down";
    if (absX >= GESTURE_ENTER_DISTANCE) return dx < 0 ? "left" : "right";
    return "straight";
  }

  // Vertical intent takes priority as soon as it crosses the normal threshold.
  if (absY >= GESTURE_ENTER_DISTANCE) {
    const vertical = dy < 0 ? "cancel" : "down";
    if (
      current === "left" ||
      current === "right" ||
      vertical === current ||
      absY >= GESTURE_SWITCH_DISTANCE
    ) {
      return vertical;
    }
  }

  if (absX >= GESTURE_SWITCH_DISTANCE && absY < GESTURE_ENTER_DISTANCE) {
    return dx < 0 ? "left" : "right";
  }

  return current;
}
