import test from 'node:test';
import assert from 'node:assert/strict';
import { EDGE_PROPERTY_SCHEMA_VERSION } from '../src/core/construction-objects/edge-properties.js';
import { clearEdgeOrientationConstraint, constrainEdge, createDeckBoundary, getEdgeOrientationConstraint, isEdgeLocked, moveVertexWithConstraints, offsetEdge, setEdgeLength, setEdgeLocked, setEdgeOrientationConstraint, splitEdgeIntoSegments, updateEdgeProperties, validateDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';

let counter = 0;
const idFactory = (prefix) => `${prefix}-${++counter}`;
const makeBoundary = () => { counter = 0; return createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 8 }, { x: 120, y: 96 }, { x: 0, y: 96 }], { idFactory }); };

test('every boundary edge is a typed construction entity', () => {
  const boundary = makeBoundary();
  boundary.edges.forEach((edge) => {
    assert.equal(edge.type, 'boundary-edge');
    assert.equal(edge.schemaVersion, EDGE_PROPERTY_SCHEMA_VERSION);
    assert.ok(edge.properties.classification);
    assert.ok(edge.properties.finishes);
    assert.ok(edge.properties.attachments);
    assert.equal(edge.properties.attachments.rimJoist, null);
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
  assert.equal(getEdgeOrientationConstraint(horizontal, edgeId).type, 'horizontal');
});

test('orientation constraints are structured, serializable, mutually replaceable, and removable', () => {
  const boundary = makeBoundary();
  const edgeId = boundary.edges[0].id;
  const horizontal = setEdgeOrientationConstraint(boundary, edgeId, 'horizontal');
  assert.equal(getEdgeOrientationConstraint(horizontal, edgeId).type, 'horizontal');
  const angled = setEdgeOrientationConstraint(horizontal, edgeId, 'fixed-angle');
  assert.equal(getEdgeOrientationConstraint(angled, edgeId).type, 'fixed-angle');
  assert.doesNotThrow(() => JSON.stringify(angled));
  assert.equal(getEdgeOrientationConstraint(clearEdgeOrientationConstraint(angled, edgeId), edgeId), null);
});

test('a fixed-angle edge can change length and move parallel without rotating', () => {
  const boundary = makeBoundary();
  const edgeId = boundary.edges[0].id;
  const constrained = setEdgeOrientationConstraint(boundary, edgeId, 'fixed-angle');
  const angle = getEdgeOrientationConstraint(constrained, edgeId).angleRadians;
  const resized = setEdgeLength(constrained, edgeId, 144);
  assert.ok(Math.abs(Math.atan2(resized.vertices[1].y - resized.vertices[0].y, resized.vertices[1].x - resized.vertices[0].x) - angle) < 1e-9);
  const moved = offsetEdge(resized, edgeId, 10);
  assert.ok(Math.abs(Math.atan2(moved.vertices[1].y - moved.vertices[0].y, moved.vertices[1].x - moved.vertices[0].x) - angle) < 1e-9);
  assert.equal(validateDeckBoundary(moved).valid, true);
});

test('moving a connected node changes constrained edge length but preserves its angle', () => {
  const boundary = makeBoundary();
  const edgeId = boundary.edges[0].id;
  const constrained = setEdgeOrientationConstraint(boundary, edgeId, 'fixed-angle');
  const originalLength = Math.hypot(constrained.vertices[1].x - constrained.vertices[0].x, constrained.vertices[1].y - constrained.vertices[0].y);
  const moved = moveVertexWithConstraints(constrained, constrained.vertices[1].id, { x: 80, y: 45 });
  const nextLength = Math.hypot(moved.vertices[1].x - moved.vertices[0].x, moved.vertices[1].y - moved.vertices[0].y);
  const expectedAngle = getEdgeOrientationConstraint(constrained, edgeId).angleRadians;
  const actualAngle = Math.atan2(moved.vertices[1].y - moved.vertices[0].y, moved.vertices[1].x - moved.vertices[0].x);
  assert.notEqual(nextLength, originalLength);
  assert.ok(Math.abs(actualAngle - expectedAngle) < 1e-9);
});

test('moving an adjacent edge can resize a constrained edge indirectly', () => {
  const boundary = setEdgeOrientationConstraint(makeBoundary(), 'edge-5', 'horizontal');
  const originalLength = Math.abs(boundary.vertices[1].x - boundary.vertices[0].x);
  const moved = offsetEdge(boundary, 'edge-6', 14);
  assert.equal(moved.vertices[0].y, moved.vertices[1].y);
  assert.notEqual(Math.abs(moved.vertices[1].x - moved.vertices[0].x), originalLength);
  assert.equal(validateDeckBoundary(moved).valid, true);
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
