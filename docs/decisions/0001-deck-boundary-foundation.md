# ADR 0001: Deck Boundary Foundation

Date: 2026-08-10

Status: Accepted

## Context

Deck Boundary is the first production construction object and will become the attachment surface for many later objects. Renderer-owned geometry or index-only references would make future editing and integration fragile.

## Decision

Represent Deck Boundary as a versioned construction object with ordered, inch-based vertices and explicit edges. Give both vertices and edges stable identities. Keep edit operations immutable, validation structured, and derived measurements reproducible from authoritative coordinates.

Use a versioned project document as the persistence envelope and commands as the history boundary. Keep the browser interface as an adapter over these modules.

## Consequences

- Future tools can reference specific boundary segments safely.
- Rendering and UI approaches can change without migrating construction behavior.
- Schema evolution requires explicit versioning and migration work.
- Geometry remains two-dimensional for this iteration, while vertices reserve elevation for future multi-level modeling.
