# Construction Modeling Engine (CME)

The Construction Modeling Engine (CME) is DCR's independent platform for digitally modeling how deck projects are constructed.

## Mission

CME represents construction intent as structured, serializable project data. It is a construction modeling engine—not a general-purpose drawing application—and is designed to support intelligent construction objects for estimating, planning, validation, and future workflows.

## Current phase

CME is in active construction-object development. **Deck Boundary**, the first production construction object, provides a structured walkable-surface model, validation, editing workflow, project persistence, and a professional modeling workspace. CME-0101 adds the shared modeling-interaction foundation: fluid viewport navigation, direct construction dimensions, intelligent snapping, adaptive grids, and contextual cursor feedback. CME-0102 establishes progressive construction modeling: one authoritative project grows from rapid field capture into detailed construction modeling without redrawing or duplicating geometry.

Sprint 2 promotes every boundary segment into a typed construction edge with editable geometry and construction properties. **Stairs**, the first attached construction object, use a tablet-first press-and-drag workflow where total rise is primary and CME derives equal risers from 5 to 7.5 inches plus equal treads from 10 to 11 inches. The Deck–Stair interface is a selectable construction edge that can own Fascia, Picture Frame, and future metadata. Plan graphics use the lower edge and deck interface as the first and final riser locations, drawing only the interior lines required to produce the reported tread count. A serializable Dimensions layer lets users hide annotations, drag labels away from construction, and open linked exact editing by double-clicking. Topology-aware vertex editing supports moving, inserting, removing, splitting, and intelligently merging neighboring corners while retaining construction meaning whenever the resulting boundary remains valid.

Stair placement now snaps each opening side to an adjacent boundary node within six inches. Completed stairs own a centered, selectable `STAIRS n` annotation, editable rise/riser/tread properties, and lateral-line handles that change width without allowing free stair-node deformation. The host angle remains protected by the relationship. **Delete stairs** restores the boundary instead of leaving temporary geometry. Every visible dimension also has an object-attached leader and arrowhead. Labels and arrow tips have independent serializable positions: **Reposition arrow** makes the tip pulse, then one touch or drag anywhere moves it while preserving the dimension's semantic object relationship.

Boundary edges and corners can now be locked as persistent construction constraints. A locked edge protects both its position and length from direct dragging, exact editing, splitting, constraints, and attached stair placement; a locked corner cannot move, merge, delete, or be replaced. Anchor marks appear inside locked edge dimensions and beside locked nodes so constraint state remains visible on the drawing. Independent **Horizontal**, **Vertical**, and **Lock angle** toggles preserve only orientation, allowing the edge to move parallel and change length directly or through connected geometry. Their structured state, persistent button highlights, and H, V, or ⚓∠ dimension marks keep the active relationship visible on tablet and desktop.

Selected orthogonal corners support a tablet-friendly **45° Chamfer** gesture. During the drag, the original corner becomes a temporary virtual node, two dashed construction legs display equal live setbacks, and a separate dimension reports the finished diagonal length. Releasing removes the temporary references and leaves the new diagonal as an ordinary selectable construction edge with its normal dimension.

Projects may now contain multiple independent **Deck Boundaries**. Every polygon owns a selectable local area annotation and a down-level value, while CME reports the project surface as the sum of all Deck Boundary areas for future estimating. Lower decks receive progressively darker shading. **Move deck area** translates the selected polygon as one construction assembly, preserving hosted stairs, railing references, Level Down geometry, and dimension relationships. While placing stairs, CME searches for a valid landing inside a lower Deck Boundary surface rather than targeting one of its edges. On a coincident shared edge, hit testing automatically resolves the higher deck as the Stair host before searching the lower surface. The resulting Stair stores both deck identities, derives exact rise from their level difference, and regenerates while valid. If no construction-valid landing remains, the stair stays visible in red with an explicit review reason and a direct deletion action.

**Railing** uses a professional snap-to-snap line workflow. A user can begin at a construction edge, corner, or grid point and drag freely across the interior or exterior of the Deck Boundary to another active snap target while equal sections and posts appear in real time. Edge and grid snaps are independently configurable, and the complete Railing model layer can be hidden to expose construction geometry underneath. Runs use a maximum 6-foot clear span between 3.5-inch posts, share visible posts where they meet, and remain structured construction objects rather than sketch lines. This phase produces geometry and serializable quantities only; pricing remains intentionally outside the object.

