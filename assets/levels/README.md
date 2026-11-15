# Level Matrices

One file per level: `01.txt` … `39.txt`. The game parses these at build time via
`src/game/data/levelParser.ts`. Edit the matrix, then run:

```bash
npm run validate:levels
npm run preview:levels   # work/level-previews/01.png ...
```

## Header

```text
# 03 — Yanlış İlaç
name: Yanlış İlaç
theme: day          # day | dusk | night
animal: 2           # 0..38, helpless.png order
hint: ...           # optional
```

`animal: N` selects the rescue sprite (`animal-NN`). Each of the 39 animals is
used exactly once.

## Rows

All rows are optional except `GROUND`. Spaces are ignored. Positions are
`U = 72px` based (`src/game/layout.ts`); a `.` slot is 36px.

| Row | Meaning |
|---|---|
| `GROUND` | `#` = one full 1942px hospital-bed tile; `.` = 202px gap. **Never cut a floor tile.** |
| `RAISED1` | Floating upper route at `y=360`. `a`/`b`/`e` = whole `high-floor-*` sprites, scaled (a 0.38, b 0.48, e 0.42); `.` = 36px empty slot. Center it over a gap, never on the floor. |
| `RAISED2` | Second floating level at `y=252`, a side staircase next to a `RAISED1` (over the gap edge). `b`/`e` only (b 0.39, e 0.35). |
| `DECOR` | Ground-level, non-colliding props: `c` = wheeled cart (`high-floor-c`, 0.72) in a gap; `d` = O2 rack (`high-floor-decor`, 0.85) on a floor run. |
| `E0` | enemies/pickups on the ground; 96 slots spread proportionally across the level width. |
| `E1` | entities on `RAISED1` (`y=360`). |
| `E2` | entities on `RAISED2` (`y=252`). |

## Entity letters

| Letter | Entity |
|---|---|
| `m` | microbe |
| `M` | tougher microbe (skin 2) |
| `f` | flying microbe |
| `p` | pus / iltihap |
| `d` | doctor (sarma target) |
| `n` | nurse (sarma target) |
| `b` | boss (only `39.txt`) |
| `s` `t` `u` `v` | sushi kinds 2–5 |
| `g` | green garnish (heal) |
| `k` | rescue animal marker (exactly one) |

The parser maps slot position `i` of a 96-slot line to
`x = levelWidth * (i + 0.5) / 96`. Keep entities over a platform at the row's
height, or `validate:levels` rejects them. Put at least one sushi on
`E1`/`E2` so the upper route has a reward.

## Rules enforced by `validate:levels`

- 39 files, animal indices 0–38 exactly once.
- First ground run starts at x=0; every ground run is `n × 1942`px.
- Gaps are 202px.
- Raised pieces use valid scaled `high-floor-*` images. Their bottom stays
  above the floor (`RAISED1`) or above the `RAISED1` surface (`RAISED2`).
- Each `RAISED1` is centered over a ground gap; `RAISED2` sits beside a
  `RAISED1` as a staircase. Same-height platforms must be at least 120px
  apart (use another gap).
- Reachability: horizontal edge distance ≤180px, rise ≤245px.
- Sushi is 35–210px above a platform.
- Boss exists only in `39.txt`.
- Rescue animal sits on a ground run.
