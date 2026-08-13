import { distance, findSelfIntersections, polygonArea, polygonPerimeter } from '../../core/geometry/vector.js';
import { combineEdgeProperties, createEdgeProperties, mergeEdgeProperties, normalizeBoundaryEdge } from '../../core/construction-objects/edge-properties.js';

export const DECK_BOUNDARY_TYPE = 'deck-boundary';
export const DECK_BOUNDARY_SCHEMA_VERSION = 1;
export const MIN_EDGE_LENGTH = 6;

const defaultId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

export function createDeckBoundary(vertices, options = {}) {
  const idFactory = options.idFactory ?? defaultId;
  const normalizedVertices = vertices.map((vertex, index) => ({
    id: vertex.id ?? idFactory('vertex'),
    x: Number(vertex.x),
    y: Number(vertex.y),
    elevation: Number(vertex.elevation ?? 0),
    order: index,
  }));
  const edgeIds = options.edgeIds ?? normalizedVertices.map(() => idFactory('edge'));
  const boundary = {
    type: DECK_BOUNDARY_TYPE,
    schemaVersion: DECK_BOUNDARY_SCHEMA_VERSION,
    id: options.id ?? idFactory('boundary'),
    name: options.name ?? 'Main deck boundary',
    closed: true,
    vertices: normalizedVertices,
    edges: normalizedVertices.map((vertex, index) => normalizeBoundaryEdge({
      id: edgeIds[index] ?? idFactory('edge'),
      startVertexId: vertex.id,
      endVertexId: normalizedVertices[(index + 1) % normalizedVertices.length]?.id,
      role: 'open',
      metadata: {},
      properties: createEdgeProperties(),
    })),
    metadata: { tags: [], ...(options.metadata ?? {}) },
    lifecycle: {
      phase: options.lifecycle?.phase ?? 'review',
      revision: options.lifecycle?.revision ?? 1,
      authoritative: options.lifecycle?.authoritative ?? false,
      lastReviewedAt: options.lifecycle?.lastReviewedAt ?? null,
      lastEditedAt: options.lifecycle?.lastEditedAt ?? null,
    },
  };
  return withComputedProperties(boundary);
}

export function withComputedProperties(boundary) {
  return {
    ...boundary,
    computed: {
      areaSquareInches: polygonArea(boundary.vertices),
      perimeterInches: polygonPerimeter(boundary.vertices),
    },
  };
}

export function updateVertex(boundary, vertexId, position) {
  assertVertexEditable(boundary, vertexId);
  return withComputedProperties({
    ...boundary,
    vertices: boundary.vertices.map((vertex) => vertex.id === vertexId
      ? { ...vertex, x: Number(position.x), y: Number(position.y) }
      : vertex),
  });
}

export function isVertexLocked(boundary, vertexId) {
  return Boolean(boundary.vertices.find((vertex) => vertex.id === vertexId)?.locked);
}

export function isEdgeLocked(boundary, edgeId) {
  return Boolean(normalizeBoundaryEdge(boundary.edges.find((edge) => edge.id === edgeId) ?? {}).properties.custom.locked);
}

export function setVertexLocked(boundary, vertexId, locked) {
  if (!boundary.vertices.some((vertex) => vertex.id === vertexId)) throw new Error('Boundary corner was not found.');
  return { ...boundary, vertices: boundary.vertices.map((vertex) => vertex.id === vertexId ? { ...vertex, locked: Boolean(locked) } : vertex) };
}

export function setEdgeLocked(boundary, edgeId, locked) {
  if (!boundary.edges.some((edge) => edge.id === edgeId)) throw new Error('Deck boundary edge was not found.');
  return updateEdgeProperties(boundary, edgeId, { custom: { locked: Boolean(locked) } });
}

function assertVertexEditable(boundary, vertexId) {
  const index = boundary.vertices.findIndex((vertex) => vertex.id === vertexId);
  if (index < 0) throw new Error('Boundary corner was not found.');
  if (isVertexLocked(boundary, vertexId)) throw new Error('Unlock this corner before moving it.');
  const adjacentEdges = [boundary.edges[index], boundary.edges[(index - 1 + boundary.edges.length) % boundary.edges.length]];
  if (adjacentEdges.some((edge) => edge && isEdgeLocked(boundary, edge.id))) throw new Error('Unlock the connected construction edge before moving this corner.');
}

