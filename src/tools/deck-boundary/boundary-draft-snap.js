export const BOUNDARY_DRAFT_SNAP_ID = 'active-boundary-draft';

/**
 * Gives unfinished Deck Boundary corners stable, temporary snap identities.
 * The active corner is identified separately so node inference can use every
 * earlier corner without inferring back to the point the user is drawing from.
 */
export function createBoundaryDraftSnapContext(points = [], anchor = null) {
  const vertices = points.map((point, index) => ({ ...point, id: `${BOUNDARY_DRAFT_SNAP_ID}:node:${index}` }));
  let anchorIndex = points.lastIndexOf(anchor);
  if (anchorIndex < 0 && anchor) {
    for (let index = points.length - 1; index >= 0; index -= 1) {
      if (Math.abs(points[index].x - anchor.x) < 1e-8 && Math.abs(points[index].y - anchor.y) < 1e-8) {
        anchorIndex = index;
        break;
      }
    }
  }
  return {
    object: { id: BOUNDARY_DRAFT_SNAP_ID, type: 'boundary-draft', vertices, edges: [] },
    anchorReferenceId: anchorIndex >= 0 ? vertices[anchorIndex].id : anchor?.id ?? null,
    firstReferenceId: vertices[0]?.id ?? null,
  };
}
