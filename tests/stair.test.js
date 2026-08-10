import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeckBoundary, validateDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { attachStairToBoundary, calculateStairLayout, deriveStairTreads } from '../src/tools/stairs/stair.js';

function ids() { let count = 0; return (prefix) => `${prefix}-${++count}`; }

test('calculates internal stair geometry from total rise', () => {
  const layout = calculateStairLayout(36, 7.5, 10);
  assert.equal(layout.stepCount, 5);
  assert.equal(layout.riserHeight, 7.2);
  assert.equal(layout.totalRun, 50);
});

test('attaching stairs reshapes the boundary and preserves unaffected identities', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const sourceEdgeId = boundary.edges[0].id;
  const unaffectedIds = boundary.edges.slice(1).map((edge) => edge.id);
  const result = attachStairToBoundary(boundary, sourceEdgeId, { width: 36, totalRise: 36, treadDepth: 10 }, makeId);
  assert.equal(result.stair.type, 'stair');
  assert.equal(result.stair.host.boundaryId, boundary.id);
  assert.equal(result.stair.host.sourceEdgeId, sourceEdgeId);
  assert.equal(result.boundary.edges[0].id, sourceEdgeId);
  unaffectedIds.forEach((id) => assert.ok(result.boundary.edges.some((edge) => edge.id === id)));
  assert.equal(result.boundary.vertices.length, boundary.vertices.length + 4);
  assert.equal(validateDeckBoundary(result.boundary).valid, true);
  assert.equal(deriveStairTreads(result.boundary, result.stair).length, result.stair.dimensions.stepCount);
});

test('generated stair edges reference their owning construction object', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const result = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, totalRise: 30, treadDepth: 10 }, makeId);
  const generated = result.boundary.edges.filter((edge) => edge.properties.attachments.stairId === result.stair.id);
  assert.equal(generated.length, 3);
  assert.deepEqual(result.stair.generatedEdgeIds, generated.map((edge) => edge.id));
});
