# ADR 0004: Edge Enrichment and Derived Stairs

Date: 2026-08-10

Status: Accepted

## Context

Sprint 2 requires boundary edges to become construction objects and Stair to modify existing geometry without creating overlapping drawings.

## Decision

Promote embedded boundary edges to typed, versioned construction entities with stable identities and grouped property namespaces. Keep them inside their owning boundary aggregate so polygon ordering and validity remain consistent.

Represent Stair as a project construction object whose geometry is anchored to boundary vertices and generated edges. Store stair dimensions and references, then derive tread graphics.

Preserve the selected source edge ID on its first surviving segment and preserve all unaffected identities.

## Consequences

- Future tools can enrich boundary edges through isolated property groups.
- Construction graphics follow model meaning instead of generic layer colors.
- Stair edits will require a dedicated regeneration operation rather than direct tread editing.
- Geometry changes need a future dependency graph and impact-review workflow.
- Edge splitting needs explicit property propagation policies for every future property owner.
