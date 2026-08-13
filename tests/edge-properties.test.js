import test from 'node:test';
import assert from 'node:assert/strict';
import { constrainEdge, createDeckBoundary, isEdgeLocked, offsetEdge, setEdgeLength, setEdgeLocked, splitEdgeIntoSegments, updateEdgeProperties } from '../src/tools/deck-boundary/deck-boundary.js';

let counter = 0;
const idFactory = (prefix) => `${prefix}-${++counter}`;
const makeBoundary = () => { counter = 0; return createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 8 }, { x: 120, y: 96 }, { x: 0, y: 96 }], { idFactory }); };

test('every boundary edge is a typed construction entity', () => {
  const boundary = makeBoundary();
  boundary.edges.forEach((edge) => {
    assert.equal(edge.type, 'boundary-edge');
    assert.equal(edge.schemaVersion, 1);
    assert.ok(edge.properties.classification);
    assert.ok(edge.properties.finishes);
    assert.ok(edge.properties.attachments);
  });
});

test('construction properties enrich an edge without replacing its identity', () => {
  const boundary = makeBoundary();
  const edgeId = boundary.edges[0].id;
  const enriched = updateEdgeProperties(boundary, edgeId, { finishes: { fascia: true, pictureFrame: true }, safety: { railing: 'required' } });
  const edge = enriched.edges[0];
  assert.equal(edge.id, edgeId);
  assert.equal(edge.properties.finishes.fascia, true);
  assert.equal(edge.properties.finishes.pictureFrame, true);
  assert.equal(edge.properties.safety.railing, 'required');
});

test('edge editing supports exact length, offset, and geometric relations', () => {
  const boundary = makeBoundary();
  const edgeId = boundary.edges[0].id;
  const exact = setEdgeLength(boundary, edgeId, 144);
  assert.ok(Math.abs(Math.hypot(exact.vertices[1].x, exact.vertices[1].y) - 144) < 1e-6);
  const moved = offsetEdge(exact, edgeId, 12);
  assert.notDeepEqual(moved.vertices[0], exact.vertices[0]);
  assert.equal(moved.edges[0].id, edgeId);
  const horizontal = constrainEdge(boundary, edgeId, 'horizontal');
  assert.equal(horizontal.vertices[0].y, horizontal.vertices[1].y);
  assert.equal(horizontal.edges[0].properties.custom.geometricConstraint, 'horizontal');
});

test('locked construction edges reject movement, length, splitting, and constraints', () => {
  const boundary = makeBoundary();
  const edgeId = boundary.edges[0].id;
  const locked = setEdgeLocked(boundary, edgeId, true);
  assert.equal(isEdgeLocked(locked, edgeId), true);
  assert.throws(() => setEdgeLength(locked, edgeId, 144), /unlock/i);
  assert.throws(() => offsetEdge(locked, edgeId, 12), /unlock/i);
  assert.throws(() => constrainEdge(locked, edgeId, 'horizontal'), /unlock/i);
  assert.throws(() => splitEdgeIntoSegments(locked, edgeId, 2, idFactory), /unlock/i);
  const unlocked = setEdgeLocked(locked, edgeId, false);
  assert.equal(isEdgeLocked(unlocked, edgeId), false);
});
