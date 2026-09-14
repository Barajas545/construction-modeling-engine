# Selectable railing posts and explicit double corners

## Implemented

- Every physical railing post is rendered once and may be selected directly in the drawing.
- Shared endpoints are deduplicated, so Takeoff never adds a post that is not visibly modeled.
- A corner shared by two non-collinear railing runs defaults to one post.
- **Double post corner** creates two visible posts separated by one post width and adds exactly one physical post to Takeoff.
- After either corner post moves inward, CME regenerates equal panel spacing over the remaining usable run. If the shorter run satisfies the 6-foot clear-span rule with fewer sections, the unnecessary intermediate post and its panel materials are removed automatically.
- The corner setting is serialized in the CME project using stable railing endpoint identities and remains undoable.
- Wild Hog post stock continues to use 4×4×10 material with two 5-foot cuts per purchased piece.

## Verification

- Unit tests cover shared-corner deduplication, explicit double corners, marker placement, and Takeoff quantities.
- Browser verification confirmed individual post selection, the Object Options control, a live change from five to six visible posts, and a five-post Takeoff requirement when the option is restored.
