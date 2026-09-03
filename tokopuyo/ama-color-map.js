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

export function decodeAmaBoard(encoded, patternColors) {
  createAmaColorMap(patternColors);
  if (typeof encoded !== "string" || encoded.length !== 78) {
    throw new TypeError("Ama board output must contain 78 cells");
  }
  return Array.from({ length: 13 }, (_, row) =>
    Array.from({ length: 6 }, (_, col) => {
      const value = encoded[row * 6 + col];
      if (value === ".") return null;
      if (value === "#") return "garbage";
      const index = AMA_COLOR_NAMES.indexOf(value);
      if (index < 0) throw new RangeError(`Unknown Ama board color: ${value}`);
      return patternColors[index];
    })
  );
}