export function establishDeckBoundary(boundary, now = new Date().toISOString()) {
  assertDeckBoundary(boundary);
  return {
    ...boundary,
    lifecycle: {
      ...boundary.lifecycle,
      phase: 'established',
      authoritative: true,
      lastReviewedAt: now,
    },
  };
}

export function markBoundaryEdited(boundary, now = new Date().toISOString()) {
  const lifecycle = boundary.lifecycle ?? { phase: 'established', authoritative: true, revision: 1 };
  return {
    ...boundary,
    lifecycle: {
      ...lifecycle,
      revision: (lifecycle.revision ?? 1) + 1,
      lastEditedAt: now,
    },
  };
}

export function getBoundaryLifecycle(boundary) {
  return boundary.lifecycle ?? { phase: 'established', authoritative: true, revision: 1, lastReviewedAt: null, lastEditedAt: null };
}

export function insertVertex(boundary, edgeId, position, idFactory = defaultId) {
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (edgeIndex < 0) throw new Error('Deck boundary edge was not found.');
  if (isEdgeLocked(boundary, edgeId)) throw new Error('Unlock this construction edge before splitting it.');
  const vertex = { id: idFactory('vertex'), x: Number(position.x), y: Number(position.y), elevation: 0 };
  const vertices = [...boundary.vertices];
  vertices.splice(edgeIndex + 1, 0, vertex);
  const existingEdge = boundary.edges[edgeIndex];
  const edges = [...boundary.edges];
  edges.splice(edgeIndex, 1,
    normalizeBoundaryEdge({ ...existingEdge, endVertexId: vertex.id }),
    normalizeBoundaryEdge({ id: idFactory('edge'), startVertexId: vertex.id, endVertexId: existingEdge.endVertexId, role: existingEdge.role, metadata: {}, properties: existingEdge.properties }));
  return withComputedProperties({ ...boundary, vertices: vertices.map((entry, order) => ({ ...entry, order })), edges });
}

export function splitEdgeIntoSegments(boundary, edgeId, segmentCount, idFactory = defaultId) {
  if (![2, 3].includes(segmentCount)) throw new Error('A construction edge can be divided into two or three segments.');
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (edgeIndex < 0) throw new Error('Deck boundary edge was not found.');
  if (isEdgeLocked(boundary, edgeId)) throw new Error('Unlock this construction edge before dividing it.');
  const edge = normalizeBoundaryEdge(boundary.edges[edgeIndex]);
  const start = boundary.vertices[edgeIndex];
  const end = boundary.vertices[(edgeIndex + 1) % boundary.vertices.length];
  const insertedVertices = Array.from({ length: segmentCount - 1 }, (_, index) => {
    const t = (index + 1) / segmentCount;
    return { id: idFactory('vertex'), x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, elevation: 0 };
  });
  const vertices = [...boundary.vertices];
  vertices.splice(edgeIndex + 1, 0, ...insertedVertices);
  const chain = [start, ...insertedVertices, end];
  const replacementEdges = Array.from({ length: segmentCount }, (_, index) => normalizeBoundaryEdge({
    ...edge,
    id: index === 0 ? edge.id : idFactory('edge'),
    startVertexId: chain[index].id,
    endVertexId: chain[index + 1].id,
    metadata: { ...edge.metadata, splitFromEdgeId: edge.id, splitSegment: index + 1, splitSegmentCount: segmentCount },
  }));
  const edges = [...boundary.edges];
  edges.splice(edgeIndex, 1, ...replacementEdges);
  return withComputedProperties({ ...boundary, vertices: vertices.map((vertex, order) => ({ ...vertex, order })), edges });
}

