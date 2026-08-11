# ADR 0005: Topology-Aware Vertex Editing

Date: 2026-08-10

Status: Accepted

## Context

Dragging one Deck Boundary vertex onto another previously left a short invalid edge. Progressive construction modeling requires geometry refinement without redrawing the project or silently discarding edge properties and attached-object references.

## Decision

Treat coincident adjacent vertices as an explicit merge operation. Remove the dragged vertex and redundant edge only when the resulting polygon validates. Preserve one adjacent edge identity, combine its construction properties deterministically, record provenance, and remap known edge references.

Limit direct merges to neighboring corners. Reject a merge when the removed vertex anchors a Stair until the engine has a general dependency-regeneration service.

Expose the same mental model across devices: direct drag-and-merge on pointer devices, visible merge feedback, and a contextual midpoint insertion action that is practical on tablets.

## Consequences

- Accidental short edges become intentional topology changes.
- Downstream tools can rely on a documented survivor and property policy.
- Undo and redo treat a merge as one construction edit.
- Attached objects remain safe, but some edits are conservatively blocked until dependency regeneration exists.
- Property conflicts need tool-specific merge policies as new construction namespaces are introduced.
