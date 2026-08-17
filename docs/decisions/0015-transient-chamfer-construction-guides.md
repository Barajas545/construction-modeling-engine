# ADR 0015: Transient Chamfer Construction Guides

Status: Accepted  
Implementation: Completed  
Date: 2026-08-17

## Context

During creation of a 45-degree chamfer, CME currently shows the temporary setback value over the standard dimension of the generated diagonal edge. The two values do not match because they describe different geometry: the setback measures the equal distance removed from each original edge, while the diagonal dimension measures the finished chamfer edge. Overlapping labels make that distinction difficult to understand, especially on a tablet.

## Decision

While the user drags a 45-degree chamfer, preserve the original corner as a temporary virtual node and show two dashed construction lines from that node to the new chamfer endpoints. These guides represent the equal setbacks along the original boundary edges.

Show the setback as a live temporary dimension and show the finished diagonal edge length as a separate live dimension. Keep the 45-degree indicator visually distinct from both measurements. On touch devices, position temporary labels away from the active finger whenever practical.

When the user releases the gesture, remove the virtual node, dashed construction lines, and setback dimension. Retain only the completed diagonal construction edge and its normal edge dimension.

Do not introduce a dedicated chamfer-editing mode. After creation, the chamfer edge and its endpoints behave like ordinary Deck Boundary geometry and use the standard edge and node editing tools.

## Consequences

- Users can see why the setback and diagonal measurements are different.
- Temporary references clearly distinguish construction intent from finished geometry.
- The completed model remains visually simple after the gesture ends.
- Tablet and desktop users share the same interaction model without adding persistent controls.
- The implementation suppresses the ordinary diagonal annotation during the gesture and replaces it with a separate live diagonal label, preventing overlap with the temporary setbacks.
