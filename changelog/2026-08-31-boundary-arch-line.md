# Boundary Arch line — local 2026-08-31

- Object properties adds Arch line on straight Deck Boundary edges. Click/drag reshapes a live arc with fixed endpoints. Existing curves offer reshape and Straighten.
- Adds selected-arc R (radius), H (chord midpoint to arc midpoint), and midpoint reference nodes. The former C center-offset dimension and circle-center snap are removed to reduce visual noise.
- Circular math: `src/core/geometry/circular-arc.js`. Serializable grouped topology and safety checks: `src/tools/arch-line/arch-line.js`.
- Polygon geometry follows the curve with <=1/64-inch chord deviation; area, fill, boarding and finish footage follow it. Rendering and radius/arc-length readouts are analytic. No hundreds of editable sample-node markers/cotas.
- UI preview is nonpersistent; release commits once, cancel/Escape discards. Existing Joist Fields regenerate on commit; invalid changes abort. Saved projects and whole-deck movement retain arcs.
- A selected arc can become a Curved rim joist. It inherits the dominant Joist Field profile, supports joist termination against the sampled contour, and contributes one logical member to Framing Takeoff using analytical arc length. Stock carries bending/lamination review.
- Curved Picture frame emits a separate heat-bent square-edge composite decking line using analytical arc length. Ledger, railing and stair hosting remain unsupported on arcs.
- Port `src/tools/deck-boundary/deck-boundary.js`, `src/core/geometry/snap-engine.js`, `src/ui/app.js`, `src/ui/styles.css`, new math/tool files and tests together. Detailed module contract: `src/tools/arch-line/README.md`.
- Local only; no DCR Portal or public deployment performed.
