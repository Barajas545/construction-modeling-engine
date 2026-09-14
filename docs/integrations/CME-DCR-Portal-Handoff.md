# CME → DCR Framing Portal Handoff Note

Status: Active engineering handoff  
Owner: DCR Product Lab / CME Engineering  
Last updated: 2026-09-01  
Independent CME baseline: `ce9b5af` plus the complete local working folder and uncommitted iterations described below

## Purpose

### Latest local delta — 2026-09-01 Boundary area controls and CAT arc dimensions

Port `src/tools/boundary-visibility/boundary-visibility.js`, its tests, and the related UI bindings as one behavior. CAT Boundary area annotations now use a leader connected to their derived region and allow independent label/arrow repositioning like Deck Boundary area annotations. Both Deck Boundary and CAT Boundary area properties expose **Hide this boundary** and **Show all boundaries**. Hidden state is serializable and must never delete or modify construction geometry. A hidden boundary retains an accessible area annotation so it can be restored. Selected CAT arcs now render CAT-colored radius (R), chord-midpoint height (H), and midpoint nodes. See `changelog/2026-09-01-boundary-area-controls-and-cat-arc-dimensions.md`.

### Latest local delta — 2026-09-01 Curved Deck Boarding Direction

Board Direction can now reference a curved Deck Boundary edge. Preserve the serializable curved-pattern contract, including referenced arc identity, center, radius, sweep, board width, and gap. The renderer derives concentric curved seams, clips them to the true curved Deck Boundary, and continues to exclude hosted Stair footprints. Editing the source arc updates the pattern. **Rotate 90°** remains unavailable for curved patterns. This is a preliminary estimating and fabrication-planning aid, not approval of a composite heat-bending method. See `changelog/2026-09-01-curved-deck-boarding.md` and `src/tools/deck-boarding/README.md`.

### Latest local delta — 2026-09-01 CAT arcs, Offset, Extend/Trim, and CAT Boundaries

Port the CAT geometry rules, serialization, rendering, and interaction state together. Straight CAT Lines can be converted to circular arcs. Offset provides live distance feedback, typed dimensions, retained **Repeat Offset**, joined offsets for adjacent straight lines, and concentric offsets for arcs. Trim and the two-stage Extend workflow support straight lines and arcs; Extend changes only the first selected object and follows an arc's original circumference. Closed CAT loops derive a selectable orange 25%-opacity CAT Boundary with an area annotation, and explicit conversion to Deck Boundary preserves curved segments. Do not store the derived CAT Boundary as duplicate authoritative geometry. See `changelog/2026-09-01-cat-arcs-offset-boundaries.md`.

### Latest local delta — 2026-08-31 Boundary Arch line

See `changelog/2026-08-31-boundary-arch-line.md` and `src/tools/arch-line/README.md`. Port the arc math/tool, boundary guards, snap targets, Rim Joist/Takeoff logic and UI together. Arcs persist as endpoint+sagitta metadata with grouped polygon samples for legacy calculation consumers. Do not discard `archLineId` fields or treat generated samples as independently editable corners. Radius and arc length are analytical; area/clipping use <=1/64-inch chord-error sampling. The UI exposes R/H only. Curved Rim Joist inherits the owning DB's dominant Joist Field profile and is purchased once from analytical arc length; curved Picture frame creates a separate heat-bent composite line. Both require fabrication review. Ledger, railing and stair hosting stay straight-only. Local-only change.

### Latest local delta — 2026-08-31 pictureframe stair framing

Transfer `src/tools/stair-framing/stair-framing.js`, `stair-framing-geometry.js`, their tests, and the corresponding `src/ui/app.js`, `src/ui/styles.css`, and `src/tools/takeoff/takeoff.js` changes together. Pictureframe uses fixed support axes at 6.5 inches from both edges, then subdivides remaining bays at <=12 inches; do not re-space these axes uniformly in the renderer. It adds full-width 2×8 PT lower-riser closure and 2×4 PT bottom tie stock rows. Square cut remains unchanged. Framing visibility controls the overlay; no extra model objects are created. The plate is takeoff-only in plan because it lies below the stringers. See `changelog/2026-08-31-stair-covering-types.md` for IDs, purchasing, review behavior and scope. These are DCR estimating recipes, not structural/anchorage approval. Still local, not promoted to DCR Portal.

This document is the durable handoff for Claude or any engineer who later promotes work from the independent Construction Modeling Engine into DCR Framing Portal.

