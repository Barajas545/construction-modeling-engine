# ADR 0003: Progressive Construction Model

Date: 2026-08-10

Status: Accepted

## Context

Product Lab Direction Review CME-0102 defines field estimating and detailed construction modeling as stages of one project. A traditional application-mode split would encourage duplicate files, divergent geometry, and repeated work.

## Decision

Store workflow maturity on the versioned project document while keeping construction-object lifecycle and revision on each object. Treat Deck Boundary as authoritative after explicit confirmation, but preserve editability and identity afterward.

Keep transient sketch geometry outside the project document until a valid outline closes. Once created, enrich the same object graph instead of generating workflow-specific copies.

Use a shared interaction model across tablet and desktop, with device-appropriate input adapters.

## Consequences

- One project can support preliminary estimation and later construction detail.
- Interfaces can adapt emphasis by maturity without changing the underlying model.
- Object references remain valid throughout project evolution.
- Future tools need explicit attachment and dependency semantics.
- Concurrent editing, revision review, and stage-gating policy remain future decisions.
