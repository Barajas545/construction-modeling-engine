# ADR 0002: Modeling Interaction Foundation

Date: 2026-08-10

Status: Accepted

## Context

Product Lab Review CME-0101 asks for a modeling experience that approaches professional mechanical sketch systems while remaining approachable to sales personnel. Implementing navigation, snapping, and numeric entry directly inside Deck Boundary would make every later tool repeat or diverge from those behaviors.

## Decision

Create shared, world-space services for viewport navigation, snap resolution, adaptive grid selection, and construction-length parsing. Keep contextual cursor feedback in the interface adapter while all geometric results pass through tool operations.

Use screen-derived snap tolerance, typed snap targets with explicit priority, and inch-normalized numeric input. Treat the camera as workspace state rather than project state.

## Consequences

- Future tools can contribute snap targets without owning the snap resolver.
- Navigation remains independent of document history and serialization.
- Metric and imperial input share one canonical internal unit.
- Sketch relations can evolve from transient inference into persisted constraints without replacing the interaction pipeline.
- Keyboard command routing will need a dedicated service as the command set grows.