Do not use conversation history as the source of truth. Before integrating, compare the Portal implementation against this document, the current CME source, and the automated tests.

## Delivery package for Claude

Product Lab will provide:

1. The complete `construction-modeling-engine` folder, including uncommitted files.
2. This handoff document.
3. The current DCR Framing Portal repository as the integration destination.

The folder contents are more current than commit `ce9b5af`; do not reset, checkout, or replace the working tree before reviewing it. Run `npm test` and `npm run build` from the delivered CME folder first. Treat the passing local behavior and tests as the source baseline, then port modules by data contract rather than copying the complete CME interface into the Portal.

Validation at the previous handoff: 322 automated tests passing, production build passing, and the local application loading without browser console errors on 2026-08-25. Re-run `npm test` and `npm run build` against the delivered 2026-09-01 folder; the current source and tests supersede this historical count.

## Repository boundary

- CME remains the development source for construction-modeling behavior.
- DCR Framing Portal is the integration target, not the place where CME domain rules are invented.
- Do not copy Portal routes, global styles, authentication state, storage keys, or page-specific globals back into CME.
- Promote isolated modules from `src/tools/` and shared services from `src/core/`.
- Keep project objects and calculation results structured, serializable, and independent from the host page.

## Portal version reviewed

The public DCR Portal implementation at `barajas545/dcr-portal`, Sales Estimates → Deck → New Drawing, was reviewed on 2026-08-24.

That version already contained an initial framing implementation with Joist, Beam, Post, Pillar, on-centre spacing, Repeat, beam systems, derived posts/footings, and preliminary framing takeoff.

The local CME iteration is not a wholesale copy of that page. Portal-specific application state and integrations were intentionally excluded.

## Local CME changes after the Portal version

### Framing construction layer

- Added a serializable `framing-layer` with independent visibility.
- Centralized editable defaults for joist spacing, maximum beam-post spacing, footing size, concrete allowance, post stock/cut length, and default framing system.
- Added a high-frequency Framing visibility toggle and a Visibility-panel entry.

### Construction objects

- Joist, Beam, Post, and Pillar are independent selectable project objects.
- Linear framing members use CME's existing endpoint, edge, grid, CAT CL, and node-inference snap mental model.
- A selected Beam exposes two draggable endpoints. Editing either endpoint regenerates its length, derived supports, and Takeoff in real time while preserving Beam identity.
- Beam material is structured and serializable: 4×6 PT by default, with 4×8 PT, 4×10 PT, 4×12 PT, and Custom choices.
- House Attachment and Ledger are separate serializable edge properties. House Attachment enables Ledger by default, while an explicit `attachments.ledger: false` preserves a non-ledger house relationship.
- Ledger Takeoff uses the DCR preliminary recipe of five Simpson Strong-Tie SDWS Timber Screw 5″ fasteners per LF. Screws are purchased as 50-piece boxes with upward rounding and spare count reported.
- Rim Joist / Flush Beam is a serializable property on the authoritative Deck Boundary edge, not a second overlapping line. It defaults to one 2×6 PT member and supports 2×8 PT, 2×10 PT, 2×12 PT, Custom, and Double Joist.
- Rim-member Takeoff plans commercial stock independently for each source edge and doubles every required piece when Double Joist is active.
- Joist placement now selects its target Deck Boundary first, then accepts any visible Boundary, Beam, Joist, or CAT line as a direction reference. The reference controls orientation and pattern origin only; structural support remains derived from Ledger, Beam, and Rim / Flush intersections.
- A Joist Field always belongs to and is clipped by the Deck Boundary explicitly selected by the user. It never spills into, transfers to, or changes ownership to an adjacent DB.
- Rim / Flush edges are physical supports rather than private drawing aids. A Rim / Flush owned by a neighboring DB is clipped against the selected DB and may support joists from either side when it crosses or coincides with that deck surface. This includes Double Joist edges. The structural edge and Takeoff material remain single objects; CME does not duplicate the member for each DB.
- The O.C. lattice spans the complete selected DB, including geometry beyond a short Ledger endpoint. Each joist axis is split into supported bays, while unsupported intervals remain preview-only and red.
- A field begun on a Beam aligns to a nearby existing joist endpoint. The complete field is one undoable change and each established joist preserves its field and host references.
- Joist Takeoff selects the shortest available 8, 10, 12, 16, or 20-foot board per member. Joists over 20 feet remain explicit REVIEW items; CME never invents an unsupported end-to-end splice.
- Selecting any joist in an established field exposes Move mesh and Single joist. Move mesh regenerates the complete field phase inside its owning DB while retaining structural bay validation and recalculating Takeoff in real time. Single joist creates one boundary-clipped, supported parallel member and stores it as `manualParallel` plus `lockedToMesh`; it follows later field movement instead of becoming detached geometry.
- Joist Blocking is derived per field. Automatic staggered rows occur over Bottom Beams and within supported bays so the maximum unblocked distance does not exceed 8 feet. Manual rows and automatic-row suppression are stored in one `joist-blocking-layout` object per field; the individual blocking pieces are never loose project lines. Blocking shares Joists visibility and packs clear-length cuts into 16-foot stock in Framing Takeoff.
- Blocking material is field-level. It defaults to the dominant regular Joist Field material and supports one explicit field-wide override, preventing an isolated or stale joist size from splitting Blocking Takeoff into misleading material lines.
- Hardware Takeoff uses Simpson Strong-Tie ABW Post Base as the DCR default post-to-footing connector, one per modeled post. The exact catalog model/size remains preliminary until matched to the post and project conditions.
- The Framing toolbar now exposes only Joist, Beam, and Post / Footing plus Done. Pillar and the obsolete toolbar-level Repeat/O.C. controls were removed; field spacing is edited from Joist Field properties.
- A manually placed Post / Footing is one serializable assembly. Its footing is drawn beneath the post and its default 16-inch footing, Simpson ABW Post Base, and three-bag concrete allowance flow to Takeoff. It may be snapped beneath a Beam or Rim / Flush as an estimator-added support. Legacy Pillar objects remain loadable and visible but cannot be newly placed from the toolbar.
- The estimator assigns size labels; CME does not silently select a structural member size from span.
- Beam supports are derived from the beam rather than saved as loose child geometry.
- Each beam may use Bottom Beam or Flush Beam.
- A user may add beam posts but cannot reduce the count below the configured maximum-span rule.

