# Stairs

Stairs is the first construction object that enriches and reshapes existing Deck Boundary geometry.

Users select a boundary construction edge and define the staircase rather than drawing individual steps. CME calculates the riser count, actual riser height, total run, opening vertices, generated boundary segments, and tread graphics.

The Stair object stores dimensions and stable references to its host boundary and generated anchors. Tread geometry is derived from those references, preventing overlapping independent geometry.

The initial implementation provides planning geometry, not code-compliance or structural approval. Those policies require future Product Lab specifications and jurisdiction-aware validation.
