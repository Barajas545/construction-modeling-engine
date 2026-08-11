import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeckBoundary,
  findAdjacentMergeCandidate,
  mergeAdjacentVertices,
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
