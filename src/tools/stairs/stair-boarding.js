import { getStairVertexMap } from './stair.js';
import { getStairCoveringStyle, STAIR_BOARD_WIDTH_INCHES } from './stair-covering.js';

// Derived display seams only: no model edges, snap targets, or material rows.
// Across = openingStart -> openingEnd; outward = upper deck -> lower landing.
// Each tread's nosing is its outward edge, so the first board is measured back
// from there, never forward from the riser (important for non-11-inch treads).
export function deriveStairBoardingSeams(boundary, stair) {
  if (!stair?.anchors) return [];
  const points = getStairVertexMap(boundary, stair);
  const origin = points.get(stair.anchors.openingStartVertexId);
  const outer = points.get(stair.anchors.outerStartVertexId);
  const across = points.get(stair.anchors.openingEndVertexId);
  const farCorner = points.get(stair.anchors.outerEndVertexId);
  if (![origin, outer, across, farCorner].every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))) return [];
  const width = Math.hypot(across.x - origin.x, across.y - origin.y);
  const run = Math.hypot(outer.x - origin.x, outer.y - origin.y);
  const treadCount = Number(stair.dimensions?.treadCount ?? ((stair.dimensions?.riserCount ?? stair.dimensions?.stepCount) - 1));
  if (width <= 1e-8 || run <= 1e-8 || !Number.isInteger(treadCount) || treadCount <= 0) return [];
  const u = { x: (across.x - origin.x) / width, y: (across.y - origin.y) / width };
  const v = { x: (outer.x - origin.x) / run, y: (outer.y - origin.y) / run };
  const at = (x, y) => ({ x: origin.x + u.x * x + v.x * y, y: origin.y + u.y * x + v.y * y });
  const depth = run / treadCount;
  const boardWidth = Math.min(STAIR_BOARD_WIDTH_INCHES, depth, width / 2);
  if (boardWidth >= depth - 1e-8) return [];
  const pictureFrame = getStairCoveringStyle(stair) === 'picture-frame';
  const seams = [];
  const add = (treadIndex, role, x1, y1, x2, y2) => {
    if (Math.hypot(x2 - x1, y2 - y1) < 1e-8) return;
    seams.push({ treadIndex, role, start: at(x1, y1), end: at(x2, y2) });
  };
  for (let i = 0; i < treadCount; i += 1) {
    const riser = i * depth;
    const nosing = (i + 1) * depth;
    const joint = nosing - boardWidth;
    if (!pictureFrame) {
      add(i, 'board-joint', 0, joint, width, joint);
      continue;
    }
    add(i, 'board-joint', boardWidth, joint, width - boardWidth, joint);
    add(i, 'left-return', boardWidth, riser, boardWidth, joint);
    add(i, 'right-return', width - boardWidth, riser, width - boardWidth, joint);
    add(i, 'left-miter', 0, nosing, boardWidth, joint);
    add(i, 'right-miter', width, nosing, width - boardWidth, joint);
  }
  return seams;
}
