import test from 'node:test';
import assert from 'node:assert/strict';
import { findSelfIntersections, polygonArea, polygonPerimeter, snapPoint } from '../src/core/geometry/vector.js';

test('calculates area and perimeter for an axis-aligned boundary', () => {
  const rectangle = [{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }];
  assert.equal(polygonArea(rectangle), 27_648);
  assert.equal(polygonPerimeter(rectangle), 672);
});

test('detects crossing deck edges', () => {
  const bowTie = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }];
  assert.deepEqual(findSelfIntersections(bowTie), [[0, 2]]);
});

test('snaps to field precision and an adjacent axis', () => {
  const result = snapPoint({ x: 24.2, y: 48.1 }, { x: 12, y: 48 }, { grid: .5, axisThreshold: 1 });
  assert.deepEqual(result.point, { x: 24, y: 48 });
  assert.deepEqual(result.guides, ['horizontal']);
});
