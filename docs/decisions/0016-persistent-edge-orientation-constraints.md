# ADR 0016: Persistent Edge Orientation Constraints

Status: Accepted  
Implementation: Completed  
Date: 2026-08-17

## Context

A completed Deck Boundary must remain easy to refine without losing verified construction relationships. The existing full edge lock protects position and length, but it does not provide a way to preserve only the direction of an edge while allowing the boundary to continue evolving.

Users need clear, tablet-friendly controls for horizontal, vertical, and arbitrary fixed-angle relationships. These relationships must remain understandable without requiring a separate constraint-management interface.

## Decision

Add three mutually exclusive orientation controls to the selected construction edge actions:

- **Horizontal** sets the edge to 0 degrees and preserves that orientation.
- **Vertical** sets the edge to 90 degrees and preserves that orientation.
- **Lock angle** captures and preserves the edge's current angle.

An active orientation constraint allows the edge to move parallel to itself and permits its length to change directly or indirectly through edits to connected geometry. It prevents only rotation. Tapping the active orientation control again removes the constraint and returns the edge to a free-angle state.

Keep **Lock edge** as a separate full lock that protects position, length, and angle. While the full edge lock is active, disable the orientation controls until the edge is unlocked.

Treat the orientation controls as a persistent segmented toggle. Use the existing lime accent, a check mark, and an active-state label so the selected constraint remains obvious without hover. Show a short status line such as **Active constraint: Horizontal**. On the canvas, use **H** for horizontal, **V** for vertical, and **⚓∠** for an arbitrary locked angle. A fully locked edge continues to use **⚓**.

Store the constraint as structured, serializable model data rather than temporary interface state. Geometry operations must respect existing locked nodes and edges, preserve edge identities and hosted construction objects, and reject changes that would invalidate the boundary or conflict with stronger constraints.

## Consequences

- Users can protect construction intent without freezing an entire edge.
- Direct and indirect length changes remain possible while orientation stays reliable.
- Persistent button and canvas indicators communicate constraint state on tablet and desktop.
- Horizontal, vertical, and arbitrary angle relationships share one scalable model instead of independent flags.
- Constraint propagation rules project connected node movement and intersect adjacent constrained lines during edge offsets so orientation remains stable through direct and indirect edits.
