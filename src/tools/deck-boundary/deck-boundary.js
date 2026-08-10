import { distance, findSelfIntersections, polygonArea, polygonPerimeter } from '../../core/geometry/vector.js';

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
    edges: normalizedVertices.map((vertex, index) => ({
      id: edgeIds[index] ?? idFactory('edge'),
      startVertexId: vertex.id,
      endVertexId: normalizedVertices[(index + 1) % normalizedVertices.length]?.id,
      role: 'open',
      metadata: {},
    })),
    metadata: { tags: [], ...(options.metadata ?? {}) },
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
  return withComputedProperties({
    ...boundary,
    vertices: boundary.vertices.map((vertex) => vertex.id === vertexId
      ? { ...vertex, x: Number(position.x), y: Number(position.y) }
      : vertex),
  });
}

export function insertVertex(boundary, edgeId, position, idFactory = defaultId) {
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (edgeIndex < 0) throw new Error('Deck boundary edge was not found.');
  const vertex = { id: idFactory('vertex'), x: Number(position.x), y: Number(position.y), elevation: 0 };
  const vertices = [...boundary.vertices];
  vertices.splice(edgeIndex + 1, 0, vertex);
  const existingEdge = boundary.edges[edgeIndex];
  const edges = [...boundary.edges];
  edges.splice(edgeIndex, 1,
    { ...existingEdge, endVertexId: vertex.id },
    { id: idFactory('edge'), startVertexId: vertex.id, endVertexId: existingEdge.endVertexId, role: existingEdge.role, metadata: {} });
  return withComputedProperties({ ...boundary, vertices: vertices.map((entry, order) => ({ ...entry, order })), edges });
}

export function removeVertex(boundary, vertexId) {
  if (boundary.vertices.length <= 3) throw new Error('A deck boundary needs at least three corners.');
  const index = boundary.vertices.findIndex((vertex) => vertex.id === vertexId);
  if (index < 0) return boundary;
  const previousEdgeIndex = (index - 1 + boundary.edges.length) % boundary.edges.length;
  const removedEdgeIndex = index;
  const previousEdge = boundary.edges[previousEdgeIndex];
  const removedEdge = boundary.edges[removedEdgeIndex];
  const edges = boundary.edges.filter((_, edgeIndex) => edgeIndex !== removedEdgeIndex)
    .map((edge) => edge.id === previousEdge.id ? { ...edge, endVertexId: removedEdge.endVertexId } : edge);
  const vertices = boundary.vertices.filter((vertex) => vertex.id !== vertexId)
    .map((vertex, order) => ({ ...vertex, order }));
  return withComputedProperties({ ...boundary, vertices, edges });
}

export function setEdgeRole(boundary, edgeId, role) {
  const allowedRoles = ['open', 'house', 'free-edge'];
  if (!allowedRoles.includes(role)) throw new Error(`Unsupported deck edge role: ${role}`);
  return { ...boundary, edges: boundary.edges.map((edge) => edge.id === edgeId ? { ...edge, role } : edge) };
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
