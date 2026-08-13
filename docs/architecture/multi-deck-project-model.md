# Multi-Deck Project Model

## Purpose

A CME project may contain multiple Deck Boundary construction objects. Each boundary represents one walkable deck polygon with an independent identity, topology, elevation, construction properties, annotations, and attachments.

## Surface quantities

Each boundary retains its local `areaSquareInches`. The project surface area is a derived sum across every Deck Boundary rather than a duplicated stored value. This gives the future Quantity Engine one authoritative source while preserving local areas for scope, level, and material decisions.

## Levels and visual hierarchy

`metadata.levelDownInches` records the positive vertical distance below the project datum. Boundary vertices mirror that value as negative elevation. Rendering uses progressively darker deck shading as the level-down distance increases, so separate elevations remain readable without adding unnecessary colors.

## Assembly movement

Move Deck Area translates the selected boundary and coordinate-owned hosted geometry in one history operation. Edge- and vertex-referenced objects such as stairs and railings remain attached through stable IDs and derive their positions from the translated boundary. Level Down vertices and stored railing fallback points translate with the host. Geometry locks prevent an assembly move until explicitly released.

A staircase that already connects two different Deck Boundaries acts as a positional constraint between them. CME blocks moving either deck independently until that cross-deck Stair is removed or reconnected, avoiding a silent broken landing relationship.

## Deck-to-deck stairs

During stair placement, CME searches other lower Deck Boundaries for a parallel landing edge under the pointer. A connection is accepted only when the destination is lower, the edge is parallel, the stair opening fits on the landing, and the approach is outward from the upper host. The exact deck-level difference controls total rise; riser and tread counts are recalculated to preserve the 7.5-inch and 11-inch limits. The completed Stair stores both its upper host and lower destination references.

Changing either deck level resynchronizes connected stair rise, riser count, and tread depth. If the destination is no longer below the host, the Stair is retained but explicitly marked for review instead of silently reversing construction direction.
