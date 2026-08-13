# Topology-Aware Vertex Editing

## Purpose

Deck Boundary editing changes a construction object, not temporary sketch linework. Vertex operations therefore preserve a valid closed boundary, stable identities, and attached construction meaning wherever possible.

## Interaction model

- Drag a corner to refine its position.
- Drag it onto either neighboring corner to merge them.
- Select an edge and insert a corner at its midpoint for a tablet-friendly split.
- Double-click an edge to insert a corner at a precise location on desktop.
- Remove a selected corner when at least three valid corners remain.
- Lock a corner in place when it must remain a stable construction reference.
- Select a 90-degree corner, choose **45° Chamfer**, and drag to set equal setbacks with a live dimension.

Only adjacent corners can merge. The candidate glows before release, making the topology change explicit. A merge is rejected if it would invalidate the boundary or if the removed corner currently anchors an attached Stair.

## Construction locks

Locks are domain constraints, not interface-only flags. A locked node rejects movement, deletion, merging, and chamfer replacement. A locked edge rejects direct movement, exact length changes, splitting, horizontal or vertical constraints, and stair attachment. Operations that would move a locked edge indirectly through one of its endpoints are rejected as well.

The drawing exposes constraint state with an anchor inside the edge dimension and an anchor beside the node. The selected-object panel provides the corresponding Lock or Unlock action without requiring a separate constraint manager.

## 45-degree chamfer

A chamfer replaces one orthogonal corner with two new nodes and one generated construction edge. The gesture derives a single setback distance from the pointer, applies it equally to both connected edges, and previews both the topology and dimension before commit. Adjacent edge identities and construction properties remain intact; the generated edge combines compatible construction properties and records its source node and geometric constraint in serializable metadata.

## Identity and property preservation

Merging removes the redundant edge and keeps the other adjacent edge as the survivor. The survivor retains its stable ID, combines supported property groups, and records the removed edge ID in metadata. Known edge references on attached Stair objects are remapped to the survivor.

Splitting follows the complementary policy: the original edge ID stays on the first segment and the new segment inherits the edge's construction properties.

## Extension boundary

The current attachment guard is intentionally conservative. Future construction objects need a shared dependency graph that can regenerate, remap, or request review after a geometry edit. That service should replace object-specific reference handling in the interface layer.