### Joist and beam reference rules

- Joist Field profile and spacing are field-wide properties, never single-member material overrides.
- Standard O.C. choices are 12″, 16″, and 24″ plus a custom 1″–48″ value.
- Profiles are 2×6, 2×8, 2×10, or 2×12 PT with Douglas Fir-Larch or Redwood span groups.
- The preliminary joist validation reference follows 2025 CRC / 2024 IRC R507.6 for No. 2 wet-service lumber at 40 psf live plus 10 psf dead load. It validates each supported bay and does not approve local amendments or unusual loads.
- Beam profiles include solid 4×6, 4×8, 4×10, and 4×12 PT plus (2) and (3) ply 2×6, 2×8, 2×10, and 2×12 PT.
- Built-up Beam post spacing follows the 2025 CRC R507.5(1) table using the Joist Field tributary span. Solid 4× members use the equivalent double-2× row only as a preliminary layout aid and retain `Engineering review`.
- Changing the Joist Field profile synchronizes active Rim / Flush edges in the same DB while preserving single/double ply configuration.

### Stair framing

- Stair geometry now produces framing Takeoff in addition to the existing tread/riser covering quantities.
- Every staircase receives two side stringers plus enough internal 2×12 PT stringers to remain at or below 12″ O.C.
- One measured 2×12 PT top ledger/header is included at the deck interface.
- Stringer length uses the true slope from total run and total rise, then selects the shortest continuous 8, 10, 12, 16, or 20-foot stock member.
- Stringers over 20 feet remain explicit REVIEW lines; CME never implies a stringer splice.
- Selected Stair properties show stringer count, internal count, actual spacing, sloped length, stock length, and header stock.
- Detailed Takeoff keeps Stair Stringer and Stair Ledger/Header roles; Consolidated Purchasing may combine identical 2×12 PT stock with other framing lumber.
- Stair placement no longer rewrites Deck Boundary topology. Each Stair owns its footprint and references one host edge; a coincident shared edge resolves to the higher DB. Legacy stair cuts migrate to this hosted representation on project load.

### Repeat correction

- Repeat supports 12″, 16″, 19.2″, and 24″ on-centre spacing.
- Repeat evaluates both perpendicular sides and selects the side that produces the most usable framing inside the active Deck Boundary.
- Every copy is clipped to the active deck polygon.
- Concave polygons may split a repeated linear member into multiple valid interior pieces.
- The complete repeat operation remains one undoable document change.

This corrects the Portal behavior where repeated joists could continue into open space outside the deck.

### Framing Takeoff correction

