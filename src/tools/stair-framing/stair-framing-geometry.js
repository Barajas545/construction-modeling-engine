import { getStairVertexMap } from '../stairs/stair.js';
import { deriveStairFraming } from './stair-framing.js';

// Plan-view projections of the existing takeoff members, not new model objects.
export function deriveStairFramingGeometry(boundary, stair, { visible = true } = {}) {
  if (!visible || !stair?.anchors) return [];
  const points = getStairVertexMap(boundary, stair);
  const { openingStartVertexId, openingEndVertexId, outerStartVertexId, outerEndVertexId } = stair.anchors;
  const [a, b, c, d] = [openingStartVertexId, openingEndVertexId, outerStartVertexId, outerEndVertexId].map((id) => points.get(id));
  if (![a, b, c, d].every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return [];
  const framing = deriveStairFraming(stair);
  if (!Number.isFinite(framing.stringerCount) || framing.stringerCount < 2 || framing.totalRunInches <= 0
    || Math.hypot(b.x - a.x, b.y - a.y) < 1e-8 || Math.hypot(c.x - a.x, c.y - a.y) < 1e-8) return [];
  const interpolate = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const members = [];
  for (let index = 0; index < framing.stringerCount; index += 1) {
    const t = framing.stringerOffsetsInches[index] / framing.widthInches;
    members.push({ role: index === 0 || index === framing.stringerCount - 1 ? 'side-stringer' : 'internal-stringer',
      material: framing.material, start: interpolate(a, b, t), end: interpolate(c, d, t) });
  }
  members.push({ role: 'ledger', material: framing.material, start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } });
  const closure = framing.lowerMembers.find((member) => member.role === 'lower-closure');
  if (closure) members.push({ role: closure.role, material: closure.material, start: { x: c.x, y: c.y }, end: { x: d.x, y: d.y } });
  // The 2x4 sole plate is below the stringer ends in plan; retain it in takeoff
  // rather than inventing a second offset edge that would imply another riser.
  return members;
}
