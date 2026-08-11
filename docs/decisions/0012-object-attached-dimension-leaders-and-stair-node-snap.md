# ADR 0012: Object-attached dimension leaders and stair node snapping

Status: Accepted

## Decision

All visible dimensions render a leader line ending in an arrow tip attached to a derived point on the measured construction object. Label position and arrow-tip position are independent object-relative offsets in the Dimensions layer. Repositioning the tip is an armed, single-pointer interaction that works identically with touch, pen, and mouse.

Stair openings derive their position from the initial press on the host edge. Each opening side snaps to an adjacent boundary node within a 12-inch zone. Short edges close to the preferred stair width snap both sides automatically and reuse the existing node identities.

## Consequences

- Moving a label does not move its arrow tip, and moving the tip does not change model geometry.
- Arrow placement remains serializable, undoable, and semantically attached when geometry moves.
- Snapped stair sides avoid coincident vertices and invalid short edges.
- Node-controlled stair widths are edited through their shared nodes rather than by detaching the stair.
- Railing and Level Down topology remain unaffected.
