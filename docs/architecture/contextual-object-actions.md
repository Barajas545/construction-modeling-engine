# Contextual Object Actions

## Purpose

The selected construction object should present its highest-frequency safe actions before project progress and detailed inspector content. This reduces scrolling on tablets and keeps the user's attention near the model.

## Behavior

A single selection creates a temporary sticky panel at the top of the inspector. Clearing the selection removes it. The panel adapts to Railing runs, Deck Boundary edges and vertices, Stairs, Deck–Stair interfaces, and Dimensions. Detailed property panels remain available below for less frequent work.

Railing exposes deletion, Decking visibility, system assignment, and panel-count controls. Panel removal cannot reduce the run below its automatically calculated safe minimum. Boundary edges expose individual dimension visibility, common finish intent, and property-preserving division into two or three equal segments. Referenced edges cannot be divided until their dependent construction objects can be migrated safely.

## Layer interaction

Decking is an independent serializable visibility layer. Hiding it suppresses only the walkable-surface fill; authoritative boundary edges, vertices, attached construction objects, and project data remain available.
