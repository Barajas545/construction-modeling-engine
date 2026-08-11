# Level Down construction object

Level Down represents a continuous change in deck elevation as project data, not decorative SVG geometry.

## Model

- `type: level-down` and `schemaVersion` identify the object contract.
- `host.boundaryId` connects the object to the authoritative Deck Boundary.
- Ordered vertices define the polyline. The first and last vertices retain their boundary snap references.
- Ordered segments own stable identities and reference the Level Down owner.
- `dimensions.riserHeight` is stored once so editing any selected section updates the complete polyline.
- Lifecycle revision records meaningful object edits.

## Interaction

The first click must snap to Deck Boundary construction geometry. Grid-snapped intermediate clicks may refine the path. A later click on Deck Boundary geometry completes the object. Each finished segment has its own selection target and may be divided into two or three equal sections.

Level Down does not edit the Deck Boundary topology and does not participate in Railing post derivation. This keeps elevation intent independent from safety-system layout until Product Lab defines their future relationship.

## Future extensions

The object is ready to acquire elevation offsets, finish intent, nosing details, quantity outputs, and validation against connected deck levels without changing its basic identity or redrawing the project.
