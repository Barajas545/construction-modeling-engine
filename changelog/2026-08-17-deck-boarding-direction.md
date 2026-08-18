# Deck boarding direction and deck-area lifecycle

- Added a Deck Boundary-owned board-direction property with a stable line reference, origin, angle, board width, and gap.
- Added `Board direction`, `Rotate 90°`, and `Clear boards` actions to the selected deck-area panel.
- Added subtle polygon-clipped board lines above deck shading and below all construction objects, with attached Stair footprints excluded.
- Kept the board pattern inside the Decking layer so the existing visibility control hides both surface shading and board lines.
- Added a distinct two-step `Delete deck area` action.
- Deck deletion now removes dependent Stairs, Railings, Level Down objects, and local dimension state in one undoable command while preserving unrelated decks.
- Added automated coverage for pattern derivation, exclusions, serialization, rotation, clearing, and dependent-object cleanup.