export function chamferVertex(boundary, vertexId, setback, idFactory = defaultId) {
  const index = boundary.vertices.findIndex((vertex) => vertex.id === vertexId);
  if (index < 0) throw new Error('Boundary corner was not found.');
  assertVertexEditable(boundary, vertexId);
  const previousIndex = (index - 1 + boundary.vertices.length) % boundary.vertices.length;
  const nextIndex = (index + 1) % boundary.vertices.length;
  const previous = boundary.vertices[previousIndex];
  const corner = boundary.vertices[index];
  const next = boundary.vertices[nextIndex];
  const incomingLength = distance(previous, corner);
  const outgoingLength = distance(corner, next);
  const incomingDirection = { x: (previous.x - corner.x) / incomingLength, y: (previous.y - corner.y) / incomingLength };
  const outgoingDirection = { x: (next.x - corner.x) / outgoingLength, y: (next.y - corner.y) / outgoingLength };
  if (Math.abs(incomingDirection.x * outgoingDirection.x + incomingDirection.y * outgoingDirection.y) > .0872) throw new Error('A 45° chamfer requires a 90° corner. Use Make 90° first.');
  const maximum = Math.min(incomingLength, outgoingLength) - MIN_EDGE_LENGTH;
  const size = Number(setback);
  if (!Number.isFinite(size) || size < MIN_EDGE_LENGTH) throw new Error('Chamfer must be at least 6 inches.');
  if (size > maximum) throw new Error('Chamfer must leave at least 6 inches on both connected edges.');
  const incomingPoint = {
    id: idFactory('vertex'),
    x: corner.x + (previous.x - corner.x) / incomingLength * size,
    y: corner.y + (previous.y - corner.y) / incomingLength * size,
    elevation: corner.elevation ?? 0,
  };
  const outgoingPoint = {
    id: idFactory('vertex'),
    x: corner.x + (next.x - corner.x) / outgoingLength * size,
    y: corner.y + (next.y - corner.y) / outgoingLength * size,
    elevation: corner.elevation ?? 0,
  };
  const incomingEdge = normalizeBoundaryEdge(boundary.edges[previousIndex]);
  const outgoingEdge = normalizeBoundaryEdge(boundary.edges[index]);
  const chamferEdge = normalizeBoundaryEdge({
    id: idFactory('edge'),
    startVertexId: incomingPoint.id,
    endVertexId: outgoingPoint.id,
    role: incomingEdge.role === outgoingEdge.role ? incomingEdge.role : 'open',
    metadata: { generatedFromVertexId: vertexId, operation: '45-degree-chamfer' },
    properties: mergeEdgeProperties(combineEdgeProperties(incomingEdge.properties, outgoingEdge.properties), {
      custom: { geometricConstraint: '45-degree-chamfer', chamferSetback: size, locked: false },
    }),
  });
  const vertices = [...boundary.vertices];
  vertices.splice(index, 1, incomingPoint, outgoingPoint);
  const byPair = new Map(boundary.edges
    .filter((edge) => edge.id !== incomingEdge.id && edge.id !== outgoingEdge.id)
    .map((edge) => [`${edge.startVertexId}:${edge.endVertexId}`, normalizeBoundaryEdge(edge)]));
  byPair.set(`${previous.id}:${incomingPoint.id}`, normalizeBoundaryEdge({ ...incomingEdge, endVertexId: incomingPoint.id }));
  byPair.set(`${incomingPoint.id}:${outgoingPoint.id}`, chamferEdge);
  byPair.set(`${outgoingPoint.id}:${next.id}`, normalizeBoundaryEdge({ ...outgoingEdge, startVertexId: outgoingPoint.id }));
  const edges = vertices.map((vertex, vertexIndex) => byPair.get(`${vertex.id}:${vertices[(vertexIndex + 1) % vertices.length].id}`));
  if (edges.some((edge) => !edge)) throw new Error('Chamfer could not preserve the boundary edge chain.');
  const result = withComputedProperties({ ...boundary, vertices: vertices.map((vertex, order) => ({ ...vertex, order })), edges });
  const validation = validateDeckBoundary(result);
  if (!validation.valid) throw new Error(`Chamfer is not valid: ${validation.issues[0].message}`);
  return { boundary: result, chamferEdgeId: chamferEdge.id, vertexIds: [incomingPoint.id, outgoingPoint.id], setback: size };
}

