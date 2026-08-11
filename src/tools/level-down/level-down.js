import { distance } from '../../core/geometry/vector.js';

export const LEVEL_DOWN_TYPE = 'level-down';
export const LEVEL_DOWN_SCHEMA_VERSION = 1;
export const DEFAULT_RISER_HEIGHT = 7.5;
const defaultId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

export function createLevelDown(points, options = {}, idFactory = defaultId) {
  if (!Array.isArray(points) || points.length < 2) throw new Error('Level Down requires at least two points.');
  const firstAnchor = points[0].anchor;
  const lastAnchor = points.at(-1).anchor;
  const isBoundaryAnchor = (anchor) => ['edge', 'vertex'].includes(anchor?.snapType) && anchor.edgeKind !== 'stair-interface-edge';
  if (!isBoundaryAnchor(firstAnchor) || !isBoundaryAnchor(lastAnchor)) {
    throw new Error('Level Down must begin and end on Deck Boundary construction geometry.');
  }
  const vertices = points.map((point, order) => ({ id: idFactory('level-vertex'), x: Number(point.x), y: Number(point.y), order, anchor: point.anchor ?? null }));
  if (vertices.some((vertex, index) => index && distance(vertices[index - 1], vertex) < 1e-6)) throw new Error('Level Down contains a zero-length segment.');
  const levelDownId = idFactory('level-down');
  return {
    type: LEVEL_DOWN_TYPE,
    schemaVersion: LEVEL_DOWN_SCHEMA_VERSION,
    id: levelDownId,
    name: options.name ?? 'Level down',
    host: { boundaryId: options.boundaryId },
    vertices,
    segments: vertices.slice(0, -1).map((vertex, index) => ({ id: idFactory('level-segment'), startVertexId: vertex.id, endVertexId: vertices[index + 1].id, ownerId: levelDownId })),
    dimensions: { riserHeight: options.riserHeight ?? DEFAULT_RISER_HEIGHT },
    lifecycle: { phase: 'established', revision: 1 },
  };
}

export function setLevelDownRiserHeight(levelDown, riserHeight) {
  const value = Number(riserHeight);
  if (!Number.isFinite(value) || value < .5 || value > 12) throw new Error('Level Down riser must be between 0.5 and 12 inches.');
  return { ...levelDown, dimensions: { ...levelDown.dimensions, riserHeight: value }, lifecycle: { ...levelDown.lifecycle, revision: (levelDown.lifecycle?.revision ?? 1) + 1 } };
}

export function splitLevelDownSegment(levelDown, segmentId, segmentCount, idFactory = defaultId) {
  if (![2, 3].includes(segmentCount)) throw new Error('A Level Down segment can be divided into two or three segments.');
  const segmentIndex = levelDown.segments.findIndex((segment) => segment.id === segmentId);
  if (segmentIndex < 0) throw new Error('Level Down segment was not found.');
  const start = levelDown.vertices[segmentIndex];
  const end = levelDown.vertices[segmentIndex + 1];
  const inserted = Array.from({ length: segmentCount - 1 }, (_, index) => {
    const t = (index + 1) / segmentCount;
    return { id: idFactory('level-vertex'), x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, anchor: null };
  });
  const vertices = [...levelDown.vertices];
  vertices.splice(segmentIndex + 1, 0, ...inserted);
  const chain = [start, ...inserted, end];
  const source = levelDown.segments[segmentIndex];
  const replacements = Array.from({ length: segmentCount }, (_, index) => ({
    id: index === 0 ? source.id : idFactory('level-segment'),
    startVertexId: chain[index].id,
    endVertexId: chain[index + 1].id,
    ownerId: levelDown.id,
  }));
  const segments = [...levelDown.segments];
  segments.splice(segmentIndex, 1, ...replacements);
  return { ...levelDown, vertices: vertices.map((vertex, order) => ({ ...vertex, order })), segments, lifecycle: { ...levelDown.lifecycle, revision: (levelDown.lifecycle?.revision ?? 1) + 1 } };
}
