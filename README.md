# Construction Modeling Engine (CME)

The Construction Modeling Engine (CME) is DCR's independent platform for digitally modeling how deck projects are constructed.

## Mission

CME represents construction intent as structured, serializable project data. It is a construction modeling engine—not a general-purpose drawing application—and is designed to support intelligent construction objects for estimating, planning, validation, and future workflows.

## Current phase

CME is in active construction-object development. **Deck Boundary**, the first production construction object, provides a structured walkable-surface model, validation, editing workflow, project persistence, and a professional modeling workspace. CME-0101 adds the shared modeling-interaction foundation: fluid viewport navigation, direct construction dimensions, intelligent snapping, adaptive grids, and contextual cursor feedback. CME-0102 establishes progressive construction modeling: one authoritative project grows from rapid field capture into detailed construction modeling without redrawing or duplicating geometry.

Sprint 2 promotes every boundary segment into a typed construction edge with editable geometry and construction properties. **Stairs**, the first attached construction object, reshape the authoritative boundary and derive their tread graphics from stable model references. Topology-aware vertex editing now supports moving, inserting, removing, splitting, and intelligently merging neighboring corners while retaining construction meaning whenever the resulting boundary remains valid.

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
