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
- **Trim** — removes the touched side of a CAT Line at its nearest valid crossing.
- **Extend** — extends the endpoint nearest the touch to the first valid crossing beyond it.
- **Note** — stores estimator text and optional voice audio behind a numbered draggable label with a fixed arrow point.

## Interaction Rules

- CAT objects remain independent, structured, and serializable.
- CAT Lines and CAT Dimensions use separate visibility layers.
- CAT Lines participate in Edge and Corner snap when their layer is visible.
- Authoritative construction geometry has priority over CAT geometry; CAT geometry has priority over the grid when targets overlap.
- Active line inference supports 90°, 45°, and 22.5° increments.
- Mouse and touch use the same two-point mental model with larger touch tolerances.
- After the first CAT Line point, the live cursor guide shows length, angle, and the active snap relationship.
- While the guide is active, users may type an exact imperial or metric length such as `23in`, `6ft`, or `2m`, then press Enter. The line retains its live direction and uses the entered length.
- Trim and Extend recognize CAT Lines and authoritative Deck Boundary edges as cutting references without converting either object type.
- Moving a CAT Note moves only its label; its arrow point remains at the field location chosen by the user.
- CAT Notes and Measuring Tape objects belong to the CAT Dimensions layer. CAT Lines belong to the CAT construction layer.

## Visual Language

CAT geometry is yellow and dashed so it is recognizable as reference information rather than a Deck Boundary or attached construction object. CAT measurements are intentionally less dominant than regular project dimensions.

## Future Extensions

Rectangle, circle, pencil, conversion from sketch lines, array, and offset remain future CAT CL extensions and are not part of this implementation.
