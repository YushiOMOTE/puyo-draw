# Export URL Specification

## Status and scope

This document proposes the version 1 export URL format for puyo-draw. It is a design specification only; the export and import behavior described here is not implemented yet.

The format is intended to be a compact, stable, client-side replay format. A shared URL must be sufficient to reproduce Tokopuyo history without depending on the current Tokopuyo randomizer implementation.

The format supports:

- ordinary Tokopuyo history,
- a Tokopuyo session that starts from an arbitrary settled Drawing-mode field,
- a colorless special-fourteenth-row occupancy mask,
- an arbitrary physical-color tsumo sequence that does not need to match a built-in Tokopuyo seed, and
- a fixed continuation after the recorded history by storing more tsumos than recorded moves.

The format does not store derived fields, chain counts, scores, animation state, the active pair's transient position, or a Tokopuyo seed as replay authority.

## Logical replay model

A replay consists of three logical parts:

```text
initial state + tsumo sequence + placement history
```

Conceptually:

```text
ReplayV1 {
  initialBoard?: Cell[13][6]
  initialRow14?: 6-bit occupancy mask
  sequence: Tsumo[]
  moves: Placement[]
}
```

If the initial state is omitted, it is implicitly an empty 13 by 6 board with a zero row-14 mask.

Each `moves[i]` places `sequence[i]`. Therefore:

```text
moves.length <= sequence.length
```

The sequence is replay authority. Decoding must not regenerate stored tsumos from a seed or from the current queue generator.

A sequence may contain additional tsumos after the recorded history. These represent a fixed continuation that may be used after replay reaches the last stored move.

The URL format does not define what the application should generate after the stored sequence itself is exhausted.

## Replay load behavior

Opening an export URL starts at the beginning of replay history:

```text
board  = initialBoard or emptyBoard()
row14  = initialRow14 or 0
cursor = 0
```

The imported replay initially has no applied moves. Redo applies stored moves in order.

For move `i`:

1. read `sequence[i]`,
2. read `moves[i]`,
3. place the tsumo using the normal Tokopuyo placement rules,
4. resolve the resulting chain using the normal engine rules, and
5. advance the replay cursor.

Intermediate and final boards are reconstructed. They are not serialized.

## URL form

Version 1 uses a URL fragment so the replay payload remains client-side and does not participate in static-site routing:

```text
<application-url>#r=<payload>
```

`payload` is the binary representation below encoded with unpadded Base64url as defined by RFC 4648 section 5.

The fragment key `r` is reserved for replay data.

## Binary payload overview

All multi-bit packed fields use most-significant-bit-first order.

Variable-length integers and section boundaries are byte-aligned.

```text
+-----------------------------+
| Header                 1 B  |
+-----------------------------+
| Initial state          30 B |  optional
+-----------------------------+
| Sequence count       varuint|
+-----------------------------+
| Tsumo sequence       6b each|
| Zero padding to byte boundary|
+-----------------------------+
| Move count           varuint|
+-----------------------------+
| Placement history    5b each|
| Zero padding to byte boundary|
+-----------------------------+
```

No checksum is included in version 1. Structural validation and replay validation are required when decoding.

## Header

The first byte is:

```text
bits 7..4  version
bits 3..0  flags
```

Version 1 uses:

```text
version = 0001
```

Flags:

```text
bit 0  HAS_INITIAL_STATE
bit 1  reserved
bit 2  reserved
bit 3  reserved
```

Reserved flag bits must be zero.

Canonical version 1 headers are therefore:

```text
0x10  empty implicit initial state
0x11  explicit initial state follows
```

Version 0 is reserved.

## Cell encoding

The thirteen-row board uses the following 3-bit cell codes:

| Bits | Cell |
| --- | --- |
| `000` | empty |
| `001` | red |
| `010` | green |
| `011` | blue |
| `100` | yellow |
| `101` | purple |
| `110` | garbage |
| `111` | reserved |

The reserved value is invalid in version 1.

Physical colors are encoded directly. The replay format does not encode a four-color palette or palette-relative color indices.

## Initial state

When `HAS_INITIAL_STATE` is set, the initial state occupies exactly 240 bits, or 30 bytes.

### Thirteen-row board

The normal engine board is encoded first:

```text
13 rows * 6 columns * 3 bits = 234 bits
```

Cells are serialized in the same order as the engine arrays:

