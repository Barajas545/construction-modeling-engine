# CAT CL reference system

CAT CL is an isolated tool under `src/tools/cat-cl/`. It creates two serializable object types:

- `cat-construction-line` owns two stable vertices and one reference edge.
- `cat-measurement` owns two field points from which horizontal, vertical, and direct distances are derived.

CAT objects do not enrich or replace Deck Boundary topology. The shared snap engine consumes normalized CAT snap objects and assigns them a lower priority than authoritative construction objects. This permits Boundary to use CAT references while keeping the project model's construction hierarchy explicit.

Visibility is split between the existing CAT construction layer and the CAT dimension layer. Hiding CAT construction lines also removes them from snapping; measurements remain independently visible and do not become authoritative snap geometry.

The shared snap engine accepts a configurable angle increment. CAT CL and Boundary drawing currently use 22.5-degree increments, which naturally include 45 and 90 degrees. Nearby-node inference uses the same angular family when angled inference is enabled.