Single-click selection opens a temporary sticky object-actions panel at the top of the inspector. Railing actions include deletion, Decking visibility, safe panel-count adjustment, and a structured Wild Hog or Trex system assignment ready for future costing. Construction-edge actions include individual dimension visibility, Fascia and Picture Frame intent, and equal division into two or three property-preserving segments. Corners, dimensions, stairs, and stair interfaces expose their most useful safe actions through the same pattern.

Deck Boundary now presents its computed surface area as a centered, selectable Dimension annotation. The annotation can be dragged, hidden independently, or used as the entry point for whole-boundary operations such as aligning near-orthogonal edges to horizontal and vertical construction planes. House Attachment is available directly in the selected-edge quick actions and remains an edge-owned construction relationship. Assigned House Attachment edges use a persistent construction red, including while selected; a neutral highlight communicates selection without replacing their semantic color.

**Level Down** introduces an independent, serializable construction polyline for changes in deck elevation. A run begins and ends on Deck Boundary geometry, may contain intermediate snapped points, and owns one shared riser height (7.5 inches by default). Any selected section can be divided into two or three equal sections without changing the owning Level Down or its riser. Multiple Level Down objects can coexist, and their operations intentionally do not regenerate or move Railing posts.

Each Level Down now closes a selectable lowered region against the Deck Boundary, whether the polyline lies inside or outside the main footprint. Lower regions receive progressively darker shading based on their accumulated drop from the main deck. Their Dimensions-layer annotation shows only a down arrow and inches; it can be dragged freely and gains a live leader arrow back to its owning region. Selecting that annotation exposes 90-degree cleanup, side flipping, Picture Frame, Fascia, exact step drop, visibility, and deletion actions. Nested regions accumulate their step drops while Railing remains independent.

## Run the workspace

Use `npm start`, then open `http://localhost:4173`. The workspace stores the active project locally in the browser and can export a portable `.cme.json` project file.

## Repository philosophy

- Model construction concepts explicitly rather than encoding them in UI behavior.
- Keep project data and calculation results structured and serializable.
- Place shared domain services in `src/core/`.
- Build each intelligent construction object as an isolated module in `src/tools/`.
- Keep rendering, interface, commands, and history separate from domain logic.
- Validate every tool against the official projects in `examples/`.
- Record durable engineering decisions in `docs/`.
- Treat Product Lab specifications in `specs/` as authoritative and read-only unless a change is explicitly requested.
- Promote experiments from `playground/` only through intentional review.

## Relationship with DCR Sales Hub

CME is developed as a completely independent application. It may eventually replace Step 1 (Sketch) in DCR Sales Hub, but it must not depend at runtime on Sales Hub routes, global styles, project state, or internal services. Integration will be designed later through explicit, versioned boundaries.

The `railing-prototype` project is reference material only and is never modified from this repository.

## Development workflow

1. Start from an approved Product Lab specification.
2. Clarify the construction object, its data contract, invariants, and validation scenarios.
3. Record important architectural choices in `docs/decisions/`.
4. Implement shared capabilities in `src/core/` and object-specific behavior in one `src/tools/` module.
5. Add automated tests in `tests/` or beside the source module.
6. Validate behavior with the relevant official projects in `examples/`.
7. Update technical documentation and the changelog before review.

## Tool approval workflow

A construction tool enters production only after:

1. Product Lab defines or approves its specification.
2. Engineering documents its model, boundaries, and construction rules.
3. Automated tests cover its data and behavior.
4. The official example projects validate expected scenarios.
5. Product and engineering review approve promotion from experimental to production code.

Unapproved ideas remain isolated in `playground/`.

## High-level roadmap

1. Establish the repository and architectural foundation. *(Complete)*
2. Define and implement Deck Boundary. *(Initial production version complete)*
3. Validate and refine Deck Boundary with Product Lab examples.
4. Add the next approved intelligent construction object listed in `src/tools/`.
5. Expand geometry, validation, serialization, rendering, command, and history services.
6. Validate increasingly complex deck projects through the official example suite.
7. Define a stable integration boundary for future use by DCR Sales Hub.

## Repository map

- `src/` — production source and public entry point
- `specs/` — Product Lab-owned specifications
- `docs/` — engineering documentation and decisions
- `examples/` — official validation projects
- `assets/` — engine-owned visual resources
- `tests/` — cross-module automated tests
- `playground/` — experiments not approved for production
- `changelog/` — release and milestone history