export function getBoundaryCentroid(boundary) {
  const vertices = boundary.vertices;
  const twiceArea = vertices.reduce((sum, vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + vertex.x * next.y - next.x * vertex.y;
  }, 0);
  if (Math.abs(twiceArea) < 1e-9) {
    return vertices.reduce((center, vertex) => ({ x: center.x + vertex.x / vertices.length, y: center.y + vertex.y / vertices.length }), { x: 0, y: 0 });
  }
  const weighted = vertices.reduce((center, vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const cross = vertex.x * next.y - next.x * vertex.y;
    return { x: center.x + (vertex.x + next.x) * cross, y: center.y + (vertex.y + next.y) * cross };
  }, { x: 0, y: 0 });
  return { x: weighted.x / (3 * twiceArea), y: weighted.y / (3 * twiceArea) };
}

export function orthogonalizeBoundary(boundary) {
  if (boundary.vertices.some((vertex) => vertex.locked) || boundary.edges.some((edge) => isEdgeLocked(boundary, edge.id))) throw new Error('Unlock boundary nodes and edges before making all corners 90°.');
  const count = boundary.vertices.length;
  const xParent = Array.from({ length: count }, (_, index) => index);
  const yParent = Array.from({ length: count }, (_, index) => index);
  const find = (parents, index) => parents[index] === index ? index : (parents[index] = find(parents, parents[index]));
  const union = (parents, a, b) => { const rootA = find(parents, a); const rootB = find(parents, b); if (rootA !== rootB) parents[rootB] = rootA; };
  boundary.vertices.forEach((vertex, index) => {
    const nextIndex = (index + 1) % count;
    const next = boundary.vertices[nextIndex];
    if (Math.abs(next.x - vertex.x) >= Math.abs(next.y - vertex.y)) union(yParent, index, nextIndex);
    else union(xParent, index, nextIndex);
  });
  const averages = (parents, key) => {
    const groups = new Map();
    boundary.vertices.forEach((vertex, index) => {
      const root = find(parents, index);
      const group = groups.get(root) ?? { sum: 0, count: 0 };
      group.sum += vertex[key]; group.count += 1; groups.set(root, group);
    });
    return boundary.vertices.map((_, index) => { const group = groups.get(find(parents, index)); return group.sum / group.count; });
  };
  const xs = averages(xParent, 'x');
  const ys = averages(yParent, 'y');
  const orthogonal = withComputedProperties({ ...boundary, vertices: boundary.vertices.map((vertex, index) => ({ ...vertex, x: xs[index], y: ys[index] })) });
  const validation = validateDeckBoundary(orthogonal);
  if (!validation.valid) throw new Error(`90° conversion is not valid: ${validation.issues[0].message}`);
  return orthogonal;
}

export function removeVertex(boundary, vertexId) {
  if (boundary.vertices.length <= 3) throw new Error('A deck boundary needs at least three corners.');
  const index = boundary.vertices.findIndex((vertex) => vertex.id === vertexId);
  if (index < 0) return boundary;
  assertVertexEditable(boundary, vertexId);
  const previousEdgeIndex = (index - 1 + boundary.edges.length) % boundary.edges.length;
  const removedEdgeIndex = index;
  const previousEdge = boundary.edges[previousEdgeIndex];
  const removedEdge = boundary.edges[removedEdgeIndex];
  const edges = boundary.edges.filter((_, edgeIndex) => edgeIndex !== removedEdgeIndex)
    .map((edge) => normalizeBoundaryEdge(edge.id === previousEdge.id ? { ...edge, endVertexId: removedEdge.endVertexId } : edge));
  const vertices = boundary.vertices.filter((vertex) => vertex.id !== vertexId)
    .map((vertex, order) => ({ ...vertex, order }));
  return withComputedProperties({ ...boundary, vertices, edges });
}

export function findAdjacentMergeCandidate(boundary, sourceVertexId, position, tolerance) {
  const sourceIndex = boundary.vertices.findIndex((vertex) => vertex.id === sourceVertexId);
  if (sourceIndex < 0) return null;
  const candidates = [
    boundary.vertices[(sourceIndex - 1 + boundary.vertices.length) % boundary.vertices.length],
    boundary.vertices[(sourceIndex + 1) % boundary.vertices.length],
  ];
  return candidates
    .map((vertex) => ({ vertex, distance: distance(vertex, position) }))
    .filter((candidate) => candidate.distance <= tolerance)
    .sort((a, b) => a.distance - b.distance)[0]?.vertex ?? null;
}

