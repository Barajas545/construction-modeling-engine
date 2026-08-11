# Railing Construction Object

## Purpose

Railing represents a construction run attached to an authoritative construction edge. It is not an independent polyline and does not duplicate its host geometry.

## Data contract

A `railing-run` stores a versioned identity, lifecycle, settings, host reference, and normalized `startT` and `endT` anchors. Eligible hosts in the first release are Deck Boundary edges and Deck–Stair interface edges. The host edge records the attached railing IDs in its property system.

Normalized anchors allow the run to follow length, offset, and vertex-position changes to its host. Splitting, removing, or merging a hosted edge is protected until the topology service can repartition references without losing construction meaning.

## Derived construction geometry

The engine derives run endpoints, equal section spacing, clear span, and post centers from the current host edge. It uses a 72-inch maximum clear span and a 3.5-inch default post width. The smallest valid section count is selected, then all sections are redistributed equally.

Project analysis deduplicates coincident posts, detects non-collinear two-run corners, and classifies those corners as exterior unless a future classification override says otherwise. Exterior corners add one estimated post to the quantity result.

## Interaction

Railing uses the same tablet and desktop mental model: press an eligible construction edge, drag along it, inspect live sections and posts, and release to create the object. The completed result is selectable, dimensioned, serializable, removable, and included in progressive-model maturity.

## Deliberate limits

This release does not include material prices, product catalogs, manual post overrides, gates, wall terminations, or an interior/exterior corner editor. Those capabilities can enrich the same object contract later.
