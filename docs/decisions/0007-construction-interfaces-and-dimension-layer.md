# ADR 0007: Construction Interfaces and Dimension Layer

Date: 2026-08-11

Status: Accepted

## Context

The line between Stair and Deck was visible but not selectable, preventing construction finishes from being assigned to it. Dimension labels also obscured geometry and had no independent visibility or placement controls.

## Decision

Represent the Deck–Stair connection as a typed interface edge owned by Stair. Keep it outside the ordered Deck Boundary perimeter while referencing the same upper opening vertices. Give it the shared grouped edge-property contract and a stable identity.

Represent dimensions as a serializable project annotation layer keyed to stable construction-edge IDs. Derive measurement text from geometry, store only visibility and label offsets, and route double-click editing through supported construction-object operations.

Render the Dimensions layer as one global annotation pass after every deck surface and construction-object pass. Labels, leaders, and their interaction targets therefore remain above shading from every Deck Boundary, regardless of object creation order or elevation.

## Consequences

- Future Stair-specific finishes and metadata have one authoritative attachment point.
- The Deck Boundary remains a valid simple polygon.
- Dimension layout can evolve independently without contaminating construction geometry.
- Dimensions remain visible, selectable, and draggable over overlapping or lower deck shading.
- Exact editing remains guarded by object ownership; generated Stair geometry cannot be changed as unrelated linework.
- Future annotation layers can follow the same visibility and serialization pattern.
