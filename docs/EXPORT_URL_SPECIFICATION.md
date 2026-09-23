# Export URL Specification

## Status and scope

This document specifies the implemented version 1 export URL format for puyo-draw.

The format is intended to be a compact, stable, client-side replay format. A shared URL must be sufficient to reproduce Tokopuyo history without depending on the current Tokopuyo randomizer implementation.

The format supports:

- ordinary Tokopuyo history,
- a Tokopuyo session that starts from an arbitrary settled Drawing-mode field,
- a colorless special-fourteenth-row occupancy mask,
- an arbitrary physical-color tsumo sequence that does not need to match a built-in Tokopuyo seed,
- ordinary pair placements and one-puyo garbage drops in one ordered history, and
- a fixed continuation after the recorded history by storing more tsumos than pair placements.

The format does not store derived fields, chain counts, scores, animation state, the active pair's transient position, or a Tokopuyo seed as replay authority.

## Logical replay model

A replay consists of three logical parts:

```text
initial state + tsumo sequence + operation history
```

Conceptually:

```text
ReplayV1 {
  initialBoard?: Cell[13][6]
  initialRow14?: 6-bit occupancy mask
  sequence: Tsumo[]
  operations: (PairPlacement | GarbageDrop)[]
}
```

If the initial state is omitted, it is implicitly an empty 13 by 6 board with a zero row-14 mask.

Each pair-placement operation consumes the next tsumo in `sequence`. A one-puyo garbage drop does not consume a tsumo. Therefore:

```text
pairPlacementCount <= sequence.length
```

The sequence is replay authority. Decoding must not regenerate stored tsumos from a seed or from the current queue generator.

An empty sequence is valid. In that case, pair-placement count must be zero, and replay has no normal active pair or Next/Next Next previews. The decoder must not invent a queue to fill the empty sequence.

A sequence may contain additional tsumos after the recorded history. These represent a fixed continuation that may be used after replay reaches the last stored operation.

The URL format does not define what the application should generate after the stored sequence itself is exhausted.

## Replay load behavior

Opening an export URL starts at the beginning of replay history:

```text
board  = initialBoard or emptyBoard()
row14  = initialRow14 or 0
cursor = 0
```

The imported replay initially has no applied operations. Redo applies stored operations in order. Export includes the complete retained timeline: operations before and after the current cursor, including the Redo side. A shared URL always opens at the beginning of that timeline.

For each operation, in order:

1. for a pair placement, read and consume the next tsumo and place it using normal Tokopuyo placement rules;
2. for a garbage drop, place one garbage puyo in the stored column without consuming a tsumo;
3. resolve the resulting state using the normal engine rules; and
4. advance the replay cursor by one operation.

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
| Operation count      varuint|
+-----------------------------+
| Operation history    6b each|
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

`0x11` is canonical only when the initial board contains at least one puyo or the row-14 mask is non-zero. An empty initial state is represented only by `0x10`, regardless of whether the source session was originally created as a custom opening.

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

Sequence and operation counts use canonical unsigned LEB128.

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

The complete sequence bitstream is zero-padded to the next byte boundary before the operation count begins.

A replay sequence is independent of the Tokopuyo seed and randomizer. This is intentional: an old export URL must remain reproducible even if queue-generation code changes later.

## Operation history

The operation count is followed by exactly that many operations. Every operation occupies six bits:

```text
kind     1 bit
column   3 bits
detail   2 bits
```

Kind values:

```text
0 = pair placement
1 = one-puyo garbage drop
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

For pair placements, `detail` is the orientation and matches the existing `ORIENTATION` constants:

```text
00 = UP
01 = RIGHT
10 = DOWN
11 = LEFT
```

Pair placements are serialized as:

```text
[kind:1=0][column:3][orientation:2]
```

Garbage drops have no orientation, so their detail bits are reserved and must be zero:

```text
[kind:1=1][column:3][reserved:2=00]
```

A garbage drop does not consume a tsumo. The complete operation bitstream is zero-padded to the next byte boundary.

## Canonical encoding

A version 1 encoder must produce a single canonical byte representation for the same replay data:

- reserved header bits are zero,
- an explicit initial state is used only when it contains board or row-14 occupancy,
- unsigned LEB128 values use their shortest representation,
- all section padding bits are zero,
- reserved cell, column, and operation values are never emitted,
- garbage operation detail bits are zero, and
- no trailing bytes follow the operation section.

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
- the pair-placement count exceeds `sequence.length`,
- a garbage operation has non-zero reserved detail bits,
- a required padding bit is non-zero,
- trailing bytes remain after the operation section, or
- replaying a stored operation is illegal for the reconstructed state.

The implementation must apply practical decoded-size and count limits before allocating large arrays. The current implementation limits the decoded payload to 2,048 bytes, the sequence to 1,024 pairs, and the operation history to 512 entries.

The initial board is expected to be a settled Tokopuyo-compatible field. The codec itself stores physical cell state rather than a generator-specific palette, so all five physical colors may be represented.

## Versioning

Once emitted publicly, version 1 decoding semantics must not change.

An incompatible binary format must use a new header version and a separate decoder.

The version nibble allows versions 1 through 15 in the current envelope. If that space is ever exhausted, a later version may define a new outer envelope.

## Size examples

For a replay with 100 tsumos and 100 operations, with both counts encoded in one byte:

Without an explicit initial state:

```text
header          1 byte
sequence count  1 byte
sequence       75 bytes
operation count 1 byte
operations      75 bytes
-----------------------
total          153 bytes
```

With an explicit initial state:

```text
153 + 30 = 183 bytes
```

The corresponding unpadded Base64url payloads are approximately 204 and 244 characters respectively.

## Design rationale

Version 1 favors a small, inspectable codec over maximum compression.

In particular:

- the actual tsumo sequence is stored instead of a randomizer seed,
- physical colors are stored instead of palette-relative indices,
- the initial field is a fixed 30-byte structure when present,
- pair placements reuse the engine's existing column and orientation model, while garbage drops use only a column,
- derived states are reconstructed rather than duplicated, and
- no Huffman coding, run-length encoding, or generator-specific compression is used.

This keeps replay URLs compact while making the format independent of Tokopuyo queue-generation details and straightforward to maintain over time.
