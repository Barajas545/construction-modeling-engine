# ADR 0010: Selection-first object actions

Status: Accepted

## Context

The inspector accumulated useful construction controls, but common actions required excessive scrolling—especially on field tablets. Different object types also lacked a consistent place for immediate actions.

## Decision

Render a temporary sticky contextual panel at the top of the right inspector whenever one object is selected. Present only high-frequency, object-safe actions and keep advanced controls in the existing inspector below.

Railing panel adjustments retain both endpoints and clamp to the minimum safe panel count. Railing systems are stored as structured identifiers without introducing pricing prematurely. Boundary division creates two or three equal property-preserving construction edges. Dimensions may be shown or hidden per object reference. Decking visibility becomes an independent project layer.

## Consequences

Tablet and desktop users share the same one-click mental model and reach common actions with less navigation. The panel can expand as future construction objects are added, but each action must preserve model integrity and remain reversible through project history.