export function mergeAdjacentVertices(boundary, sourceVertexId, targetVertexId) {
  if (boundary.vertices.length <= 3) throw new Error('A deck boundary needs at least three corners.');
  const sourceIndex = boundary.vertices.findIndex((vertex) => vertex.id === sourceVertexId);
  const targetIndex = boundary.vertices.findIndex((vertex) => vertex.id === targetVertexId);
  if (sourceIndex < 0 || targetIndex < 0) throw new Error('Boundary corner was not found.');
  assertVertexEditable(boundary, sourceVertexId);
  assertVertexEditable(boundary, targetVertexId);
  const previousIndex = (sourceIndex - 1 + boundary.vertices.length) % boundary.vertices.length;
  const nextIndex = (sourceIndex + 1) % boundary.vertices.length;
  if (targetIndex !== previousIndex && targetIndex !== nextIndex) throw new Error('Only neighboring boundary corners can merge.');

  const previousEdgeIndex = previousIndex;
  const outgoingEdgeIndex = sourceIndex;
  const previousEdge = normalizeBoundaryEdge(boundary.edges[previousEdgeIndex]);
  const outgoingEdge = normalizeBoundaryEdge(boundary.edges[outgoingEdgeIndex]);
  let removedEdge;
  let survivor;
  if (targetIndex === nextIndex) {
    removedEdge = outgoingEdge;
    survivor = normalizeBoundaryEdge({
      ...previousEdge,
      endVertexId: targetVertexId,
      properties: combineEdgeProperties(previousEdge.properties, outgoingEdge.properties, outgoingEdge.id),
      metadata: { ...previousEdge.metadata, mergedEdgeIds: [...new Set([...(previousEdge.metadata?.mergedEdgeIds ?? []), outgoingEdge.id])] },
    });
  } else {
    removedEdge = previousEdge;
    survivor = normalizeBoundaryEdge({
      ...outgoingEdge,
      startVertexId: targetVertexId,
      properties: combineEdgeProperties(outgoingEdge.properties, previousEdge.properties, previousEdge.id),
      metadata: { ...outgoingEdge.metadata, mergedEdgeIds: [...new Set([...(outgoingEdge.metadata?.mergedEdgeIds ?? []), previousEdge.id])] },
    });
  }
  const vertices = boundary.vertices.filter((vertex) => vertex.id !== sourceVertexId).map((vertex, order) => ({ ...vertex, order }));
  const edges = boundary.edges
    .filter((edge) => edge.id !== removedEdge.id)
    .map((edge) => edge.id === survivor.id ? survivor : normalizeBoundaryEdge(edge));
  const merged = withComputedProperties({ ...boundary, vertices, edges });
  const validation = validateDeckBoundary(merged);
  if (!validation.valid) throw new Error(`Corners cannot merge: ${validation.issues[0].message}`);
  return { boundary: merged, removedEdgeId: removedEdge.id, survivingEdgeId: survivor.id, removedVertexId: sourceVertexId, targetVertexId };
}

export function setEdgeRole(boundary, edgeId, role) {
  const allowedRoles = ['open', 'house', 'free-edge'];
  if (!allowedRoles.includes(role)) throw new Error(`Unsupported deck edge role: ${role}`);
  return {
    ...boundary,
    edges: boundary.edges.map((edge) => edge.id === edgeId ? normalizeBoundaryEdge({
      ...edge,
      role,
      properties: mergeEdgeProperties(edge.properties, { classification: { relationship: role === 'house' ? 'house-attachment' : role } }),
    }) : normalizeBoundaryEdge(edge)),
  };
}

export function updateEdgeProperties(boundary, edgeId, patch) {
  return {
    ...boundary,
    edges: boundary.edges.map((edge) => edge.id === edgeId
      ? normalizeBoundaryEdge({ ...edge, properties: mergeEdgeProperties(edge.properties, patch) })
      : normalizeBoundaryEdge(edge)),
  };
}

