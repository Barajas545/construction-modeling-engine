# ADR 0014: Multiple Deck Boundaries and Connected Landings

Status: Accepted  
Date: 2026-08-12

## Context

Real projects frequently contain separate deck polygons at different elevations. Treating those areas as one polygon would create false connecting geometry, while separate projects would break progressive modeling and estimating continuity.

## Decision

Allow any project document to own multiple independent Deck Boundary objects. Derive project surface area by summing their local computed areas. Store a positive down-level value on each boundary and preserve stable boundary, edge, and vertex identities.

Treat movement as an assembly-level operation. Translate the selected boundary and its coordinate-owned hosted geometry while reference-owned objects continue resolving through IDs.

Allow Stair placement to connect an upper host edge to a compatible parallel edge on a lower Deck Boundary. Derive total rise from the two boundary levels and serialize the destination boundary and edge on the Stair.

## Consequences

- One CME project can model disconnected or multi-level deck surfaces without duplicated projects.
- Future takeoff can use one derived project surface total and still inspect each local scope.
- Objects can attach to a specific deck instead of relying on a global primary polygon.
- Cross-deck objects now have explicit source and destination references, establishing a pattern for future ramps, bridges, and transition framing.
