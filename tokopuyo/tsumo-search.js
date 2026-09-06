import { generatePattern } from "./queue.js";

export const TSUMO_SEARCH_ALPHABET = "rgbyp";
export const TSUMO_SEARCH_MAX_SEQUENCE_LENGTH = 256;

const COLOR_TO_SYMBOL = new Map([
  ["red", "r"],
  ["green", "g"],
  ["blue", "b"],
  ["yellow", "y"],
  ["purple", "p"],
]);

function assertIndex(index) {
  if (
    !index ||
    index.version !== 1 ||
    index.maxIndexedLength !== 6 ||
    index.patternCount !== 65536 ||
    index.alphabet !== TSUMO_SEARCH_ALPHABET
  ) {
    throw new TypeError("Invalid Tokopuyo tsumo search index");
  }
}

export function patternSequence(pattern) {
  if (!pattern?.hands || pattern.hands.length !== 128) {
    throw new TypeError("Invalid Tokopuyo pattern");
  }
  return pattern.hands
    .flatMap(({ axis, child }) => [axis, child])
    .map((color) => {
      const symbol = COLOR_TO_SYMBOL.get(color);
      if (!symbol) throw new RangeError(`Unsupported Tokopuyo color: ${color}`);
      return symbol;
    })
    .join("");
}

function parseQuery(query) {
  if (typeof query !== "string" || query.length === 0) {
    return { kind: "invalid", value: "" };
  }

  if (/^[0-9]+$/.test(query)) {
    const normalized = query.replace(/^0+/, "");
    if (!normalized) return { kind: "invalid", value: query };
    const number = Number(normalized);
    if (!Number.isSafeInteger(number) || number < 1 || number > 65536) {
      return { kind: "invalid", value: query };
    }
    return { kind: "number", number };
  }

  if (/^[rgbyp]+$/i.test(query)) {
    return { kind: "color", prefix: query.toLowerCase() };
  }

  return { kind: "invalid", value: query };
}

function findChild(index, node, symbolIndex) {
  const start = index.nodeFirstChild[node];
  const count = index.nodeChildCount[node];
  for (let offset = 0; offset < count; offset += 1) {
    const edge = start + offset;
    if (index.childSymbol[edge] === symbolIndex) {
      return index.childNode[edge];
    }
  }
  return -1;
}

function lookupPrefix(index, prefix) {
  let node = 0;
  for (const symbol of prefix) {
    const symbolIndex = TSUMO_SEARCH_ALPHABET.indexOf(symbol);
    if (symbolIndex < 0) return [];
    node = findChild(index, node, symbolIndex);
    if (node < 0) return [];
  }

  const start = index.nodeCandidateStart[node];
  const count = index.nodeCandidateCount[node];
  return Array.from(index.candidateSeeds.slice(start, start + count));
}

export function searchTsumo(query, index, patternGenerator = generatePattern) {
  assertIndex(index);
  const parsed = parseQuery(query);
  if (parsed.kind === "invalid") {
    return { kind: "invalid", seeds: [] };
  }
  if (parsed.kind === "number") {
    return { kind: "number", seeds: [parsed.number - 1] };
  }

  const indexedPrefix = parsed.prefix.slice(0, index.maxIndexedLength);
  const candidates = lookupPrefix(index, indexedPrefix);
  if (parsed.prefix.length <= index.maxIndexedLength) {
    return { kind: "color", seeds: candidates.slice(0, 5) };
  }

  if (parsed.prefix.length > TSUMO_SEARCH_MAX_SEQUENCE_LENGTH) {
    return { kind: "color", seeds: [] };
  }

  const seeds = candidates
    .filter((seed) => patternSequence(patternGenerator(seed)).startsWith(parsed.prefix))
    .slice(0, 5);
  return { kind: "color", seeds };
}

export function candidateNumbers(result) {
  return result.seeds.map((seed) => seed + 1);
}
