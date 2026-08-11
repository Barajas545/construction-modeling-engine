# Stair Construction Object

## Intent

Users define a staircase from an existing Deck Boundary edge. They do not draw individual treads.

## Placement

Stair placement is a continuous press-and-drag gesture. The user presses an eligible Deck Boundary edge and drags outward to define the staircase run. During the gesture, CME previews every tread and displays total rise, riser count, tread count, individual riser height, and individual tread depth. Releasing commits the preview as a construction object.

The drag solver converts the outward run into a half-inch total-rise increment, then adds enough risers and treads to guarantee:

- no riser exceeds 7.5 inches;
- no tread exceeds 11 inches;
- the deck surface acts as the upper landing;
- the transition from the final tread to the deck counts as the last riser.

Therefore, a staircase always has one fewer tread than risers. For example, a 36-inch total rise produces five 7.2-inch risers and four 10-inch treads.

Placement replaces part of the selected boundary edge with four new opening/run segments. The source edge ID remains on the first surviving segment. Unaffected edge and vertex IDs remain unchanged.

## Data ownership

The Stair object owns construction dimensions and references:

- host Deck Boundary ID;
- original source edge ID;
- opening and outer vertex IDs;
- generated edge IDs.

Individual tread lines are derived graphics, not independent stored geometry. Generated boundary edges point back to their Stair through attachment properties. The serialized dimensions retain both `riserCount` and `treadCount`; `stepCount` remains as a compatibility alias for the riser count.

## Scope

This sprint provides planning geometry. It does not certify code compliance, landing requirements, stringer design, headroom, guard requirements, or structural adequacy. Those require explicit Product Lab and jurisdiction specifications.
