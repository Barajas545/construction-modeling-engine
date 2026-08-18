# Deck levels and CAT editing

Date: 2026-08-18

Status: Implemented

Deck Area annotations now communicate project elevation directly. A Deck Boundary below the project datum adds a compact `↓ inches` badge beneath its area label; a deck at the main level remains unchanged. Selected Deck Area properties provide **Reposition arrow** and **Reset arrow**, preserving the leader's semantic attachment while letting users expose construction underneath.

CAT CL now includes:

- **Trim** — touch the side of a CAT Line to remove it at the nearest crossing with another CAT Line or Deck Boundary edge.
- **Extend** — touch near a CAT Line endpoint to extend it to the first crossing beyond that endpoint.
- **Note** — choose an arrow point, enter estimator text, then drag the numbered note label independently. Selected Note properties support text editing and an optional voice recording of up to 30 seconds.

CAT notes remain secondary annotations. Their arrow point stays fixed when the label moves, and they hide with the CAT Dimensions layer rather than altering Deck Boundary geometry.
