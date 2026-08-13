# ADR 0013: Persistent Boundary Locks and Drag Chamfer

Status: Accepted  
Date: 2026-08-12

## Context

Progressive construction modeling requires users to protect verified geometry while continuing to refine nearby work. It also requires common corner operations to feel direct on a tablet without becoming a general CAD command system.

## Decision

Store node locks on the vertex and edge locks in the edge's extensible custom construction properties. Enforce both in Deck Boundary domain operations and in attached Stair placement, then surface their state with anchor marks in the drawing and contextual Lock or Unlock actions.

Implement a 45-degree chamfer as one topology-aware drag gesture available only at orthogonal corners. The pointer controls one equal setback value, a transient boundary previews the result with a live dimension, and release commits one history operation.

## Consequences

- Locked geometry is protected regardless of which interface command attempts the edit.
- Constraints remain structured and serializable for future solvers and dependency graphs.
- The interaction uses the same select, act, drag, and release mental model on tablet and desktop.
- Chamfer creation preserves adjacent edge identities and properties but deliberately replaces the selected node, so attached-node dependencies must block the operation until a shared dependency-remapping service exists.
