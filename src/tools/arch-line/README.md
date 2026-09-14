# Arch line

Select a Deck Boundary edge, choose **Arch line**, then drag the edge perpendicular to its chord. Endpoints remain fixed. Release creates one history entry; Escape or pointer cancellation discards the preview. Select an existing curve and choose **Arch line · reshape**, or **Straighten** to recover the original edge and properties.

## Representation

The circle is derived analytically from two endpoints and signed sagitta. `R` is radius and `H` is chord midpoint to arc midpoint. The UI intentionally omits the former `C` center-offset dimension to reduce visual noise, while retaining chord- and arc-midpoint references. Dragging rounds sagitta to 1/16 inch and supports inward/outward minor arcs through a semicircle. Self-intersecting contours are rejected.

`boundary.metadata.archLines[rootEdgeId]` stores the original edge, endpoint identities and signed sagitta. The root edge retains its ID. Core polygon consumers receive a sampled curve in `vertices/edges`, with at most 1/64-inch chord deviation; generated samples carry `archLineId` and are hidden as ordinary editable corners. Rendering uses one exact SVG circular arc, while fill, clipping, area, perimeter and finish takeoff use the sampled contour. Thus these metrics are close approximations rather than analytic arc integrations. Arc radius/length dimensions are analytic. This avoids drawing a decorative curve over a still-straight calculation model.

## Safety and interoperability

Curved sample segments are exempt from the minimum straight-edge length rule. Arc endpoints cannot be individually moved or removed; straighten first. Complete-deck translation remains valid. Finishes/locks propagate across the group and survive Straighten. Angle changes, splitting, ledger, railing and stair relationships remain blocked until Straighten. Existing Joist Fields are regenerated at commit; failure aborts the commit.

An existing arc can be converted to **Curved rim joist**. It follows the dominant Joist Field profile in its owning Deck Boundary, acts as a segmented flush support for joist intersections, and is counted once from the analytical arc length. Commercial stock planning is preliminary and carries a bending/lamination review note. If the arc is also Picture frame, Takeoff emits a separate heat-bent square-edge composite decking line based on the same analytical arc length. Curved railing and stair anchoring are not implemented. Snap references include arc midpoint and chord midpoint without exposing tessellation corners or the circle center as user nodes.

Project JSON retains metadata and geometry; older polygon-only consumers still see a fine segmented contour but must port this module to edit it as one curve. Transfer core geometry, boundary guards, snap engine, UI and tests together. Local CME only.
