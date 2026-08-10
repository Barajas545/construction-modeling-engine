import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeckBoundary, insertVertex, removeVertex, setEdgeRole, updateVertex, validateDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';

function ids() {
  let counter = 0;
  return (prefix) => `${prefix}-${++counter}`;
}

function rectangle() {
  return createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: ids() });
}

test('creates a serializable construction object with stable vertices and edges', () => {
  const boundary = rectangle();
  assert.equal(boundary.type, 'deck-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.vertices.length, 4);
  assert.equal(boundary.edges.length, 4);
  assert.equal(boundary.edges[0].startVertexId, boundary.vertices[0].id);
  assert.equal(boundary.edges[0].endVertexId, boundary.vertices[1].id);
  assert.equal(boundary.computed.areaSquareInches, 27_648);
  assert.doesNotThrow(() => JSON.stringify(boundary));
});

test('preserves edge identity when a corner moves', () => {
  const boundary = rectangle();
  const edgeIds = boundary.edges.map((edge) => edge.id);
  const moved = updateVertex(boundary, boundary.vertices[1].id, { x: 180, y: 0 });
  assert.deepEqual(moved.edges.map((edge) => edge.id), edgeIds);
  assert.equal(moved.vertices[1].x, 180);
});

test('splits an edge while retaining its identity and construction role', () => {
  const boundary = setEdgeRole(rectangle(), 'edge-5', 'house');
  const expanded = insertVertex(boundary, 'edge-5', { x: 96, y: 0 }, ids());
  assert.equal(expanded.vertices.length, 5);
  assert.equal(expanded.edges[0].id, 'edge-5');
  assert.equal(expanded.edges[0].role, 'house');
  assert.equal(expanded.edges[1].role, 'house');
});

test('removes a corner without allowing an invalid two-corner boundary', () => {
  const boundary = rectangle();
  const reduced = removeVertex(boundary, boundary.vertices[1].id);
  assert.equal(reduced.vertices.length, 3);
  assert.throws(() => removeVertex(reduced, reduced.vertices[0].id), /at least three corners/i);
});

test('rejects crossing and undersized construction boundaries', () => {
  const crossing = createDeckBoundary([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }], { idFactory: ids() });
  assert.equal(validateDeckBoundary(crossing).valid, false);
  assert.ok(validateDeckBoundary(crossing).issues.some((issue) => issue.code === 'self-intersection'));
  const short = createDeckBoundary([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 20 }, { x: 0, y: 20 }], { idFactory: ids() });
  assert.ok(validateDeckBoundary(short).issues.some((issue) => issue.code === 'short-edge'));
});
