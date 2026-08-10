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
