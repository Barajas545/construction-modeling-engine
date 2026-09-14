import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRailingGeometries, computeRailingLayout, createRailingLine, createRailingRun, deriveRailingGeometry, deriveRailingLineGeometry, deriveRailingPostLayout, projectPointToEdge, resolveRailingEndpointSnap, updateRailingSettings } from '../src/tools/railing/railing.js';

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

test('connected perpendicular runs count only visible posts until their shared corner is explicitly doubled', () => {
  const first = createRailingRun({ boundaryId: 'deck-1', edgeId: 'edge-1' }, 0, 1, {}, () => 'r1');
  const second = createRailingRun({ boundaryId: 'deck-1', edgeId: 'edge-2' }, 0, 1, {}, () => 'r2');
  const geometries = [
    deriveRailingGeometry(first, { x: 0, y: 0 }, { x: 144, y: 0 }),
    deriveRailingGeometry(second, { x: 144, y: 0 }, { x: 144, y: 144 }),
  ];
  const analysis = analyzeRailingGeometries(geometries);
  assert.equal(analysis.visiblePostCount, 5);
  assert.equal(analysis.doubleCornerCount, 0);
  assert.equal(analysis.estimatedPostCount, 5);
  assert.equal(analysis.corners[0].classification, 'single');

  const cornerId = analysis.corners[0].id;
  const doubled = analyzeRailingGeometries(geometries, { [cornerId]: { double: true } });
  const layout = deriveRailingPostLayout(geometries, { [cornerId]: { double: true } });
  const cornerPost = layout.posts.find((post) => post.cornerId === cornerId);
  assert.equal(doubled.visiblePostCount, 6);
  assert.equal(doubled.doubleCornerCount, 1);
  assert.equal(doubled.estimatedPostCount, 6);
  assert.equal(cornerPost.markers.length, 2);
  assert.deepEqual(cornerPost.markers.map(({ x, y }) => ({ x, y })), [{ x: 140.5, y: 0 }, { x: 144, y: 3.5 }]);
});

test('a double corner equalizes both runs and removes intermediate posts that are no longer required', () => {
  const first = createRailingRun({ boundaryId: 'deck-1', edgeId: 'edge-1' }, 0, 1, {}, () => 'r1');
  const second = createRailingRun({ boundaryId: 'deck-1', edgeId: 'edge-2' }, 0, 1, {}, () => 'r2');
  const geometries = [
    deriveRailingGeometry(first, { x: 0, y: 0 }, { x: 152, y: 0 }),
    deriveRailingGeometry(second, { x: 152, y: 0 }, { x: 152, y: 152 }),
  ];
  const initial = analyzeRailingGeometries(geometries);
  const cornerId = initial.corners[0].id;
  const doubled = analyzeRailingGeometries(geometries, { [cornerId]: { double: true } });
  assert.equal(initial.sectionCount, 6);
  assert.equal(initial.visiblePostCount, 7);
  assert.equal(doubled.sectionCount, 4);
  assert.equal(doubled.visiblePostCount, 6);
  doubled.geometries.forEach((geometry) => {
    assert.equal(geometry.sectionCount, 2);
    const intervals = geometry.posts.slice(1).map((post, index) => Math.hypot(post.x - geometry.posts[index].x, post.y - geometry.posts[index].y));
    assert.ok(intervals.every((interval) => Math.abs(interval - intervals[0]) < 1e-8));
    assert.ok(geometry.clearSpan <= 72);
  });
});

test('free railing lines preserve independent snapped endpoints', () => {
  const railing = createRailingLine(
    { snapType: 'edge', edgeId: 'edge-1', t: .5, point: { x: 60, y: 0 } },
    { snapType: 'grid', point: { x: 180, y: 96 } },
    {},
    () => 'railing-free-1',
  );
  const geometry = deriveRailingLineGeometry(railing, railing.anchors.start.point, railing.anchors.end.point);
  assert.equal(railing.host, undefined);
  assert.equal(railing.anchors.start.edgeId, 'edge-1');
  assert.equal(Math.round(geometry.length), 154);
  assert.equal(geometry.posts.at(-1).x, 180);
});

test('railing endpoint snap prioritizes corners, then edges, then grid', () => {
  const targets = {
    vertices: [{ vertexId: 'v1', point: { x: 0, y: 0 } }],
    edges: [{ edgeId: 'e1', start: { x: 0, y: 0 }, end: { x: 120, y: 0 } }],
  };
  assert.equal(resolveRailingEndpointSnap({ x: 2, y: 2 }, targets, { tolerance: 8 }).snapType, 'vertex');
  assert.equal(resolveRailingEndpointSnap({ x: 60, y: 3 }, targets, { tolerance: 8 }).snapType, 'edge');
  assert.deepEqual(resolveRailingEndpointSnap({ x: 61, y: 17 }, targets, { tolerance: 8, gridSpacing: 6 }).point, { x: 60, y: 18 });
  assert.equal(resolveRailingEndpointSnap({ x: 61, y: 17 }, targets, { edges: false, grid: false }), null);
});

test('manual panel count may add posts but never violate the minimum layout', () => {
  assert.equal(computeRailingLayout(144, { sectionCountOverride: 4 }).sectionCount, 4);
  assert.equal(computeRailingLayout(144, { sectionCountOverride: 1 }).sectionCount, 2);
  const railing = createRailingLine({ point: { x: 0, y: 0 } }, { point: { x: 144, y: 0 } }, {}, () => 'r1');
  const updated = updateRailingSettings(railing, { system: 'trex', sectionCountOverride: 3 });
  assert.equal(updated.settings.system, 'trex');
  assert.equal(updated.settings.sectionCountOverride, 3);
  assert.equal(updated.lifecycle.revision, 2);
});
