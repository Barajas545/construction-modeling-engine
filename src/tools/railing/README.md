# Railing

Railing is an edge-hosted construction object created by pressing and dragging along a Deck Boundary edge or Deck–Stair interface edge. The run stores normalized start and end positions rather than copied geometry, so it follows ordinary host-edge edits.

`railing.js` owns the construction rules and serializable object contract:

- maximum 72-inch clear span between post faces;
- 3.5-inch default post width;
- the fewest equal sections that satisfy the span rule;
- project-level post deduplication at shared endpoints;
- exterior corner classification by default;
- geometry and quantities only, without pricing.

The UI derives the current run geometry from the host edge on every render. Topology changes that would split or remove a hosted edge are currently blocked until dependency-aware repartitioning is implemented.
