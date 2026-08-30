const COLOR_NAMES = ["red", "green", "blue", "yellow", "purple"];
const PATTERN_COUNT = 0x10000;
const PUYOS_PER_PATTERN = 0x100;

function assertSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed >= PATTERN_COUNT) {
    throw new RangeError("Tokopuyo seed must be an integer from 0 to 65535");
  }
}

function nextRandom(state) {
  const next = (Math.imul(state, 0x5d588b65) + 0x00269ec3) >>> 0;
  return [next, next >>> 16];
}

function randomIndex(state, length) {
  const [next, upper] = nextRandom(state);
  return [next, (upper * length) >>> 16];
}

function createColorMap(initialState) {
  let state = initialState;
  const remaining = [...COLOR_NAMES];
  const colors = [];

  while (remaining.length) {
    let index;
    [state, index] = randomIndex(state, remaining.length);
    colors.push(remaining.splice(index, 1)[0]);
  }

  return { state, colors };
}

function shufflePool(initialState, colorCount) {
  let state = initialState;
  const pool = Array.from(
    { length: PUYOS_PER_PATTERN },
    (_, index) => index % colorCount,
  );

  for (const length of [0x10, 0x20, 0x40]) {
    const rowCount = PUYOS_PER_PATTERN / length;
    for (let row = 0; row < rowCount - 1; row++) {
      for (let swap = 0; swap < length / 2; swap++) {
        let upperIndex;
        let lowerIndex;
        [state, upperIndex] = randomIndex(state, length);
        [state, lowerIndex] = randomIndex(state, length);
        upperIndex += row * length;
        lowerIndex += (row + 1) * length;
        [pool[upperIndex], pool[lowerIndex]] = [
          pool[lowerIndex],
          pool[upperIndex],
        ];
      }
    }
  }

  return { state, pool };
}

export function generatePattern(seed) {
  assertSeed(seed);

  let state = seed >>> 0;
  let colors;
  ({ state, colors } = createColorMap(state));

  let threeColorPool;
  let fourColorPool;
  ({ state, pool: threeColorPool } = shufflePool(state, 3));
  ({ state, pool: fourColorPool } = shufflePool(state, 4));
  ({ state } = shufflePool(state, 5));

  fourColorPool.splice(0, 4, ...threeColorPool.slice(0, 4));

  const puyos = fourColorPool.map((value) => colors[value]);
  const hands = [];
  for (let index = 0; index < puyos.length; index += 2) {
    hands.push(Object.freeze({ axis: puyos[index], child: puyos[index + 1] }));
  }

  return Object.freeze({
    seed,
    number: seed + 1,
    colors: Object.freeze(colors.slice(0, 4)),
    hands: Object.freeze(hands),
  });
}

export function getTsumo(pattern, handIndex) {
  if (!pattern?.hands || pattern.hands.length !== 128) {
    throw new TypeError("Invalid Tokopuyo pattern");
  }
  if (!Number.isInteger(handIndex) || handIndex < 0) {
    throw new RangeError("Hand index must be a non-negative integer");
  }
  return pattern.hands[handIndex % pattern.hands.length];
}

export function randomSeed(random = Math.random) {
  return Math.floor(random() * PATTERN_COUNT);
}

export { PATTERN_COUNT, PUYOS_PER_PATTERN };
