# Level Down construction object

Level Down represents a continuous change in deck elevation as project data, not decorative SVG geometry.

## Model

- `type: level-down` and `schemaVersion` identify the object contract.
- `host.boundaryId` connects the object to the authoritative Deck Boundary.
- Ordered vertices define the polyline. The first and last vertices retain their boundary snap references.
- Ordered segments own stable identities and reference the Level Down owner.
- `dimensions.riserHeight` is stored once so editing any selected section updates the complete polyline.
- `properties.regionSide` selects one of the two regions closed by the polyline and Deck Boundary; the smaller region is the default and can be flipped.
- `properties.finishes` stores Picture Frame and Fascia intent for the lowered-area transition.
- Lifecycle revision records meaningful object edits.

## Interaction

The first click must snap to Deck Boundary construction geometry. Grid-snapped intermediate clicks may refine the path. A later click on Deck Boundary geometry completes the object. Each finished segment has its own selection target and may be divided into two or three equal sections.

Level Down does not edit the Deck Boundary topology and does not participate in Railing post derivation. This keeps elevation intent independent from safety-system layout until Product Lab defines their future relationship.

## Region and depth

The engine derives two possible closed polygons by joining the Level Down polyline to each path between its endpoints on Deck Boundary. It selects the smaller polygon by default, which supports both internal and external lowered areas, and allows the user to flip the chosen side.

Nested lowered regions accumulate the step drops of containing regions. Rendering uses that total depth for both the inches-only arrow annotation and progressively darker shading. Overlapping translucent regions also reinforce the visual hierarchy. Annotation position and visibility remain in the shared Dimensions layer; a displaced label draws a live leader arrow back to its owning region.

## Future extensions

The object is ready to acquire elevation offsets, finish intent, nosing details, quantity outputs, and validation against connected deck levels without changing its basic identity or redrawing the project.
