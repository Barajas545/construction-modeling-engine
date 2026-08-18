import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSnapTargets, resolveSnap } from '../src/core/geometry/snap-engine.js';
import { parseConstructionLength } from '../src/core/units/parse-length.js';
import { adaptiveGridSpacing, createViewport, fitViewport, zoomViewport } from '../src/rendering/viewport-controller.js';

test('parses common construction length entry formats', () => {
  assert.equal(parseConstructionLength("12'"), 144);
  assert.equal(parseConstructionLength('12 ft'), 144);
  assert.equal(parseConstructionLength('144 in'), 144);
  assert.ok(Math.abs(parseConstructionLength('3658 mm') - 144.0157) < .01);
  assert.ok(Math.abs(parseConstructionLength('3.658 m') - 144.0157) < .01);
});

test('zooms around the cursor rather than the viewport center', () => {
  const viewport = createViewport(0, 0, 200, 100);
  const zoomed = zoomViewport(viewport, { x: 50, y: 25 }, .5);
  assert.deepEqual(zoomed, { x: 25, y: 12.5, width: 100, height: 50 });
});

test('fits project points while preserving viewport aspect ratio', () => {
  const fitted = fitViewport([{ x: 0, y: 0 }, { x: 200, y: 100 }], 2, 0);
  assert.equal(fitted.width / fitted.height, 2);
  assert.equal(fitted.x, 0);
  assert.equal(fitted.y, 0);
});

test('adaptive grid grows as the camera zooms out', () => {
  assert.ok(adaptiveGridSpacing(2000, 1000) > adaptiveGridSpacing(200, 1000));
});

test('snap engine prioritizes construction endpoints over the grid', () => {
  const object = { vertices: [{ id: 'a', x: 12.2, y: 10.2 }, { id: 'b', x: 80, y: 10.2 }], edges: [{ id: 'e' }, { id: 'e2' }] };
  const targets = collectSnapTargets([object]);
  const snap = resolveSnap({ x: 12, y: 10 }, { targets, tolerance: 2, grid: 6 });
  assert.equal(snap.type, 'endpoint');
  assert.equal(snap.referenceId, 'a');
});

test('snap engine supports 22.5 degree CAT and Boundary inference', () => {
  const length = 100;
  const angle = 22 * Math.PI / 180;
  const result = resolveSnap({ x: Math.cos(angle) * length, y: Math.sin(angle) * length }, {
    anchor: { x: 0, y: 0 },
    angleIncrementRadians: Math.PI / 8,
    gridEnabled: false,
    edgesEnabled: false,
    angleToleranceRadians: 4 * Math.PI / 180,
  });
  assert.equal(result.type, 'angle');
  assert.equal(result.label, '22.5°');
  assert.ok(Math.abs(Math.atan2(result.point.y, result.point.x) * 180 / Math.PI - 22.5) < .01);
});

test('construction nodes win over CAT nodes at the same location', () => {
  const targets = collectSnapTargets([
    { vertices: [{ id: 'cat-node', x: 10, y: 10 }], snapSource: 'cat', snapPriority: 1 },
    { vertices: [{ id: 'construction-node', x: 10, y: 10 }] },
  ]);
  const result = resolveSnap({ x: 10, y: 10 }, { targets, gridEnabled: false });
  assert.equal(result.referenceId, 'construction-node');
  assert.equal(result.label, 'node');
});

test('node inference combines the active line direction with a nearby node reference', () => {
  const targets = [{ type: 'endpoint', point: { x: 80, y: 0 }, referenceId: 'reference-node' }];
  const snap = resolveSnap({ x: 80.8, y: 100.8 }, {
    anchor: { x: 0, y: 100 },
    targets,
    tolerance: 3,
    inferenceTolerance: 3,
    grid: 6,
  });
  assert.equal(snap.type, 'node-intersection');
  assert.deepEqual(snap.point, { x: 80, y: 100 });
  assert.equal(snap.label, 'Horizontal · Vertical to node');
  assert.equal(snap.referenceId, 'reference-node');
  assert.equal(snap.inference.combined, true);
});

test('node inference supports a 45-degree reference without making a permanent constraint', () => {
  const targets = [{ type: 'endpoint', point: { x: 50, y: 50 }, referenceId: 'diagonal-node' }];
  const snap = resolveSnap({ x: 100.5, y: 100.3 }, {
    anchor: { x: 0, y: 100 },
    targets,
    tolerance: 2,
    inferenceTolerance: 2,
    grid: 6,
  });
  assert.equal(snap.type, 'node-intersection');
  assert.ok(Math.abs(snap.point.x - 100) < 1e-6);
  assert.ok(Math.abs(snap.point.y - 100) < 1e-6);
  assert.equal(snap.label, 'Horizontal · 45° to node');
});

test('node references remain available while physical edge snaps are disabled', () => {
  const targets = [{ type: 'endpoint', point: { x: 80, y: 0 }, referenceId: 'reference-node' }];
  const inferred = resolveSnap({ x: 80.8, y: 100.8 }, {
    anchor: { x: 0, y: 100 }, targets, tolerance: 3, inferenceTolerance: 3, edgesEnabled: false, gridEnabled: false,
  });
  assert.equal(inferred.type, 'node-intersection');
  const free = resolveSnap({ x: 80.8, y: 100.8 }, {
    anchor: { x: 0, y: 100 }, targets, tolerance: 3, nodeInference: false, edgesEnabled: false, gridEnabled: false,
  });
  assert.equal(free.type, 'alignment');
});

test('the active node reference receives a larger release tolerance', () => {
  const targets = [{ type: 'endpoint', point: { x: 80, y: 0 }, referenceId: 'sticky-node' }];
  const snap = resolveSnap({ x: 83.5, y: 100 }, {
    anchor: { x: 0, y: 100 }, targets, tolerance: 2, inferenceTolerance: 3,
    preferredReferenceId: 'sticky-node', inferenceReleaseMultiplier: 1.45,
  });
  assert.equal(snap.type, 'node-intersection');
  assert.equal(snap.referenceId, 'sticky-node');
});
