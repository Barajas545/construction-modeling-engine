# Stairs

## Board pattern

`stair-boarding.js` derives display-only seams from the Stair anchors and covering style. Every tread starts at its outward nosing, with a 5.5-inch front board measured back toward the riser. Square cut draws a full-width joint. Pictureframe draws the shortened inner joint, two returns, and two 45-degree front-corner miters (U frame, no rear frame). The remaining inner strip is clipped to the actual tread depth. The original fill and structural tread lines are unchanged. Seams follow Decking visibility, ignore pointer events, and create no model edges, snap nodes or Takeoff items.

## Covering

Selecting a Stair label or object exposes the shared covering selector. `stair-covering.js` stores additive `covering.schemaVersion: 1` and `covering.style` (`picture-frame` or `square-cut`). Missing settings default to Pictureframe. New treads default to 11 inches; saved explicit depths remain unchanged. The current dimension editor still accepts 10-11 inches and recalculates total run.

Pictureframe uses one inner strip of width minus 11 inches and an outer frame of width plus twice the actual tread depth per tread. Square cut uses two stair-width strips per tread. Both use fascia on every riser and both sides; Pictureframe side length is the slope plus 16 inches, Square cut is total run plus 16 inches. See `../../../changelog/2026-08-31-stair-covering-types.md` for purchase assumptions and compatibility.

Stairs is a hosted construction object that references a Deck Boundary edge without changing the boundary polygon.

Users select a boundary construction edge and define the staircase rather than drawing individual steps. The drag reports total rise first; CME then calculates equal risers between 5 and 7.5 inches, equal treads between 10 and 11 inches, total run, stair-owned opening vertices, and construction-correct plan graphics.

The Stair object stores dimensions, its four-point geometry, and a stable reference to its host boundary edge. Completed stairs have a selectable Dimensions-layer label, exact editable dimensions, draggable parallel side lines, and six-inch geometric snaps. Deleting a stair removes only that hosted object because the Deck Boundary remains continuous. Individual stair-only nodes are intentionally not editable. Older topology-cutting stair records migrate to the hosted model when a project is opened.

A staircase may connect to a lower Deck Boundary when its complete lower landing line fits inside that deck surface. When two decks share the clicked edge, CME automatically uses the higher deck as the Stair host so the drag enters the lower surface. The level difference becomes authoritative total rise. CME regenerates an established staircase when connected deck levels change; if no valid equal-riser, equal-tread, or landing solution remains, the same object stays visible in red with a reason and is excluded from future estimating outputs until recreated.

The initial implementation provides planning geometry, not code-compliance or structural approval. Those policies require future Product Lab specifications and jurisdiction-aware validation.
