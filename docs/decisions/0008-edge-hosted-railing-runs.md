# ADR 0008: Edge-hosted railing runs

Status: Accepted

## Context

Railing existed as a separate prototype with useful spacing calculations, but CME requires construction objects to enrich the authoritative project model instead of maintaining disconnected drawing geometry.

## Decision

Railing runs reference an eligible construction edge and store normalized extents along that edge. The first release accepts Deck Boundary and Deck–Stair interface edges. Layout uses equal sections with no more than 72 inches clear between 3.5-inch post faces. Connected runs share visible endpoint posts, and non-collinear corners default to exterior. Only geometry and quantities are produced; prototype pricing data is not imported.

The standalone prototype remains read-only reference material. CME owns a new isolated implementation under `src/tools/railing/` and renders it through the existing SVG, document, history, property, and Dimensions systems.

## Consequences

Host geometry edits automatically regenerate railing geometry without rewriting the railing object. Construction edges can discover attached runs through serializable property metadata. Operations that would destroy or divide a hosted edge are protected until topology-aware dependency repartitioning is available. Future work can add corner classification, manual posts, terminations, catalogs, and takeoff without replacing the core object.
