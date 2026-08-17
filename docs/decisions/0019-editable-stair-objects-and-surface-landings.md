# ADR 0019: Editable Stair Objects and Surface Landings

Status: Accepted  
Implementation: Complete  
Date: 2026-08-17

## Context

The first Stair implementation created useful geometry but treated outward drag distance as total run, inferred rise from a visual ratio, targeted lower-deck edges, exposed generated stair corners as ordinary boundary nodes, and offered little editing after placement. Those behaviors could produce dimensions that did not describe a constructible stair and made established Stair objects too easy to deform.

Product Lab approved Stair as a constrained construction relationship between an upper host edge and, when present, a lower Deck Boundary surface. The object must remain simple enough for field use while preserving equal risers, equal treads, parallel sides, stable identity, and explicit invalid state.

## Decision

Treat total rise as the primary live drag value. Solve an integer riser count with equal risers between 5 and 7.5 inches, preferring 6 to 7.5 inches when possible. Derive one fewer tread than riser and keep equal tread depth between 10 and 11 inches. Total run is a derived, snapping result.

Connect decks only when the entire lower stair line fits inside a lower Deck Boundary polygon. Store the destination Deck Boundary identity and landing geometry, not a destination edge dependency. Deck elevation difference becomes authoritative total rise for connected stairs.

When independently modeled decks have coincident edges, resolve the Stair host before beginning the drag. Among the matching unlocked construction edges under the pointer, choose the surface with the smallest down-level value so the higher deck owns the Stair and the outward drag can enter the lower deck.

Established stairs own a centered Dimensions-layer annotation and editable total rise, riser, and tread fields. Editing regenerates the same object and preserves anchor identities. Lateral-line dragging changes width while maintaining parallel sides; either opening side snaps to a host node within six inches. Generated outer Stair nodes are not direct geometry-editing handles.

When a stair side and an adjacent Deck Boundary are collinear, divide the visible line into semantic selection intervals. The overlapping interval selects as the shared Construction Edge; any continuation selects as Stair-only geometry. This applies whether the boundary interval is longer or shorter than total run and avoids duplicate coincident lines.

The host-edge angle is protected while the Stair relationship exists. CME first attempts to regenerate when connected levels change. If equal-riser, equal-tread, valid boundary, or landing containment constraints cannot be satisfied, retain the Stair, mark it red, record the review reason, and exclude it from future quantity and cost calculations. Provide a direct **Delete stairs** action that restores the host Deck Boundary so the user can create a new valid Stair.

## Consequences

- Live feedback and completed geometry describe the same construction dimensions.
- A 24-inch level difference naturally produces four 6-inch risers and three equal treads.
- Lower decks are usable landing surfaces rather than artificial edge targets.
- Shared-edge hit order cannot accidentally make the lower deck the Stair host.
- Stair width can change without creating trapezoids or nonparallel stringers.
- Invalid relationships remain visible and understandable instead of silently deforming or disappearing.
- Stair deletion is a topology operation, not merely object-record removal.
- Future quantity and costing services have an explicit lifecycle state to reject.
