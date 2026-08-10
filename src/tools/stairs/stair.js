import { createEdgeProperties, normalizeBoundaryEdge } from '../../core/construction-objects/edge-properties.js';
import { distance } from '../../core/geometry/vector.js';
import { withComputedProperties } from '../deck-boundary/deck-boundary.js';

export const STAIR_TYPE = 'stair';
export const STAIR_SCHEMA_VERSION = 1;
const defaultId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

function signedTwiceArea(vertices) {
  return vertices.reduce((sum, vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + vertex.x * next.y - next.x * vertex.y;
  }, 0);
}

export function calculateStairLayout(totalRise, targetRiserHeight = 7.5, treadDepth = 10) {
  const stepCount = Math.max(2, Math.ceil(totalRise / targetRiserHeight));
  return { stepCount, riserHeight: totalRise / stepCount, treadDepth, totalRun: stepCount * treadDepth };
}

export function validateStairPlacement(boundary, edgeId, options) {
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (edgeIndex < 0) return { valid: false, issues: ['Select a valid Deck Boundary edge.'] };
  const edgeLength = distance(boundary.vertices[edgeIndex], boundary.vertices[(edgeIndex + 1) % boundary.vertices.length]);
  const issues = [];
  if (!Number.isFinite(options.width) || options.width < 24) issues.push('Stair width must be at least 24 inches.');
  if (options.width > edgeLength - 12) issues.push('Leave at least 6 inches of boundary edge on each side of the stair.');
  if (!Number.isFinite(options.totalRise) || options.totalRise <= 0) issues.push('Enter a positive total rise.');
  if (!Number.isFinite(options.treadDepth) || options.treadDepth < 9) issues.push('Tread depth must be at least 9 inches for this planning model.');
  if (boundary.edges[edgeIndex]?.properties?.attachments?.stairId) issues.push('This edge already belongs to a staircase.');
  return { valid: issues.length === 0, issues, edgeLength };
}

export function attachStairToBoundary(boundary, edgeId, options = {}, idFactory = defaultId) {
  const settings = { width: 36, totalRise: 36, treadDepth: 10, targetRiserHeight: 7.5, ...options };
  const validation = validateStairPlacement(boundary, edgeId, settings);
  if (!validation.valid) throw new Error(validation.issues.join(' '));
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  const sourceEdge = normalizeBoundaryEdge(boundary.edges[edgeIndex]);
  const start = boundary.vertices[edgeIndex];
  const end = boundary.vertices[(edgeIndex + 1) % boundary.vertices.length];
  const length = distance(start, end);
  const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  const outwardSign = signedTwiceArea(boundary.vertices) >= 0 ? 1 : -1;
  const normal = { x: unit.y * outwardSign, y: -unit.x * outwardSign };
  const layout = calculateStairLayout(settings.totalRise, settings.targetRiserHeight, settings.treadDepth);
  const margin = (length - settings.width) / 2;
  const openingStart = { id: idFactory('vertex'), x: start.x + unit.x * margin, y: start.y + unit.y * margin, elevation: 0 };
  const openingEnd = { id: idFactory('vertex'), x: start.x + unit.x * (margin + settings.width), y: start.y + unit.y * (margin + settings.width), elevation: 0 };
  const outerStart = { id: idFactory('vertex'), x: openingStart.x + normal.x * layout.totalRun, y: openingStart.y + normal.y * layout.totalRun, elevation: -settings.totalRise };
  const outerEnd = { id: idFactory('vertex'), x: openingEnd.x + normal.x * layout.totalRun, y: openingEnd.y + normal.y * layout.totalRun, elevation: -settings.totalRise };
  const stairId = idFactory('stair');
  const vertices = [
    ...boundary.vertices.slice(0, edgeIndex + 1),
    openingStart,
    outerStart,
    outerEnd,
    openingEnd,
    ...boundary.vertices.slice(edgeIndex + 1),
  ].map((vertex, order) => ({ ...vertex, order }));
  const generated = new Map([
    [`${start.id}:${openingStart.id}`, normalizeBoundaryEdge({ ...sourceEdge, id: sourceEdge.id, endVertexId: openingStart.id })],
    [`${openingStart.id}:${outerStart.id}`, stairEdge(idFactory('edge'), openingStart.id, outerStart.id, stairId, 'left-stringer')],
    [`${outerStart.id}:${outerEnd.id}`, stairEdge(idFactory('edge'), outerStart.id, outerEnd.id, stairId, 'lower-landing-edge')],
    [`${outerEnd.id}:${openingEnd.id}`, stairEdge(idFactory('edge'), outerEnd.id, openingEnd.id, stairId, 'right-stringer')],
    [`${openingEnd.id}:${end.id}`, normalizeBoundaryEdge({ ...sourceEdge, id: idFactory('edge'), startVertexId: openingEnd.id })],
  ]);
  const oldByPair = new Map(boundary.edges.map((edge) => [`${edge.startVertexId}:${edge.endVertexId}`, normalizeBoundaryEdge(edge)]));
  const edges = vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return generated.get(`${vertex.id}:${next.id}`)
      ?? oldByPair.get(`${vertex.id}:${next.id}`)
      ?? normalizeBoundaryEdge({ id: idFactory('edge'), startVertexId: vertex.id, endVertexId: next.id, role: 'open', metadata: {}, properties: createEdgeProperties() });
  });
  const stair = {
    type: STAIR_TYPE,
    schemaVersion: STAIR_SCHEMA_VERSION,
    id: stairId,
    name: options.name ?? 'Main stairs',
    host: { boundaryId: boundary.id, sourceEdgeId: edgeId },
    anchors: { openingStartVertexId: openingStart.id, outerStartVertexId: outerStart.id, outerEndVertexId: outerEnd.id, openingEndVertexId: openingEnd.id },
    generatedEdgeIds: edges.filter((edge) => edge.properties?.attachments?.stairId === stairId).map((edge) => edge.id),
    dimensions: { width: settings.width, totalRise: settings.totalRise, ...layout },
    lifecycle: { phase: 'established', revision: 1 },
  };
  return { boundary: withComputedProperties({ ...boundary, vertices, edges }), stair };
}

function stairEdge(id, startVertexId, endVertexId, stairId, component) {
  return normalizeBoundaryEdge({
    id,
    startVertexId,
    endVertexId,
    role: 'stair',
    metadata: { generatedBy: stairId },
    properties: createEdgeProperties({ classification: { relationship: 'stair', exterior: true }, attachments: { stairId, stairComponent: component } }),
  });
}

export function deriveStairTreads(boundary, stair) {
  const byId = new Map(boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const a = byId.get(stair.anchors.openingStartVertexId);
  const b = byId.get(stair.anchors.outerStartVertexId);
  const c = byId.get(stair.anchors.outerEndVertexId);
  const d = byId.get(stair.anchors.openingEndVertexId);
  if (![a, b, c, d].every(Boolean)) return [];
  return Array.from({ length: stair.dimensions.stepCount }, (_, index) => {
    const t = (index + 1) / stair.dimensions.stepCount;
    return {
      start: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
      end: { x: d.x + (c.x - d.x) * t, y: d.y + (c.y - d.y) * t },
    };
  });
}