export function setEdgeLength(boundary, edgeId, length) {
  if (!Number.isFinite(length) || length < MIN_EDGE_LENGTH) throw new Error('Edge length must be at least 6 inches.');
  const index = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (index < 0) throw new Error('Deck boundary edge was not found.');
  if (isEdgeLocked(boundary, edgeId)) throw new Error('Unlock this construction edge before changing its length.');
  const start = boundary.vertices[index];
  const endIndex = (index + 1) % boundary.vertices.length;
  const end = boundary.vertices[endIndex];
  const currentLength = distance(start, end);
  const dx = (end.x - start.x) / currentLength;
  const dy = (end.y - start.y) / currentLength;
  return updateVertex(boundary, end.id, { x: start.x + dx * length, y: start.y + dy * length });
}

export function offsetEdge(boundary, edgeId, offset) {
  if (!Number.isFinite(offset)) throw new Error('Edge offset must be a number.');
  const index = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (index < 0) throw new Error('Deck boundary edge was not found.');
  if (isEdgeLocked(boundary, edgeId)) throw new Error('Unlock this construction edge before moving it.');
  const start = boundary.vertices[index];
  const end = boundary.vertices[(index + 1) % boundary.vertices.length];
  const length = distance(start, end);
  const normal = { x: -(end.y - start.y) / length, y: (end.x - start.x) / length };
  const movedStart = { x: start.x + normal.x * offset, y: start.y + normal.y * offset };
  const movedEnd = { x: end.x + normal.x * offset, y: end.y + normal.y * offset };
  return updateVertex(updateVertex(boundary, start.id, movedStart), end.id, movedEnd);
}

export function constrainEdge(boundary, edgeId, constraint) {
  if (!['horizontal', 'vertical'].includes(constraint)) throw new Error(`Unsupported edge constraint: ${constraint}`);
  const index = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (index < 0) throw new Error('Deck boundary edge was not found.');
  if (isEdgeLocked(boundary, edgeId)) throw new Error('Unlock this construction edge before changing its constraint.');
  const start = boundary.vertices[index];
  const end = boundary.vertices[(index + 1) % boundary.vertices.length];
  const length = distance(start, end);
  const direction = constraint === 'horizontal'
    ? { x: Math.sign(end.x - start.x) || 1, y: 0 }
    : { x: 0, y: Math.sign(end.y - start.y) || 1 };
  const constrained = updateVertex(boundary, end.id, { x: start.x + direction.x * length, y: start.y + direction.y * length });
  return updateEdgeProperties(constrained, edgeId, { custom: { geometricConstraint: constraint } });
}

export function validateDeckBoundary(boundary) {
  const issues = [];
  if (boundary.type !== DECK_BOUNDARY_TYPE) issues.push({ code: 'invalid-type', severity: 'error', message: 'Object is not a deck boundary.' });
  if (!boundary.closed) issues.push({ code: 'not-closed', severity: 'error', message: 'Deck boundary must be closed.' });
  if (boundary.vertices.length < 3) issues.push({ code: 'too-few-vertices', severity: 'error', message: 'Add at least three corners.' });
  boundary.vertices.forEach((vertex, index) => {
    const next = boundary.vertices[(index + 1) % boundary.vertices.length];
    if (next && distance(vertex, next) < MIN_EDGE_LENGTH) {
      issues.push({ code: 'short-edge', severity: 'error', edgeId: boundary.edges[index]?.id, message: 'An edge is shorter than 6 inches.' });
    }
  });
  findSelfIntersections(boundary.vertices).forEach(([first, second]) => {
    issues.push({ code: 'self-intersection', severity: 'error', edgeIds: [boundary.edges[first]?.id, boundary.edges[second]?.id], message: 'Deck edges cannot cross.' });
  });
  if (boundary.computed.areaSquareInches < 144) issues.push({ code: 'small-area', severity: 'warning', message: 'Deck area is less than one square foot.' });
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

export function assertDeckBoundary(boundary) {
  const result = validateDeckBoundary(boundary);
  if (!result.valid) throw new Error(result.issues.map((issue) => issue.message).join(' '));
  return boundary;
}
