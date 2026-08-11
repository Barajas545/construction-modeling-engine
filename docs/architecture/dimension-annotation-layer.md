# Dimension Annotation Layer

## Purpose

Dimensions communicate model geometry without owning it. They are an independent, serializable annotation layer so visibility and label placement never alter construction objects.

## Behavior

- The Dimensions layer is visible by default.
- Users can show or hide the complete layer from the canvas toolbar or Drawing Layers panel.
- Every visible label can be dragged in world space to reveal objects beneath it.
- Label offsets are stored by the stable ID of the referenced construction edge.
- Reset restores a label to its derived default position.
- Double-click routes to exact geometry editing when the linked object supports a safe edit.

Boundary-edge dimensions open the existing exact-length editor. The Deck–Stair interface dimension opens exact opening-width editing. Dimensions belonging to generated Stair run geometry select the owning Stair instead of allowing an edit that would break its anchors.

## Data boundary

The layer is stored as a `dimension-layer` project object. It contains only visibility and label offsets. Displayed measurements remain derived from current geometry, so exported project data never contains a stale duplicated length.
