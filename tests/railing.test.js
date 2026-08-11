import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRailingGeometries, computeRailingLayout, createRailingRun, deriveRailingGeometry, projectPointToEdge } from '../src/tools/railing/railing.js';

test('uses the fewest equal sections that keep clear span at or below six feet', () => {
  const cases = [[60, 1], [96, 2], [144, 2], [156, 3], [192, 3], [240, 4], [300, 4]];
  cases.forEach(([length, sections]) => {
    const layout = computeRailingLayout(length);
    assert.equal(layout.sectionCount, sections);
    assert.ok(layout.clearSpan <= 72);
    assert.equal(layout.postCount, sections + 1);
    assert.equal(layout.posts.at(-1).t, 1);
  });
});

test('projects a drag onto its host construction edge', () => {
  const projection = projectPointToEdge({ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 48, y: 30 });
  assert.equal(projection.t, 0.4);
  assert.deepEqual(projection.point, { x: 48, y: 0 });
});

test('stores a railing as normalized references and derives posts from current geometry', () => {
  const railing = createRailingRun({ boundaryId: 'deck-1', edgeId: 'edge-1', edgeKind: 'boundary-edge' }, .25, .75, {}, () => 'railing-1');
  const geometry = deriveRailingGeometry(railing, { x: 0, y: 0 }, { x: 240, y: 0 });
  assert.equal(geometry.length, 120);
  assert.equal(geometry.sectionCount, 2);
  assert.deepEqual(geometry.start, { x: 60, y: 0 });
  assert.deepEqual(geometry.end, { x: 180, y: 0 });
});

test('connected perpendicular runs share a visible post and default their corner to exterior', () => {
  const first = createRailingRun({ boundaryId: 'deck-1', edgeId: 'edge-1' }, 0, 1, {}, () => 'r1');
  const second = createRailingRun({ boundaryId: 'deck-1', edgeId: 'edge-2' }, 0, 1, {}, () => 'r2');
  const geometries = [
    deriveRailingGeometry(first, { x: 0, y: 0 }, { x: 144, y: 0 }),
    deriveRailingGeometry(second, { x: 144, y: 0 }, { x: 144, y: 144 }),
  ];
  const analysis = analyzeRailingGeometries(geometries);
  assert.equal(analysis.visiblePostCount, 5);
  assert.equal(analysis.exteriorCornerCount, 1);
  assert.equal(analysis.estimatedPostCount, 6);
  assert.equal(analysis.corners[0].classification, 'exterior');
});
