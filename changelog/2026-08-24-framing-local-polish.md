# Local framing tools and Portal handoff

Date: 2026-08-24  
Status: Implemented locally; not deployed

## Changes

- Added Joist Field object controls for moving the complete mesh in real time and placing one parallel joist with a single click inside the owning DB.
- Regular field members are regenerated and clipped to the Deck Boundary during movement; manually added parallel joists preserve their field-relative offset.
- Joist Field edits now recalculate supported bays, commercial stock, warnings, and Takeoff while remaining a single Undo/Redo action.
- Added derived Joist Blocking over Bottom Beams and in supported bays longer than 8 feet, displayed as staggered dashed members in the Joists layer.
- Added selectable blocking-row properties for manual placement/movement/deletion and explicit suppression/restoration of automatic rows.
- Added a distinct Joist Blocking Takeoff line that measures clear cuts and optimizes them into 16-foot stock.
- Corrected Joist Blocking material inheritance to use one dominant Joist Field material; added a field-wide Match/2×6/2×8/2×10/2×12 PT override in blocking object properties.

- Added independent Framing visibility and construction settings.
- Integrated Joist, Beam, Post, and Pillar creation and selection.
- Added live derived beam posts and footings.
- Added Bottom/Flush beam assignment and protected minimum post count.
- Corrected Repeat to select the useful side and clip members to the active Deck Boundary.
- Added concave-polygon clipping behavior.
- Connected modeled framing to editable Takeoff without hidden beam duplication.
- Made both endpoints of a selected Beam draggable with live snap, support regeneration, and one-step undo.
- Replaced the generic Beam label with structured 4×6 PT, 4×8 PT, 4×10 PT, 4×12 PT, and Custom material properties.
- Split each Beam independently into 8, 10, 12, 16, and 20-foot purchase lengths; a 20′ 3″ run now produces 10′ + 12′ Beam stock in Takeoff.
- Separated House Attachment from its structural Ledger attribute while enabling Ledger by default on a newly attached house edge.
- Added Simpson Strong-Tie SDWS Timber Screw 5″ to automatic Takeoff at 5 screws/LF, purchased in 50-piece boxes with required count and spare quantity shown.
- Added Rim Joist / Flush Beam as a structured property of an existing Deck Boundary edge, avoiding duplicate geometry.
- Added 2×6 PT, 2×8 PT, 2×10 PT, 2×12 PT, and Custom rim-member choices plus a Double Joist toggle.
- Connected single and double rim members to commercial-stock Framing Takeoff while preserving their source edge identity.
- Replaced one-line-at-a-time Joist placement with a Ledger/Beam/Rim press-and-drag Joist Field preview clipped to the active Deck Boundary.
- Added aligned continuation from a Beam for supported multi-bay framing and one-step undo for the complete field.
- Planned every joist against 8, 10, 12, 16, and 20-foot commercial stock; unsupported lengths over 20 feet are marked REVIEW rather than silently spliced.
- Set Simpson Strong-Tie ABW Post Base as the default post-to-footing connector in Hardware Takeoff, one per modeled post.
- Changed Joist Field to select its target Deck Boundary first, then accept any visible Boundary, Beam, Joist, or CAT line as a direction reference.
- Extended the O.C. lattice across the complete selected DB instead of stopping at the reference line endpoints; actual Ledger, Beam, and Rim / Flush intersections now divide supported joist bays.
- Deduplicated coincident manual and beam-derived posts.
- Raised Export options above selected-object panels.
- Added a durable CME-to-Portal handoff guide for future Claude integration.

## Validation

- Automated tests pass.
- Production build succeeds.
- Local browser validation confirmed creation, Repeat, layer visibility, selected-object properties, Export access, and framing Takeoff.

## Promotion status

These changes remain in the independent local CME repository. They have not been published to the cloud or merged into DCR Framing Portal.
