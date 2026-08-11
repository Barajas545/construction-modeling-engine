# ADR 0011: Selectable deck area and independent Level Down objects

Status: Accepted

## Decision

The calculated Deck Boundary area is exposed through the Dimensions layer as a selectable, draggable annotation. Whole-boundary construction actions are presented when this area annotation is selected.

House Attachment remains a construction relationship owned by the selected boundary edge and is promoted into the selection-first quick actions.

Level Down is stored as an independent construction polyline hosted by Deck Boundary. Its endpoints must attach to boundary construction geometry, while intermediate vertices may use enabled grid snaps. One riser height belongs to the complete polyline. Segment division preserves the owner and shared riser.

## Consequences

- Area visibility and position remain annotation concerns and do not alter model geometry.
- Orthogonalization preserves existing vertex and edge identities while adjusting coordinates.
- Multiple Level Down objects can represent successive changes in elevation.
- Level Down editing does not modify Railing runs or post counts.
- A future elevation model can enrich these objects without replacing their identities.
