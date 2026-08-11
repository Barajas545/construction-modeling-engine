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

The layer is stored as a `dimension-layer` project object. It contains visibility, label offsets, and hidden reference IDs. Displayed measurements remain derived from current geometry, so exported project data never contains a stale duplicated length. Individual contextual Add dimension and Delete dimension actions never modify the linked construction object.

## Object-attached leaders

Dimension labels and leader arrow tips are stored independently. `offsets` position labels relative to their derived annotation origin; `leaderOffsets` position arrow tips relative to the measured object's current anchor. Keeping both values object-relative means geometry may move without breaking the semantic measurement relationship.

Every visible dimension renders a leader line and arrowhead. A selection-first **Reposition arrow** command arms the current reference, pulses its tip, and accepts the next pointer press or drag anywhere on the canvas. The same pointer workflow supports mouse, pen, and touch. Canceling restores the prior document; completing the gesture creates one undoable history entry.