- Only framing objects represented in the model are counted.
- Deck area does not silently invent joists.
- One drawn beam produces one beam material line; no second hidden standard beam is added.
- Derived beam posts and coincident explicit posts are deduplicated by location.
- Post stock quantity uses configurable cut yield.
- Derived post locations drive both plan graphics and Takeoff.
- Joist hangers, post bases, concrete bags, beams, joists, posts, and pillars remain editable Takeoff lines through the existing override system.

Each Beam is now independently planned into 8, 10, 12, 16, and 20-foot purchase lengths. The planner minimizes total purchased length, then piece count, then unbalanced cuts; a 20′ 3″ Beam therefore exports as one 10′ plus one 12′ Beam. This also corrects the risk of the Portal producing both a generic Beam line and an additional automatically planned material for the same modeled object.

### Interface correction

- Export options now render above the selected-object properties panel.
- Takeoff and PDF remain accessible without clearing a Beam, Joist, Post, or other selected construction object.

## Files to compare during promotion

Domain and rules:

- `src/core/annotations/framing-layer.js`
- `src/core/standards/dcr-construction-standard.js`
- `src/tools/beam/beam.js`
- `src/tools/beam/beam-geometry.js`
- `src/tools/joist-group/joist-group.js`
- `src/tools/joist-blocking/joist-blocking.js`
- `src/tools/ledger/ledger.js`
- `src/tools/post-footing/post-footing.js`
- `src/tools/rim-joist/rim-joist.js`
- `src/tools/stair-framing/stair-framing.js`
- `src/tools/framing-standard/framing-standard.js`
- `src/tools/takeoff/takeoff.js`

Interface integration:

- Framing-related imports, state, rendering, pointer handling, object properties, visibility, and actions in `src/ui/app.js`
- Framing graphics and top-bar stacking rules in `src/ui/styles.css`

Recent curved/CAT integration:

- `src/tools/deck-boarding/`
- `src/tools/boundary-visibility/boundary-visibility.js`
- CAT geometry, offset, region, and conversion modules under `src/tools/`
- Related interaction, rendering, properties, and persistence bindings in `src/ui/app.js`
- `changelog/2026-09-01-cat-arcs-offset-boundaries.md`
- `changelog/2026-09-01-curved-deck-boarding.md`
- `changelog/2026-09-01-boundary-area-controls-and-cat-arc-dimensions.md`

Tests:

- Every framing-adjacent `*.test.mjs` file under the paths above
- `src/tools/takeoff/framing-takeoff.test.mjs`
- `tests/takeoff.test.js`

## Promotion procedure for Claude

1. Pull or receive the exact independent CME revision being promoted.
2. Read this handoff and `AGENTS.md` before changing either application.
3. Compare modules by behavior and data contract, not by copying the complete CME `app.js`.
4. Port domain modules first, then adapt Portal UI bindings separately.
5. Preserve the Portal's host integration only at an explicit adapter boundary.
6. Run all CME tests before and after the port.
7. Add Portal integration tests for save/load, Step 1 export, Takeoff, and framing visibility.
8. Verify Repeat on rectangular, rotated, and concave Deck Boundaries.
9. Verify a beam appears once in Takeoff and coincident posts are not counted twice.
10. Verify Export options remain clickable while an object-properties panel is open.
11. Verify two adjacent Deck Boundaries can reference one shared Rim / Flush without duplicating the member or its Takeoff.
12. Verify stair width, total rise, and total run regenerate 2×12 PT stringer/header quantities.
13. Record the CME source commit and Portal destination commit in the Promotion Log below.

## Promotion acceptance checklist

- [ ] Joist, Beam, Post, and Pillar round-trip through project serialization.
- [ ] Framing visibility changes presentation without deleting objects or quantities.
- [ ] Framing endpoints snap consistently with Boundary and CAT CL.
- [ ] Repeat creates no geometry outside the selected deck surface.
- [ ] Repeat on a concave deck keeps only valid interior segments.
- [ ] Every Joist Field remains clipped to and owned by its selected Deck Boundary.
- [ ] A neighboring Rim / Flush crossing the selected DB closes supported joist runs from either side.
- [ ] A shared Double Rim / Flush remains one modeled member and one material source.
- [ ] Beam support count never falls below the configured limit.
- [ ] Moving a beam regenerates its derived posts and footings.
- [ ] Manual Post / Footing placement draws the footing and adds post, ABW base, and concrete quantities once.
- [ ] Takeoff contains no duplicate beam line.
- [ ] Manual and derived coincident posts are deduplicated.
- [ ] Quantity and price overrides remain editable.
- [ ] Stair framing produces two side stringers, internal stringers at 12″ maximum, and one top ledger/header.
- [ ] Over-20-foot stair stringers remain REVIEW items rather than implied splices.
- [ ] Export menu is not obscured by object properties.
- [ ] No CME source module depends on Portal routes, globals, or global CSS.
- [ ] CME and Portal automated suites pass.
- [ ] Curved Board Direction survives save/load and follows edits to its referenced Deck Boundary arc.
- [ ] CAT arc Offset, Trim, and Extend preserve circular geometry and serialize correctly.
- [ ] Closed CAT loops derive one selectable CAT Boundary and conversion preserves curved segments.
- [ ] Hiding a Deck or CAT Boundary does not remove its geometry, area, or Takeoff contribution.

