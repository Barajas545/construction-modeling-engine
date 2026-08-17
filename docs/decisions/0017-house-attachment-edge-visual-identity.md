# ADR 0017: House Attachment Edge Visual Identity

Status: Accepted  
Implementation: Completed  
Date: 2026-08-17

## Context

An edge assigned as a House Attachment currently uses the same lime color that CME uses for active selection and interaction feedback. This makes the permanent construction meaning difficult to distinguish from a temporary interface state.

## Decision

Render every Deck Boundary edge assigned as a House Attachment in red instead of lime. Treat red as the semantic visual identity of the House Attachment relationship, not as an error or destructive-action warning.

Preserve the red edge color while the House Attachment edge is selected. Communicate selection through a distinct treatment such as increased stroke weight, a neutral outer halo, or endpoint emphasis rather than replacing the semantic red with lime.

The active House Attachment control in the selected construction edge actions should provide a persistent visual toggle state consistent with the edge. Maintain sufficient contrast against the dark modeling canvas and avoid reusing the exact destructive-button treatment.

## Consequences

- House Attachment edges remain identifiable even when they are not selected.
- Temporary selection feedback no longer competes with construction meaning.
- The red treatment establishes a reusable semantic style for the House Attachment object.
- Selection, warning, error, and destructive-action states must remain visually distinguishable from the House Attachment red.
