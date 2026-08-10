# Progressive Construction Modeling

## Product direction

CME maintains one evolving construction project from field capture through detailed modeling and takeoff. Field and office workflows are stages of the same document, not separate applications, files, or model types.

## Project maturity

The project document records workflow stage separately from construction objects:

1. Field capture
2. Estimate ready
3. Detailed modeling
4. Construction ready

Stage communicates intent and interface emphasis. It does not hide, duplicate, flatten, or replace model data. Moving forward preserves project and object identities.

## Object maturity

Construction objects have their own lifecycle. Deck Boundary begins as transient sketch geometry, becomes a reviewable object when closed, and becomes authoritative after field confirmation. Established objects remain editable and revisioned.

Future objects should follow a compatible pattern where appropriate, but lifecycle states must describe construction meaning rather than generic completion percentages.

## Progressive detail

Detail grows by attaching new objects and relationships to authoritative existing objects. Later tools should reference stable Deck Boundary edge and vertex IDs. They must not redraw or fork the footprint for a more detailed workflow.

Derived model progress is advisory UI state. Authoritative construction data remains in the object graph.

## Tablet and desktop consistency

Both device classes share the same world-space camera, snap engine, commands, and object operations.

- Tablet prioritizes generous hit targets, tap placement, direct manipulation, and two-finger navigation.
- Desktop extends the same mental model with pointer buttons, wheel navigation, hover feedback, and keyboard entry.

The goal is workflow continuity rather than identical controls.
