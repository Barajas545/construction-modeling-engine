# Stair Construction Object

## Intent

Users define a staircase from an existing Deck Boundary edge. They do not draw individual treads.

## Placement

The initial Stair definition includes clear width, total rise, target riser height, and tread depth. CME calculates riser count, actual riser height, and total run.

Placement replaces part of the selected boundary edge with four new opening/run segments. The source edge ID remains on the first surviving segment. Unaffected edge and vertex IDs remain unchanged.

## Data ownership

The Stair object owns construction dimensions and references:

- host Deck Boundary ID;
- original source edge ID;
- opening and outer vertex IDs;
- generated edge IDs.

Individual tread lines are derived graphics, not independent stored geometry. Generated boundary edges point back to their Stair through attachment properties.

## Scope

This sprint provides planning geometry. It does not certify code compliance, landing requirements, stringer design, headroom, guard requirements, or structural adequacy. Those require explicit Product Lab and jurisdiction specifications.
