# ADR 0006: Live Drag Stair Placement

Date: 2026-08-11

Status: Accepted

## Context

The first Stair workflow required users to select an edge, enter several dimensions, review a preview, and confirm. Field users need a faster tablet-first interaction and must see the total rise while deciding where to stop.

The original geometry also treated the number of generated tread lines as equal to the number of risers. Construction reality requires the deck surface to act as the upper landing: the transition from the final tread to the deck is itself the last riser.

## Decision

Use a continuous edge-to-outward drag gesture. Derive the stair run from pointer distance and update the preview plus measurement HUD on every pointer move. Commit the attached Stair when the pointer is released.

Store explicit riser and tread counts. Generate one fewer tread than risers, enforce a maximum 7.5-inch riser, and enforce a maximum 11-inch tread in the domain model rather than only in the interface.

## Consequences

- Field placement requires one gesture and gives immediate dimensional feedback.
- Tablet and desktop users share the same mental model.
- Existing serialized Stair objects remain renderable through the `stepCount` compatibility field.
- The current drag-to-rise ratio is a planning interaction and should become configurable when Product Lab defines jurisdiction and preferred stair-proportion policies.
- Editing an established Stair still needs a future regeneration workflow.
