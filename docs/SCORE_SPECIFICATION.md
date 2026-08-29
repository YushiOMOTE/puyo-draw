# Puyo Puyo Tsu Score Specification

## Scope

This application uses the versus-mode score formula associated with Puyo Puyo Tsu. It calculates chain-clear score only. High-speed drop, all-clear, margin-time, handicap, Fever, and garbage-generation carry-over bonuses are out of scope.

## Per-chain formula

For each chain step:

```text
score = colorPuyos × 10 × multiplier
multiplier = clamp(chainBonus + groupBonus + colorBonus, 1, 999)
```

`colorPuyos` is the number of colored puyos cleared in that step. Garbage puyos cleared as neighbors do not count as color puyos.

`groupBonus` is the sum for every independently cleared same-color group in that step:

| Group size | 4 or less | 5 | 6 | 7 | 8 | 9 | 10 | 11 or more |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bonus | 0 | 2 | 3 | 4 | 5 | 6 | 7 | 10 |

`colorBonus` is based on the number of distinct colored puyo colors cleared simultaneously:

| Colors | 1 | 2 | 3 | 4 | 5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bonus | 0 | 3 | 6 | 12 | 24 |

The Puyo Puyo Tsu chain-bonus table used here is:

| Chain | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bonus | 0 | 8 | 16 | 32 | 64 | 96 | 128 | 160 | 192 | 224 | 256 | 288 | 320 | 352 | 384 | 416 | 448 | 480 |

For chains 19–34, the bonus continues in increments of 32 (512–992); chain 35 and above uses 999.

## UI and history behavior

- Each chain toast shows the chain number, that step's score, and the cumulative score.
- Tapping the chain-count button shows the current cumulative score in a toast.
- Reset and Clear set chain count and cumulative score to zero.
- Board history entries include the board, chain count, and cumulative score. Undo and Redo restore all three together.

## Sources

- [Puyo Puyo!! 20th anniversary @2ch wiki — chain score formula](https://w.atwiki.jp/puyo20th/pages/142.html) documents the multiplication formula, group bonuses, and color bonuses.
- [Puyo Puyo!! 20th anniversary @2ch wiki — chain multiplier table](https://w.atwiki.jp/puyo20th/pages/108.html) documents the Puyo Puyo Tsu chain-bonus values.
- [Qiita — 骨までしゃぶりつくす「ぷよぷよプログラミング」(2/4)](https://qiita.com/KennyKTA/items/b70422c28fa986b52bbe) independently describes the implementation-oriented score formula and bonus tables.

The sources describe broader game modes and platform variations as well; this document explicitly limits the implementation to the chain-clear portion listed above.
