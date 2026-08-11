# Topology-Aware Vertex Editing

## Purpose

Deck Boundary editing changes a construction object, not temporary sketch linework. Vertex operations therefore preserve a valid closed boundary, stable identities, and attached construction meaning wherever possible.

## Interaction model

- Drag a corner to refine its position.
- Drag it onto either neighboring corner to merge them.
- Select an edge and insert a corner at its midpoint for a tablet-friendly split.
- Double-click an edge to insert a corner at a precise location on desktop.
- Remove a selected corner when at least three valid corners remain.

Only adjacent corners can merge. The candidate glows before release, making the topology change explicit. A merge is rejected if it would invalidate the boundary or if the removed corner currently anchors an attached Stair.

## Identity and property preservation

Merging removes the redundant edge and keeps the other adjacent edge as the survivor. The survivor retains its stable ID, combines supported property groups, and records the removed edge ID in metadata. Known edge references on attached Stair objects are remapped to the survivor.

Splitting follows the complementary policy: the original edge ID stays on the first segment and the new segment inherits the edge's construction properties.

## Extension boundary

The current attachment guard is intentionally conservative. Future construction objects need a shared dependency graph that can regenerate, remap, or request review after a geometry edit. That service should replace object-specific reference handling in the interface layer.