```text
row 0, col 0
row 0, col 1
...
row 0, col 5
row 1, col 0
...
row 12, col 5
```

No visual reordering is performed by the codec.

### Special fourteenth row

The special fourteenth row is not a colored board row. It is encoded as six occupancy bits, one per column:

```text
col 0, col 1, col 2, col 3, col 4, col 5
```

A bit value of `1` means occupied and `0` means empty.

This corresponds to the existing Tokopuyo `row14` model, where column `c` maps to `1 << c`.

The complete initial state is therefore:

```text
234 board bits + 6 row-14 bits = 240 bits = 30 bytes
```

No padding is required.

## Variable-length integers

Sequence and move counts use canonical unsigned LEB128.

Encoders must use the shortest representation. Decoders must reject a non-canonical representation, an integer outside the supported unsigned range, or a count that cannot be safely allocated.

Typical replay counts below 128 require one byte.

## Tsumo sequence

The sequence count is followed by exactly that many tsumos.

Each tsumo occupies six bits:

```text
axis color   3 bits
child color  3 bits
```

Only the five physical-color cell codes are valid in a tsumo:

```text
001 red
010 green
011 blue
100 yellow
101 purple
```

`000`, `110`, and `111` are invalid in a tsumo.

Example:

```text
red / blue
001 011
=> 001011
```

The complete sequence bitstream is zero-padded to the next byte boundary before the move count begins.

A replay sequence is independent of the Tokopuyo seed and randomizer. This is intentional: an old export URL must remain reproducible even if queue-generation code changes later.

## Placement history

The move count is followed by exactly that many placements.

Each placement occupies five bits:

```text
column       3 bits
orientation  2 bits
```

Column values:

```text
000 = column 0
001 = column 1
010 = column 2
011 = column 3
100 = column 4
101 = column 5
110 = invalid
111 = invalid
```

Orientation values match the existing `ORIENTATION` constants:

```text
00 = UP
01 = RIGHT
10 = DOWN
11 = LEFT
```

A placement is serialized as:

```text
[column:3][orientation:2]
```

The complete move bitstream is zero-padded to the next byte boundary.

## Canonical encoding

A version 1 encoder must produce a single canonical byte representation for the same replay data:

- reserved header bits are zero,
- unsigned LEB128 values use their shortest representation,
- all section padding bits are zero,
- reserved cell and column values are never emitted, and
- no trailing bytes follow the move section.

This keeps exported URLs deterministic and simplifies test vectors.

## Validation

The replay payload is untrusted input.

A decoder must reject the payload if any of the following is true:

- the Base64url payload is malformed,
- the version is unsupported,
- a reserved flag is set,
- a reserved or invalid enum value is used,
- a varuint is malformed or non-canonical,
- a section ends before its declared count,
- `moves.length > sequence.length`,
- a required padding bit is non-zero,
- trailing bytes remain after the move section, or
- replaying a stored move is illegal for the reconstructed state.

The implementation must apply practical decoded-size and count limits before allocating large arrays.

The initial board is expected to be a settled Tokopuyo-compatible field. The codec itself stores physical cell state rather than a generator-specific palette, so all five physical colors may be represented.

## Versioning

Once emitted publicly, version 1 decoding semantics must not change.

An incompatible binary format must use a new header version and a separate decoder.

The version nibble allows versions 1 through 15 in the current envelope. If that space is ever exhausted, a later version may define a new outer envelope.

## Size examples

For a replay with 100 tsumos and 100 moves, with both counts encoded in one byte:

Without an explicit initial state:

```text
header          1 byte
sequence count  1 byte
sequence       75 bytes
move count      1 byte
moves           63 bytes
-----------------------
total          141 bytes
```

With an explicit initial state:

```text
141 + 30 = 171 bytes
```

The corresponding unpadded Base64url payloads are approximately 188 and 228 characters respectively.

## Design rationale

Version 1 favors a small, inspectable codec over maximum compression.

In particular:

- the actual tsumo sequence is stored instead of a randomizer seed,
- physical colors are stored instead of palette-relative indices,
- the initial field is a fixed 30-byte structure when present,
- placements reuse the engine's existing column and orientation model,
- derived states are reconstructed rather than duplicated, and
- no Huffman coding, run-length encoding, or generator-specific compression is used.

This keeps replay URLs compact while making the format independent of Tokopuyo queue-generation details and straightforward to maintain over time.
