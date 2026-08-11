import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeckBoundary, validateDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { attachStairToBoundary, calculateStairDragLayout, calculateStairLayout, deriveStairDragOptions, deriveStairTreads, validateStairPlacement } from '../src/tools/stairs/stair.js';

function ids() { let count = 0; return (prefix) => `${prefix}-${++count}`; }

test('calculates internal stair geometry from total rise', () => {
  const layout = calculateStairLayout(36, 7.5, 10);
  assert.equal(layout.stepCount, 5);
  assert.equal(layout.riserCount, 5);
  assert.equal(layout.treadCount, 4);
  assert.equal(layout.riserHeight, 7.2);
  assert.equal(layout.totalRun, 40);
});

test('drag layout keeps every tread at or below 11 inches and every riser at or below 7.5 inches', () => {
  [24, 40, 60, 96].forEach((run) => {
    const layout = calculateStairDragLayout(run);
    assert.ok(layout.treadDepth <= 11);
    assert.ok(layout.riserHeight <= 7.5);
    assert.equal(layout.treadCount, layout.riserCount - 1);
    assert.equal(layout.totalRun, run);
  });
});

test('dragging outward from a boundary edge derives a live stair definition', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const options = deriveStairDragOptions(boundary, boundary.edges[0].id, { x: 96, y: -40 }, 36);
  assert.equal(options.totalRun, 40);
  assert.equal(options.totalRise, 36);
  assert.equal(options.riserCount, 5);
  assert.equal(options.treadCount, 4);
  assert.equal(options.riserHeight, 7.2);
  assert.equal(options.treadDepth, 10);
  const attached = attachStairToBoundary(boundary, boundary.edges[0].id, options, makeId);
  assert.equal(attached.stair.dimensions.totalRun, 40);
  assert.equal(attached.stair.dimensions.riserCount, 5);
  assert.equal(deriveStairTreads(attached.boundary, attached.stair).length, 4);
});

test('manual stair definitions reject treads over 11 inches', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const result = validateStairPlacement(boundary, boundary.edges[0].id, { width: 36, totalRise: 36, treadDepth: 11.5, targetRiserHeight: 7.5 });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(' '), /11 inches/);
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
  assert.equal(deriveStairTreads(result.boundary, result.stair).length, result.stair.dimensions.treadCount);
});

test('generated stair edges reference their owning construction object', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const result = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, totalRise: 30, treadDepth: 10 }, makeId);
  const generated = result.boundary.edges.filter((edge) => edge.properties.attachments.stairId === result.stair.id);
  assert.equal(generated.length, 3);
  assert.deepEqual(result.stair.generatedEdgeIds, generated.map((edge) => edge.id));
});
