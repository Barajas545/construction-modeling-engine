# Hosted stairs preserve Deck Boundary topology

## Implemented

- A Stair is now an independent, serializable construction object with four stair-owned geometry points.
- Its host is a reference to a Deck Boundary edge, including normalized opening parameters; no DB vertex or edge is inserted, removed, or reassigned.
- When two DBs share a selectable edge, the higher deck remains the automatic Stair host.
- Stair width, side movement, tread regeneration, dimensions, decking exclusions, railing snaps, and framing Takeoff now read the Stair's independent geometry.
- Moving or reorienting the host edge regenerates the attached Stair without changing the DB topology.
- Side connections are semantic references and no longer split a neighboring Deck Boundary.
- Projects saved with the previous topology-cutting Stair model migrate to hosted Stair geometry when opened.

## Result

Deck Boundary area, joist-field clipping, Rim/Flush relationships, and framing calculations continue to use one uninterrupted authoritative polygon while stairs remain visually and semantically attached.
