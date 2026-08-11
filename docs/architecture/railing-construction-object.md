# Railing Construction Object

## Purpose

Railing represents a construction run between two explicit snap anchors. It behaves like a direct construction line during creation and becomes a structured project object when released.

## Data contract

A `railing-run` stores a versioned identity, lifecycle, settings, and two anchors. An anchor may reference a boundary vertex, a normalized position on a Deck Boundary or Deck–Stair interface edge, or an exact construction-grid coordinate. Legacy single-edge runs remain readable.

Referenced anchors follow ordinary geometry edits. Splitting, removing, or merging a referenced edge or vertex is protected until the topology service can repartition dependencies without losing construction meaning.

## Derived construction geometry

The engine derives run endpoints, equal section spacing, clear span, and post centers from the current host edge. It uses a 72-inch maximum clear span and a 3.5-inch default post width. The smallest valid section count is selected, then all sections are redistributed equally.

Project analysis deduplicates coincident posts, detects non-collinear two-run corners, and classifies those corners as exterior unless a future classification override says otherwise. Exterior corners add one estimated post to the quantity result.

## Interaction

Railing uses the same tablet and desktop mental model: press an active snap target, drag in any direction, inspect live sections, posts, and target feedback, then release on another active snap target. Edge/corner and grid snaps are independently configurable. The completed result is selectable, dimensioned, serializable, removable, and included in progressive-model maturity.

The Railing layer owns visibility for all railing runs, posts, and intent graphics. Hiding it removes its hit targets as well as its graphics so users can select construction lines underneath without changing model data.

## Deliberate limits

This release does not include material prices, product catalogs, manual post overrides, gates, wall terminations, or an interior/exterior corner editor. Those capabilities can enrich the same object contract later.
