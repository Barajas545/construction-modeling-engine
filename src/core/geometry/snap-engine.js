import { distance, nearestPointOnSegment } from './vector.js';

const priority = { endpoint: 0, midpoint: 1, alignment: 2, angle: 3, edge: 4, grid: 5, none: 99 };

export function collectSnapTargets(objects = []) {
  const targets = [];
  objects.forEach((object) => {
    object.vertices?.forEach((vertex) => targets.push({ type: 'endpoint', point: vertex, referenceId: vertex.id }));
    object.edges?.forEach((edge, index) => {
      const start = object.vertices[index];
      const end = object.vertices[(index + 1) % object.vertices.length];
      if (!start || !end) return;
      targets.push({ type: 'midpoint', point: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, referenceId: edge.id });
      targets.push({ type: 'edge', start, end, referenceId: edge.id });
    });
  });
  return targets;
}

export function resolveSnap(candidate, context = {}) {
  const anchor = context.anchor ?? null;
  const tolerance = context.tolerance ?? 4;
  const grid = context.grid ?? .5;
  const candidates = [];
  for (const target of context.targets ?? []) {
    if (target.type === 'edge') {
      const projected = nearestPointOnSegment(candidate, target.start, target.end);
      if (projected.distance <= tolerance) candidates.push({ ...target, point: projected.point, distance: projected.distance });
    } else {
      const targetDistance = distance(candidate, target.point);
      if (targetDistance <= tolerance) candidates.push({ ...target, distance: targetDistance });
    }
  }
  if (anchor) {
    const dx = candidate.x - anchor.x;
    const dy = candidate.y - anchor.y;
    const length = Math.hypot(dx, dy);
    if (Math.abs(dy) <= tolerance) candidates.push({ type: 'alignment', relation: 'Horizontal', point: { x: candidate.x, y: anchor.y }, distance: Math.abs(dy), guides: ['horizontal'] });
    if (Math.abs(dx) <= tolerance) candidates.push({ type: 'alignment', relation: 'Vertical', point: { x: anchor.x, y: candidate.y }, distance: Math.abs(dx), guides: ['vertical'] });
    if (length > 0) {
      const angle = Math.atan2(dy, dx);
      const increment = Math.PI / 4;
      const lockedAngle = Math.round(angle / increment) * increment;
      const angularOffset = Math.abs(Math.atan2(Math.sin(angle - lockedAngle), Math.cos(angle - lockedAngle)));
      if (angularOffset <= 4 * Math.PI / 180) candidates.push({ type: 'angle', relation: `${Math.round(lockedAngle * 180 / Math.PI)}°`, point: { x: anchor.x + Math.cos(lockedAngle) * length, y: anchor.y + Math.sin(lockedAngle) * length }, distance: angularOffset * length, guides: ['angle'] });
    }
  }
  candidates.push({ type: 'grid', point: { x: Math.round(candidate.x / grid) * grid, y: Math.round(candidate.y / grid) * grid }, distance: 0 });
  candidates.sort((a, b) => priority[a.type] - priority[b.type] || a.distance - b.distance);
  const result = candidates[0];
  return { point: result.point, type: result.type, label: result.relation ?? snapLabel(result.type), guides: result.guides ?? [], referenceId: result.referenceId ?? null };
}

function snapLabel(type) {
  return ({ endpoint: 'Endpoint', midpoint: 'Midpoint', edge: 'On edge', grid: 'Grid', alignment: 'Aligned', angle: 'Angle' })[type] ?? 'Free';
}
