# Deck Boundary Architecture

## Status

Implemented as the first production construction object.

## Design intent

Deck Boundary represents the finished walkable surface of a deck, not a temporary polygon or renderer-owned path. Its ordered corners and edges form the reference frame that later construction objects can connect to.

## Layer boundaries

- `src/core/geometry/` owns reusable spatial math, snapping primitives, and intersection detection.
- `src/core/units/` owns imperial measurement formatting and conversion.
- `src/core/document/` owns the versioned, serializable project envelope.
- `src/tools/deck-boundary/` owns the construction object, its edit operations, and its validation policy.
- `src/history/` owns command history without knowing construction rules.
- `src/ui/` translates pointer and keyboard intent into model operations and renders the result.

This keeps the object independent from a particular interface, rendering library, or future DCR Sales Hub integration.

## Identity and references

Vertices and edges have stable IDs. Moving a corner does not change any IDs. Splitting an edge preserves the original edge ID for the first resulting segment and creates one new edge ID. Removing a corner reconnects the preceding edge while retaining that edge's identity.

Future objects should store references to these IDs. They should not infer attachment solely by comparing coordinates.

## Measurements

Model coordinates use inches. UI presentation uses feet and inches. Keeping a single base unit prevents mixed-unit arithmetic while preserving field-friendly display.

## Validation

The first validation policy requires:

- a closed boundary;
- at least three corners;
- no edge shorter than six inches;
- no self-intersecting edges.

Small areas produce a warning. Validation returns structured diagnostics so future interfaces and estimating services can respond without parsing text.

## Persistence

The project document and Deck Boundary object have separate schema versions. JSON output is structured and portable. The initial workspace saves locally in the browser and supports explicit project export; external project storage can replace that adapter without changing the construction object.
