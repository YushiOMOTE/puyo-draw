const AMA_COLOR_NAMES = ["R", "Y", "G", "B"];

export function createAmaColorMap(patternColors) {
  if (
    !Array.isArray(patternColors) ||
    patternColors.length !== AMA_COLOR_NAMES.length ||
    new Set(patternColors).size !== patternColors.length
  ) {
    throw new TypeError("Ama color mapping requires four distinct pattern colors");
  }
  return new Map(patternColors.map((color, index) => [color, index]));
}

export function toAmaColor(color, patternColors) {
  const value = createAmaColorMap(patternColors).get(color);
  if (value === undefined) {
    throw new RangeError(`Color is not active in this Tokopuyo pattern: ${color}`);
  }
  return value;
}

export function encodeAmaPair(tsumo, patternColors) {
  return {
    axis: toAmaColor(tsumo.axis, patternColors),
    child: toAmaColor(tsumo.child, patternColors),
  };
}

export function encodeAmaBoard(board, patternColors) {
  const colorMap = createAmaColorMap(patternColors);
  return board
    .flatMap((row) => row.map((color) => {
      if (color === null) return ".";
      if (color === "garbage") return "#";
      const amaColor = colorMap.get(color);
      if (amaColor === undefined) {
        throw new RangeError(`Board color is not active in this Tokopuyo pattern: ${color}`);
      }
      return AMA_COLOR_NAMES[amaColor];
    }))
    .join("");
}
