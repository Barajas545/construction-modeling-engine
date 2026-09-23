# Pyramid / box steps — geometry and preview

- A Deck Boundary can be converted into pyramid (box) steps from its area annotation: select the area, then **Convert to pyramid steps**.
- Each ring is a full closed box rather than an annulus, stacked smaller on top, matching how box stairs are actually framed. Ring 0 is the drawn boundary itself, so converting consumes the boundary without losing any geometry.
- The estimator picks which sides step. Any combination of 1, 2 or 3 sides is valid, so an asymmetric pyramid that shifts to one side is a first-class result rather than an error. The side that meets the parent deck is detected automatically and locked out of the selection.
- Riser height comes from the existing `solveStairLayout` unchanged — equal risers between 5″ and 7.5″, preferring 6″, no rounding. Only its riser output is used: its tread depth is clamped to 10–11″ and its run derives from that clamp, neither of which governs a box step.
- Tread depth is independent, with presets of 11″, 16.8″ and 22.5″ plus a free custom value up to 48″. 16.8″ and 22.5″ are three and four decking boards with their 3/16″ gaps, so a tread takes whole boards with no rips.
- Box count is `riserCount − 1`: the bottom riser steps onto grade, and grade is not a box.
- The dialog resolves the footprint live as the rise, tread and sides change. Footprint depth grows as `boundary depth + (boxes − 1) × tread`, not one tread per box, because ring 0 keeps the drawn boundary's own depth.

`src/core/geometry/polygon-offset.js` is the new primitive underneath. Offsetting several adjacent edges one at a time is not the same as offsetting them simultaneously, because each move drags the shared corner: every edge becomes a supporting line, the selected lines are shifted along their outward normal, and only then is each corner re-solved as the crossing of its two neighbours. A corner between two stepping sides therefore moves once, along the diagonal. Outward direction comes from polygon winding, so a clockwise and a counter-clockwise boundary give the same physical result.

Storage sits behind its own object type (`pyramid-stair`) with `geometry.ownership: 'pyramid-stair'`, so nothing in the stringer-stair path is touched. The existing stair model could not have carried this: it binds to exactly one host edge, one outward normal and exactly four vertices.

Consuming the source boundary also keeps the project honest — a boundary left in place would still report its area in Project surface and would still be charged field decking underneath the steps.

## Not yet included

Takeoff. The framing recipe (2× perimeter per box with internal joists at 12″ on centre crossing the short span, 2×8 for risers in the 6″–7.5″ band) is specified but not implemented, so pyramid steps currently contribute no material quantities. Depth shading for the descending rings is deliberately out of scope for now.
