# Stair covering types and fascia takeoff

## Follow-up: pictureframe stringer supports and lower framing

Pictureframe stairs now use explicit stringer axes: both sides, supports at 6.5 inches from each edge, and equally subdivided interior bays no larger than 12 inches. At 36 inches width: 0, 6.5, 18, 29.5, 36 inches. `deriveStairFraming` is the shared source for geometry, counts and object properties. Legacy stairs use their existing default pictureframe style. Narrow invalid stairs avoid duplicate axes and require review. Square cut retains its original framing recipe.

Pictureframe adds a 2×8 PT full-width lower-riser closure (drawn opposite the stair ledger) and a 2×4 PT full-width bottom tie / sole plate (takeoff and properties only, below the stringers in plan). These have separate automatic IDs `auto:stairs:lower-closure:<stock>` and `auto:stairs:bottom-tie:<stock>`, with the smallest fitting 8/10/12/16/20 ft stock and review lines for overlength. Existing manual overrides remain intact. Consolidated purchasing recognizes the new construction roles and groups by profile/material/stock; detailed exports retain their role. No fasteners or structural capacity are inferred. Tests cover style switches, offsets, spacing, transforms, stock, overrides and export. No DCR Portal/public deployment.

## Follow-up: stair framing visibility

`src/tools/stair-framing/stair-framing-geometry.js` derives one ledger/header and side/internal stringers from the existing framing calculation, transformed through stair anchors for any orientation. The renderer in `src/ui/app.js` overlays these members after stair finishes; `src/ui/styles.css` reuses yellow joist styling and the red ledger color. The overlay follows Framing visibility, independently of Decking and deck Joists, and cannot intercept pointer events. Existing finishes and takeoff stay unchanged. Geometry tests cover count parity, maximum spacing, visibility, rotated/mirrored legacy geometry, invalid anchors and no mutation. Local only, not published to DCR Portal.

## Follow-up: tread board visualization

`src/tools/stairs/stair-boarding.js` now derives board seams in stair-local coordinates for both finished stairs and creation previews. Square cut shows one full-width seam (two boards). Pictureframe shows a shorter inner seam, side returns and 45-degree front miters. Each tread starts at its outward nosing: its seam is 5.5 inches back from that nosing, including when tread depth is 10 or 10.5 inches. Pattern rotates/mirrors with its Stair anchors and stays within each tread.

`src/ui/app.js` draws these lines after the original fill and before tread outlines and selection hit targets. `src/ui/styles.css` adds only a subtle dark non-scaling seam stroke with pointer events disabled. Existing colors, outlines, selection and geometry are preserved. Board seams follow Decking visibility and add no snap targets, dimensions, stored geometry, or quantities. See `stair-boarding.test.mjs` for pattern geometry and regression tests. This supersedes the earlier note that no board-cut diagram is rendered; the visualization remains schematic rather than a fabrication drawing.

## Follow-up: commercial riser fascia stock

This refinement supersedes the fixed fascia-stock purchase rule below for **risers only**. Net riser LF remains stair width times riser count, with no side lengths or 16-inch allowance. Four 3 ft risers = 12 LF net, purchased as one 16 ft fascia board. Available planning lengths default to 12 and 16 ft, with an optional `takeoff.settings.stairRiserFasciaStockFeet` catalog.

`planStairRiserFasciaStock` tries cut-packing layouts under each stock cap, selects the least purchased footage among those candidates, then the fewest pieces, while preserving full-width cuts and configured reserve. Even at zero waste, an exact net match advances to the next purchase increment for cutting reserve. This is a packing heuristic, not a guarantee of a globally optimal cutting plan or manufacturer stock availability. Widths exceeding the catalog remain REVIEW items.

Purchase rows are grouped by actual stock length (`auto:stairs:fascia-risers:12`, `:16`, or `:review`). Old unsuffixed riser overrides stay stored but are not carried to another stock length or price. The new rows retain user quantity/price edits and supplier export behavior. Side fascia and framing are unchanged. Tests cover the user's 4 x 3 ft example, side/riser isolation, exact-match reserve, wide cuts, and round-trip overrides.

Implemented locally, 2026-08-31. Not promoted to DCR Portal.

## User controls

- Selecting the Stair label or Stair object opens the same Object Options panel with `Pictureframe stairs` and `Square cut stairs`.
- New stairs default to Pictureframe and an 11-inch tread. Existing explicit depths are preserved, not reset on load or style change.
- Existing tread editing stays within the current 10-11 inch layout limits. Editing it regenerates total run, landing validation, framing, and covering quantities.
- Lower-deck connection search prefers 11 inches and falls back to another supported depth only if the landing cannot contain it.
- This change supplies finish selection and estimating rules, not a rendered board-cut diagram or structural approval.

## Net material rules (inches before conversion to LF)

Let W = stair width, D = actual tread depth, T = tread count, R = riser count, L = total run, H = total rise.

| Material | Pictureframe | Square cut |
| --- | --- | --- |
| Square-shoulder decking per tread | Inner W - 11; front W; two returns D each | Two strips W each |
| Frame cut | Front and returns have 45-degree miters | 90-degree ends |
| Riser fascia | W x R | W x R |
| Side fascia | Two pieces, each sqrt(L^2 + H^2) + 16 | Two pieces, each L + 16 |

The inner deduction is two 5.5-inch board widths, independent of D. At D=11, the outside frame totals 11 + W + 11. The 16-inch allowance is applied once per side, not per riser; configurable waste is additional.

Interpretation recorded for review: both styles receive stair-width fascia on every riser; Pictureframe sides use sloped length while Square cut sides follow the explicitly requested total-run rule.

## Source map

- `src/tools/stairs/stair-covering.js`: pure, serializable finish settings and net material/cut descriptions.
- `src/tools/stairs/stair-covering-controls.js`: shared selector and explanatory quantities.
- `src/tools/stairs/stair.js`: 11-inch creation default and lower-landing preference.
- `src/ui/app.js`: selection binding, undoable finish changes, existing dimension editing.
- `src/tools/takeoff/takeoff.js`: three Stairs rows: square-shoulder treads, riser fascia, side fascia. Stair Framing rows remain independent and unchanged.
- `src/tools/stairs/stair-covering.test.mjs`: formulas, edits, save/load, UI markup, mixed types, stock settings, overrides and supplier export.
- `tests/stair.test.js`: updated free-drag default expectations.

## Compatibility and limits

`stair.covering = { schemaVersion: 1, style: 'picture-frame' | 'square-cut' }` is additive. Missing/unknown stored style reads as Pictureframe without mutating geometry. Existing Stair schema version 3 and project schema are retained.

Legacy automatic rows `auto:stairs:grooved-tread`, `auto:stairs:square-nose`, and `auto:stairs:square-riser` are replaced. Their old overrides remain stored but are not reused as prices/quantities for different materials. Review/re-enter prices and quantities on the new rows; manual rows are not removed.

New IDs: `auto:stairs:square-shoulder-treads`, `auto:stairs:fascia-risers`, `auto:stairs:fascia-sides`.

Stock follows Takeoff settings: squareEdgeStockFeet (16 ft default) and fasciaStockFeet (12 ft default). Purchases use ceil(net LF x (1 + waste/100) / stock LF), with 10% default waste. These remain REVIEW allowances, not optimized cutting schedules; board width/height suitability, continuous cut lengths, joints, kerf and offcut reuse need estimator review. The 2x12 PT stair framing recipe is unchanged.
