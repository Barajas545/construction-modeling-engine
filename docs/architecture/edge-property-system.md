# Edge Property System

## Purpose

Every Deck Boundary segment is a typed construction entity. Geometry defines where the edge exists; properties describe what the edge means and which construction components enrich it.

## Contract

A boundary edge owns:

- a stable ID;
- object type and schema version;
- start and end vertex references;
- construction-property groups;
- attachment references;
- metadata for provenance and generated geometry.

Property groups currently include classification, finishes, safety, existing conditions, attachments, and custom extensions. Grouped properties avoid a growing flat record and allow future tools to own a focused namespace.

## Enrichment

Fascia, picture-frame intent, railing intent, demolition, house relationship, and Stair references enrich the existing edge. They do not create coincident independent linework.

Visual representations are derived from property meaning. For example, picture frame renders as an inset board, fascia as an exterior board, and railing intent as approximately four-inch posts distributed along the edge.

## Geometry editing

Edge operations work against stable edge IDs:

- set exact length by moving the end vertex along the existing direction;
- offset both endpoint vertices perpendicular to the edge;
- apply horizontal or vertical relation intent;
- drag the edge using the same offset operation;
- split or reconnect edges while preserving identity where practical.

Downstream dependency notification is a future requirement. Current revisions identify that the authoritative boundary changed.