## Items intentionally not promoted automatically

- No deployment or cloud publication is implied by local completion.
- CME validates the estimator-selected Joist/Beam profile against preliminary span references; it does not silently choose or approve a structural size.
- No building-code approval is implied by preliminary construction rules.
- No Portal authentication or storage implementation belongs in the independent CME modules.
- No future experimental tool should be included unless it is listed in a later dated handoff entry.

## Takeoff export modes

The independent CME exports `com.dcr.cme.takeoff` with an explicit `mode`. `detailed` preserves the construction purpose of Ledger, Joist, Joist Blocking, Rim / Flush, and Beam lines. `consolidated` groups identical purchasable material and stock across those purposes for supplier quotes and purchasing. Portal integrations must keep consolidation as a derived export view; the authoritative construction model and detailed Takeoff remain intact.

Structural Ledger lumber is now generated by `src/tools/ledger/ledger.js`, while Ledger fasteners remain a separate Hardware recipe. The local default follows the dominant Joist Field size in the owning Deck Boundary, with 2×6 PT as the pre-layout fallback.

Joist Field material and O.C. spacing are now field-wide editing operations. Portal integration must use `updateJoistField` and `removeJoistField` rather than applying a profile override to one selected joist. Standard spacing controls are 12″, 16″, and 24″ O.C.; custom spacing is stored in inches and regenerates the complete supported field, its derived Blocking, validation, and Takeoff.

`updateJoistField` also synchronizes active Rim / Flush edge profiles in the owning Deck Boundary and preserves their single/double ply count. The Joists sublayer controls their structural presentation only; when hidden, those model edges must still render and remain selectable as ordinary Deck Boundary geometry.

## Future-change protocol

### Local delta: 2026-08-31 stair covering

Visualization follow-up: port `src/tools/stairs/stair-boarding.js` with the `renderStairShape` binding and `.stair-boarding-line` styles. Seams are derived display geometry only, starting 5.5 inches behind each nosing. Preserve Decking visibility, pointer-event exclusion and rendering below tread/selection outlines. Do not convert these seams to model edges or Takeoff items.

Riser fascia follow-up: net LF is width times riser count only. The same covering module now exports `planStairRiserFasciaStock`, using 12/16 ft stock and cutting reserve; 4 risers at 3 ft purchase one 16 ft fascia board while retaining 12 LF net. Import the length-specific riser Takeoff IDs and preserve side fascia as an independent calculation. See the follow-up section in the dated changelog for legacy override handling and cut-packing limitations.

Read `changelog/2026-08-31-stair-covering-types.md` and port the isolated `src/tools/stairs/stair-covering.js` rules plus `stair-covering-controls.js` and the UI/Takeoff bindings. Stair finish is an additive, serializable setting; missing style uses Pictureframe. Preserve saved depths while adopting the new 11-inch creation default and landing preference. Replace the three legacy covering rows with square-shoulder treads and two fascia rows; do not silently reuse legacy prices for changed materials. Source tests and this dated delta supersede the older PDF handoff snapshot. This local iteration is not yet promoted to DCR Portal.

For every substantial local iteration:

1. Add a dated entry under `changelog/`.
2. Update the “Local CME changes” or append a dated delta to this document.
3. Identify changed data schemas and migration requirements.
4. Add or update automated tests.
5. Do not mark the change “Promoted” until the destination Portal commit is recorded and acceptance checks pass.

## Promotion Log

| Date | CME source commit | Portal destination commit | Scope | Result |
| --- | --- | --- | --- | --- |
| Pending | `ce9b5af` + delivered working folder | — | Framing layer, CRC references, Joist Field controls, shared cross-DB Rim/Flush support, Blocking, Ledger, consolidated purchasing, stair framing | Local validation complete; not promoted |
