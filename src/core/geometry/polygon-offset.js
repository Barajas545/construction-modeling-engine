import { findSelfIntersections } from './vector.js';

// Offsetting several adjacent edges at once is not the same operation as offsetting them
// one after another: a single-edge move drags the two corners that edge shares with its
// neighbours, so a corner between two selected edges would travel twice and end up on the
// wrong side of the shape. Here every edge keeps its own supporting line, the selected
// lines slide outward together, and only then is each corner re-solved as the crossing of
// its two lines. That is what makes the move simultaneous.

export const OFFSET_EPSILON = 1e-9;
// A corner may only stay put between two parallel lines when it genuinely sits on both of
// them. A ten-millionth of an inch is far below anything the field can lay out, so it is a
// safe place to draw that line without rejecting ordinary floating point drift.
const COINCIDENT_TOLERANCE = 1e-7;

function signedTwiceArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
}

function toPoints(vertices) {
  return vertices.map((vertex) => ({ x: Number(vertex?.x), y: Number(vertex?.y) }));
}

export function outwardNormals(vertices) {
  const points = toPoints(vertices);
  // Winding is the only thing that says which side of an edge is outside, so the caller
  // never has to hand us a hint. A shape with no enclosed area has no answer here; callers
  // reject that before trusting these normals. Same convention the stair tool already uses.
  const sign = signedTwiceArea(points) >= 0 ? 1 : -1;
  return points.map((start, index) => {
    const end = points[(index + 1) % points.length];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (!(length > OFFSET_EPSILON)) return null;
    return { x: (end.y - start.y) / length * sign, y: -((end.x - start.x) / length) * sign };
  });
}

function intersectLines(first, second) {
  // Both directions are unit vectors, so the cross product is the sine of the angle between
  // the lines and the epsilon means "these two are parallel", not "these two are short".
  const cross = first.unit.x * second.unit.y - first.unit.y * second.unit.x;
  if (Math.abs(cross) < OFFSET_EPSILON) return null;
  const delta = { x: second.origin.x - first.origin.x, y: second.origin.y - first.origin.y };
  const factor = (delta.x * second.unit.y - delta.y * second.unit.x) / cross;
  return { x: first.origin.x + first.unit.x * factor, y: first.origin.y + first.unit.y * factor };
}

function holdParallelCorner(corner, incoming, outgoing) {
  // Parallel neighbours still have an answer when both lines moved the same way: a divided
  // edge with both halves selected, or any pair at a zero offset. The corner simply rides
  // along with them. Any other parallel pair has drifted apart and will never meet again.
  const carried = { x: corner.x + incoming.shift.x, y: corner.y + incoming.shift.y };
  const reach = { x: carried.x - outgoing.origin.x, y: carried.y - outgoing.origin.y };
  const strayDistance = Math.abs(reach.x * outgoing.unit.y - reach.y * outgoing.unit.x);
  return strayDistance <= COINCIDENT_TOLERANCE ? carried : null;
}

export function offsetSelectedEdges(vertices, selectedEdgeIndices, distanceInches) {
  const fail = (reason) => ({ ok: false, reason });
  if (!Array.isArray(vertices) || vertices.length < 3) return fail('A shape needs at least three corners before an edge can move.');
  const points = toPoints(vertices);
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return fail('Every corner needs a finite position.');
  const distance = Number(distanceInches);
  if (!Number.isFinite(distance)) return fail('Offset distance must be a number of inches.');
  if (distance < 0) return fail('Offset distance cannot be negative; selected edges only move outward.');
  if (!Array.isArray(selectedEdgeIndices) || selectedEdgeIndices.length === 0) return fail('Select at least one edge to move.');
  const count = points.length;
  // findIndex, not find: a selection holding undefined or NaN must still be caught.
  const strayPosition = selectedEdgeIndices.findIndex((index) => !Number.isInteger(index) || index < 0 || index >= count);
  if (strayPosition >= 0) return fail(`Edge ${selectedEdgeIndices[strayPosition]} is not part of this shape.`);
  if (Math.abs(signedTwiceArea(points)) < OFFSET_EPSILON) return fail('This shape encloses no area, so it has no outward direction.');

  const normals = outwardNormals(points);
  const flatIndex = normals.findIndex((normal) => !normal);
  if (flatIndex >= 0) return fail(`Edge ${flatIndex} has no length, so it has no direction to move away from.`);

  const selected = new Set(selectedEdgeIndices);
  const lines = points.map((start, index) => {
    const end = points[(index + 1) % count];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const shift = selected.has(index)
      ? { x: normals[index].x * distance, y: normals[index].y * distance }
      : { x: 0, y: 0 };
    return {
      unit: { x: (end.x - start.x) / length, y: (end.y - start.y) / length },
      origin: { x: start.x + shift.x, y: start.y + shift.y },
      shift,
    };
  });

  const resolved = [];
  for (let index = 0; index < count; index += 1) {
    const previousIndex = (index - 1 + count) % count;
    const incoming = lines[previousIndex];
    const outgoing = lines[index];
    const corner = intersectLines(incoming, outgoing) ?? holdParallelCorner(points[index], incoming, outgoing);
    if (!corner) return fail(`Edges ${previousIndex} and ${index} stay parallel after the move, so the corner between them has nowhere to land.`);
    if (!Number.isFinite(corner.x) || !Number.isFinite(corner.y)) return fail(`Edges ${previousIndex} and ${index} meet too far away to place a corner.`);
    resolved.push(corner);
  }
  if (findSelfIntersections(resolved).length) return fail('Moving the selected edges that far would fold the shape across itself.');
  return { ok: true, vertices: resolved };
}
