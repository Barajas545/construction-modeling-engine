# Modeling Interaction System

## Purpose

The modeling interaction system translates natural pointer and keyboard intent into precise construction geometry. It is shared infrastructure for future CME tools rather than Deck Boundary-specific UI behavior.

## Viewport

The viewport is represented in world units and remains independent of SVG and browser coordinates. Zoom is anchored under the cursor, pan is expressed as a world-space translation, and fit-to-project derives a bounded view from model points. Navigation operations do not modify project data or enter command history.

The initial controls are continuous wheel zoom, right-button drag pan, middle-button double-click fit, and an explicit fit action. Animated interpolation makes short zoom transitions readable while an animation token prevents overlapping wheel events from competing.

## Snap engine

Snap targets use a common contract containing type, geometry, priority, and optional reference identity. The resolver receives world-space tolerance derived from a stable screen-space hit radius. This keeps snapping visually consistent at different zoom levels.

The first active candidates are:

- endpoint;
- midpoint;
- edge projection;
- horizontal and vertical alignment;
- 45-degree angle inference;
- construction grid.

The priority table and target collector are extensible for intersections, centers, parallel and perpendicular relations, construction guides, and targets supplied by future construction objects.

## Direct dimensions

Sketch length entry accepts common construction notation in feet, inches, millimeters, and meters. Values normalize to the engine's inch base unit. The entered length follows the current cursor direction, allowing graphical direction and numeric precision to coexist.

Length parsing is a core unit service and has no interface dependency.

## Heads-up feedback

During sketching, the cursor HUD reports live length, angle, active snap, and numeric entry. This is contextual feedback, not authoritative state. Geometry and inferred relationships remain in the model operation pipeline.

## Grid

Grid display density adapts to viewport scale while snapping precision remains independently configurable. Users may choose fixed construction increments or hide the visual grid without disabling model operations.

## Keyboard workflow

- Type a construction length and press Enter to place the next segment.
- Enter closes a boundary when no dimension is active.
- Escape first clears active input, then removes the last sketch step, then exits the tool.
- Space or `R` repeats the last segment length and direction.
- Tab returns contextual numeric-entry guidance without leaving the canvas.

These bindings are the first layer of a future command-routing system and should not be duplicated inside individual construction objects.
