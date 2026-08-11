# ADR 0009: Snap-anchored Railing layer

Status: Accepted

## Context

Restricting Railing to a single host edge prevented users from defining runs across open space, inside a boundary, or outside it. Visible railing hit targets could also obstruct editing of construction geometry underneath.

## Decision

New Railing runs connect two explicit snap anchors and may extend in any direction. Edge and corner snaps retain stable construction references; grid snaps retain exact project coordinates. Construction geometry has priority when both edge and grid snapping are enabled. Each snap source can be switched independently, and creation requires an active snap at both endpoints.

Railing becomes an independent serializable model layer. Hiding the layer suppresses graphics and selection hit targets without deleting or modifying its construction objects. Activating the Railing tool reveals the layer automatically.

## Consequences

Railing can model runs inside or outside the Deck Boundary without temporary geometry. Referenced endpoints continue to follow ordinary boundary edits, while topology operations that would destroy referenced geometry remain protected. A future dependency service can replace those protections with automatic reference migration.
