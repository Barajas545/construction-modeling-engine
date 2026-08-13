import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeckBoundary,
  chamferVertex,
  findAdjacentMergeCandidate,
  mergeAdjacentVertices,
  isVertexLocked,
  removeVertex,
  setVertexLocked,
  updateVertex,
  updateEdgeProperties,
  validateDeckBoundary,
} from '../src/tools/deck-boundary/deck-boundary.js';

let counter = 0;
const idFactory = (prefix) => `${prefix}-${++counter}`;
const makeBoundary = () => {
  counter = 0;
  return createDeckBoundary([
    { x: 0, y: 0 },
    { x: 80, y: 0 },
    { x: 140, y: 50 },
    { x: 90, y: 110 },
    { x: 0, y: 90 },
  ], { idFactory });
};

test('drag merge finds only a neighboring corner within tolerance', () => {
  const boundary = makeBoundary();
  const source = boundary.vertices[1];
  const next = boundary.vertices[2];

  assert.equal(findAdjacentMergeCandidate(boundary, source.id, { x: next.x + 1, y: next.y }, 2)?.id, next.id);
  assert.equal(findAdjacentMergeCandidate(boundary, source.id, boundary.vertices[3], 2), null);
});

test('locked nodes remain fixed until explicitly unlocked', () => {
  const boundary = makeBoundary();
  const vertexId = boundary.vertices[1].id;
  const locked = setVertexLocked(boundary, vertexId, true);
  assert.equal(isVertexLocked(locked, vertexId), true);
  assert.throws(() => updateVertex(locked, vertexId, { x: 90, y: 12 }), /unlock/i);
  assert.throws(() => removeVertex(locked, vertexId), /unlock/i);
  assert.throws(() => chamferVertex(locked, vertexId, 12, idFactory), /unlock/i);
  assert.equal(isVertexLocked(setVertexLocked(locked, vertexId, false), vertexId), false);
});

test('45-degree chamfer requires an orthogonal construction corner', () => {
  const boundary = makeBoundary();
  assert.throws(() => chamferVertex(boundary, boundary.vertices[1].id, 12, idFactory), /90/);
});

test('45-degree chamfer replaces one node with equal setbacks and preserves adjacent edge identities', () => {
  counter = 0;
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 96, y: 0 }, { x: 96, y: 96 }, { x: 0, y: 96 }], { idFactory });
  const vertexId = boundary.vertices[1].id;
  const incomingEdgeId = boundary.edges[0].id;
  const outgoingEdgeId = boundary.edges[1].id;
  const result = chamferVertex(boundary, vertexId, 12, idFactory);
  assert.equal(result.boundary.vertices.length, 5);
  assert.equal(result.boundary.edges.length, 5);
  assert.ok(result.boundary.edges.some((edge) => edge.id === incomingEdgeId));
  assert.ok(result.boundary.edges.some((edge) => edge.id === outgoingEdgeId));
  const chamfer = result.boundary.edges.find((edge) => edge.id === result.chamferEdgeId);
  assert.equal(chamfer.properties.custom.geometricConstraint, '45-degree-chamfer');
  assert.equal(chamfer.properties.custom.chamferSetback, 12);
  assert.equal(validateDeckBoundary(result.boundary).valid, true);
});

test('merging forward removes the redundant edge while preserving the incoming edge identity and properties', () => {
  let boundary = makeBoundary();
  const source = boundary.vertices[1];
  const target = boundary.vertices[2];
  const incomingId = boundary.edges[0].id;
  const redundantId = boundary.edges[1].id;
  boundary = updateEdgeProperties(boundary, incomingId, { finishes: { fascia: true } });
  boundary = updateEdgeProperties(boundary, redundantId, { safety: { railing: 'required' } });

  const result = mergeAdjacentVertices(boundary, source.id, target.id);
  const survivor = result.boundary.edges.find((edge) => edge.id === incomingId);

  assert.equal(result.survivingEdgeId, incomingId);
  assert.equal(result.removedEdgeId, redundantId);
  assert.equal(result.boundary.vertices.some((vertex) => vertex.id === source.id), false);
  assert.equal(result.boundary.edges.some((edge) => edge.id === redundantId), false);
  assert.equal(survivor.endVertexId, target.id);
  assert.equal(survivor.properties.finishes.fascia, true);
  assert.equal(survivor.properties.safety.railing, 'required');
  assert.deepEqual(survivor.properties.custom.mergedFromEdgeIds, [redundantId]);
  assert.equal(validateDeckBoundary(result.boundary).valid, true);
});

test('merging backward preserves the outgoing edge identity', () => {
  const boundary = makeBoundary();
  const source = boundary.vertices[1];
  const target = boundary.vertices[0];
  const redundantId = boundary.edges[0].id;
  const outgoingId = boundary.edges[1].id;

  const result = mergeAdjacentVertices(boundary, source.id, target.id);
  const survivor = result.boundary.edges.find((edge) => edge.id === outgoingId);

  assert.equal(result.survivingEdgeId, outgoingId);
  assert.equal(result.removedEdgeId, redundantId);
  assert.equal(survivor.startVertexId, target.id);
  assert.equal(validateDeckBoundary(result.boundary).valid, true);
});

test('merge rejects non-neighboring corners and boundaries that would collapse below three corners', () => {
  const boundary = makeBoundary();
  assert.throws(() => mergeAdjacentVertices(boundary, boundary.vertices[1].id, boundary.vertices[3].id), /neighboring/);

  counter = 0;
  const triangle = createDeckBoundary([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }], { idFactory });
  assert.throws(() => mergeAdjacentVertices(triangle, triangle.vertices[1].id, triangle.vertices[2].id), /at least three corners/);
});
