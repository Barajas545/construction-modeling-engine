# DCR Product Lab

# Construction Modeling Engine (CME)

# CAT CL — Construction Reference Tool

Status: Initial implementation approved

---

## Purpose

CAT CL provides temporary construction reference geometry without changing the authoritative Deck Boundary. A user can establish field references first and snap future boundary geometry to them.

## Initial Toolset

- **CAT Line** — two-point yellow dashed construction line.
- **Measuring Tape** — two-point secondary annotation showing horizontal, vertical, and point-to-point distance simultaneously.

## Interaction Rules

- CAT objects remain independent, structured, and serializable.
- CAT Lines and CAT Dimensions use separate visibility layers.
- CAT Lines participate in Edge and Corner snap when their layer is visible.
- Authoritative construction geometry has priority over CAT geometry; CAT geometry has priority over the grid when targets overlap.
- Active line inference supports 90°, 45°, and 22.5° increments.
- Mouse and touch use the same two-point mental model with larger touch tolerances.

## Visual Language

CAT geometry is yellow and dashed so it is recognizable as reference information rather than a Deck Boundary or attached construction object. CAT measurements are intentionally less dominant than regular project dimensions.

## Future Extensions

Notes with leaders, voice notes, trim/extend, rectangle, circle, pencil, conversion from sketch lines, array, and offset remain future CAT CL extensions and are not part of this initial implementation.
