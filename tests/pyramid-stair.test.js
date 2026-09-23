import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { MAX_PYRAMID_TREAD_DEPTH, MIN_PYRAMID_TREAD_DEPTH, PYRAMID_STAIR_SCHEMA_VERSION, PYRAMID_STAIR_TYPE, TREAD_DEPTH_PRESETS, createPyramidStair, solvePyramidStair } from '../src/tools/pyramid-stair/pyramid-stair.js';

function ids() { let count = 0; return (prefix) => `${prefix}-${++count}`; }

// 192" x 144" with edge 0 = bottom (y=0), 1 = right (x=192), 2 = top (y=144), 3 = left (x=0).
function rectangle() {
  return createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: ids() });
}

function bounds(vertices) {
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { minX, maxX, minY, maxY, width: maxX - minX, depth: maxY - minY };
}

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

function assertRejected(result, fragment) {
  assert.equal(result.ok, false);
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length > 10, `reason "${result.reason}" should read as a sentence`);
  if (fragment) assert.ok(result.reason.includes(fragment), `reason "${result.reason}" should mention "${fragment}"`);
}

test('builds a three-sided pyramid with hand-checked ring widths and depths', () => {
  const boundary = rectangle();
  const solution = solvePyramidStair({
    boundary,
    steppingEdgeIds: [boundary.edges[0].id, boundary.edges[1].id, boundary.edges[3].id],
    totalRise: 36,
    treadDepth: 11,
  });
  assert.equal(solution.ok, true);
  // 36" over five risers is the 7.2" recipe solveStairLayout prefers; four boxes then
  // stack under the deck and the fifth riser lands on grade.
  assert.equal(solution.riserCount, 5);
  close(solution.riserHeight, 7.2);
  assert.equal(solution.ringCount, 4);
  assert.equal(solution.rings.length, 4);
  assert.equal(solution.treadDepth, 11);

  // Bottom, right and left step out by k*11; the top edge never moves off y=144.
  const expected = [
    { width: 192, depth: 144, minX: 0, maxX: 192, minY: 0, area: 27648 },
    { width: 214, depth: 155, minX: -11, maxX: 203, minY: -11, area: 33170 },
    { width: 236, depth: 166, minX: -22, maxX: 214, minY: -22, area: 39176 },
    { width: 258, depth: 177, minX: -33, maxX: 225, minY: -33, area: 45666 },
  ];
  solution.rings.forEach((ring, index) => {
    const box = bounds(ring.vertices);
    assert.equal(ring.index, index);
    assert.equal(ring.treadDepth, 11);
    close(box.width, expected[index].width, 1e-9);
    close(box.depth, expected[index].depth, 1e-9);
    close(box.minX, expected[index].minX, 1e-9);
    close(box.maxX, expected[index].maxX, 1e-9);
    close(box.minY, expected[index].minY, 1e-9);
    close(box.maxY, 144, 1e-9);
    close(ring.areaSquareInches, expected[index].area, 1e-6);
  });

  close(solution.footprint.widthInches, 258);
  close(solution.footprint.depthInches, 177);
  close(solution.footprint.areaSquareInches, 45666, 1e-6);
  assert.deepEqual(solution.warnings, []);
});

test('ring count is one less than the riser count and elevations stack by one riser', () => {
  const boundary = rectangle();
  for (const totalRise of [12, 24, 36, 54, 72, 96]) {
    const solution = solvePyramidStair({
      boundary,
      steppingEdgeIds: [boundary.edges[0].id, boundary.edges[1].id, boundary.edges[3].id],
      totalRise,
      treadDepth: 11,
    });
    assert.equal(solution.ok, true, `rise ${totalRise} should solve`);
    assert.equal(solution.ringCount, solution.riserCount - 1);
    assert.equal(solution.rings.length, solution.riserCount - 1);
    close(solution.riserHeight * solution.riserCount, totalRise, 1e-9);
    solution.rings.forEach((ring, index) => close(ring.elevation, -(index + 1) * solution.riserHeight));
    // The deepest box sits one riser above grade, never on it.
    close(solution.rings.at(-1).elevation, -(totalRise - solution.riserHeight), 1e-9);
  }
});

test('preserves a previous riser count so changing the tread does not renumber the steps', () => {
  const boundary = rectangle();
  const base = { boundary, steppingEdgeIds: [boundary.edges[0].id], totalRise: 36, treadDepth: 16.8 };
  assert.equal(solvePyramidStair(base).riserCount, 5);
  const preserved = solvePyramidStair({ ...base, previousRiserCount: 6 });
  assert.equal(preserved.riserCount, 6);
  close(preserved.riserHeight, 6);
  assert.equal(preserved.ringCount, 5);
});

test('a single stepping edge degenerates to a straight run', () => {
  const boundary = rectangle();
  const solution = solvePyramidStair({ boundary, steppingEdgeIds: [boundary.edges[0].id], totalRise: 36, treadDepth: 11 });
  assert.equal(solution.ok, true);
  solution.rings.forEach((ring, index) => {
    const box = bounds(ring.vertices);
    // Only the bottom edge moves, so the run grows in one direction and the width is fixed.
    close(box.width, 192, 1e-9);
    close(box.minX, 0, 1e-9);
    close(box.maxX, 192, 1e-9);
    close(box.minY, -index * 11, 1e-9);
    close(box.depth, 144 + index * 11, 1e-9);
  });
  assert.ok(solution.warnings.some((warning) => warning.includes('straight run')));
});

test('an asymmetric two-side selection offsets only the selected sides', () => {
  const boundary = rectangle();
  const solution = solvePyramidStair({
    boundary,
    steppingEdgeIds: [boundary.edges[0].id, boundary.edges[1].id],
    totalRise: 36,
    treadDepth: 11,
  });
  assert.equal(solution.ok, true);
  solution.rings.forEach((ring, index) => {
    const box = bounds(ring.vertices);
    // Bottom and right step out; the left edge holds x=0 and the top holds y=144.
    close(box.minX, 0, 1e-9);
    close(box.maxY, 144, 1e-9);
    close(box.maxX, 192 + index * 11, 1e-9);
    close(box.minY, -index * 11, 1e-9);
  });
  assert.deepEqual(solution.warnings, []);
});

test('rejects a pyramid with no stepping edges', () => {
  const boundary = rectangle();
  assertRejected(solvePyramidStair({ boundary, steppingEdgeIds: [], totalRise: 36, treadDepth: 11 }), 'at least one boundary edge');
  assertRejected(solvePyramidStair({ boundary, totalRise: 36, treadDepth: 11 }), 'at least one boundary edge');
});

test('rejects a stepping edge that is not on the boundary', () => {
  const boundary = rectangle();
  assertRejected(solvePyramidStair({ boundary, steppingEdgeIds: ['edge-from-another-deck'], totalRise: 36, treadDepth: 11 }), 'edge-from-another-deck');
});

test('rejects a rise the equal-riser solver cannot divide', () => {
  const boundary = rectangle();
  const steppingEdgeIds = [boundary.edges[0].id];
  // Under 10" there is no room for two risers at the 5" minimum.
  assertRejected(solvePyramidStair({ boundary, steppingEdgeIds, totalRise: 9, treadDepth: 11 }));
  assertRejected(solvePyramidStair({ boundary, steppingEdgeIds, totalRise: 0, treadDepth: 11 }), 'positive total rise');
  assertRejected(solvePyramidStair({ boundary, steppingEdgeIds, totalRise: -12, treadDepth: 11 }), 'positive total rise');
  assertRejected(solvePyramidStair({ boundary, steppingEdgeIds, totalRise: 'tall', treadDepth: 11 }), 'positive total rise');
  // 10" is exactly two 5" risers, which is the shallowest pyramid that exists.
  const shallow = solvePyramidStair({ boundary, steppingEdgeIds, totalRise: 10, treadDepth: 11 });
  assert.equal(shallow.ok, true);
  assert.equal(shallow.ringCount, 1);
  assert.ok(shallow.warnings.some((warning) => warning.includes('Risers are under')));
});

test('rejects tread depths outside the pyramid bounds', () => {
  const boundary = rectangle();
  const steppingEdgeIds = [boundary.edges[0].id, boundary.edges[1].id];
  const solve = (treadDepth) => solvePyramidStair({ boundary, steppingEdgeIds, totalRise: 36, treadDepth });
  // A 5.5" decking board is the floor the minimum has to clear.
  assertRejected(solve(5.5), `${MIN_PYRAMID_TREAD_DEPTH} inches`);
  assertRejected(solve(MIN_PYRAMID_TREAD_DEPTH - 0.01), `${MIN_PYRAMID_TREAD_DEPTH} inches`);
  assertRejected(solve(MAX_PYRAMID_TREAD_DEPTH + 0.01), 'past what this tool models');
  assertRejected(solve('wide'), 'must be a number');
  assertRejected(solve(undefined), 'must be a number');
  // The presets and both bounds themselves stay inside the gate.
  for (const treadDepth of [...TREAD_DEPTH_PRESETS, MIN_PYRAMID_TREAD_DEPTH, MAX_PYRAMID_TREAD_DEPTH, 13.75]) {
    assert.equal(solve(treadDepth).ok, true, `${treadDepth} should be accepted`);
  }
});

test('rejects a ring the offset primitive refuses', () => {
  // A U-shaped deck with a 24" slot. The slot walls face each other, so stepping them
  // "outward" drives them into the slot; past 12" of tread they cross.
  const boundary = createDeckBoundary([
    { x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 96 }, { x: 72, y: 96 },
    { x: 72, y: 24 }, { x: 48, y: 24 }, { x: 48, y: 96 }, { x: 0, y: 96 },
  ], { idFactory: ids() });
  const result = solvePyramidStair({
    boundary,
    steppingEdgeIds: [boundary.edges[3].id, boundary.edges[5].id],
    totalRise: 36,
    treadDepth: 16.8,
  });
  assertRejected(result, 'Step 2');
});

test('createPyramidStair returns a serializable object and does not mutate the boundary', () => {
  const boundary = rectangle();
  const before = JSON.stringify(boundary);
  const solution = solvePyramidStair({
    boundary,
    steppingEdgeIds: [boundary.edges[0].id, boundary.edges[1].id, boundary.edges[3].id],
    totalRise: 36,
    treadDepth: 22.5,
  });
  assert.equal(solution.ok, true);
  assert.equal(JSON.stringify(boundary), before, 'solvePyramidStair must not touch the boundary');

  const makeId = ids();
  const pyramid = createPyramidStair(boundary, solution, { name: 'Backyard pyramid' }, makeId);
  assert.equal(JSON.stringify(boundary), before, 'createPyramidStair must not touch the boundary');

  assert.equal(pyramid.type, PYRAMID_STAIR_TYPE);
  assert.equal(pyramid.schemaVersion, PYRAMID_STAIR_SCHEMA_VERSION);
  assert.equal(pyramid.id, 'pyramid-stair-1');
  assert.equal(pyramid.name, 'Backyard pyramid');
  assert.deepEqual(pyramid.host, { boundaryId: boundary.id });
  assert.deepEqual(pyramid.steppingEdgeIds, [boundary.edges[0].id, boundary.edges[1].id, boundary.edges[3].id]);
  assert.equal(pyramid.dimensions.totalRise, 36);
  assert.equal(pyramid.dimensions.riserCount, 5);
  assert.equal(pyramid.dimensions.ringCount, 4);
  assert.equal(pyramid.dimensions.treadDepth, 22.5);
  close(pyramid.dimensions.footprint.widthInches, 192 + 2 * 3 * 22.5, 1e-9);
  assert.equal(pyramid.geometry.ownership, 'pyramid-stair');
  assert.equal(pyramid.geometry.rings.length, 4);
  assert.deepEqual(pyramid.lifecycle, { phase: 'established', revision: 1, needsReview: false, reviewReason: null });
  assert.deepEqual(JSON.parse(JSON.stringify(pyramid)), pyramid, 'pyramid must round-trip through JSON');

  // Ring vertices are owned by the pyramid, not shared with the boundary or the solution.
  pyramid.geometry.rings[0].vertices[0].x = 9999;
  assert.equal(JSON.stringify(boundary), before);
  assert.equal(solution.rings[0].vertices[0].x, 0);

  assert.equal(createPyramidStair(boundary, solution, {}, ids()).name, 'Pyramid stairs');
  assert.throws(() => createPyramidStair(boundary, { ok: false, reason: 'No stepping edges.' }, {}, ids()), /No stepping edges\./);
});

test('warnings surface on the created pyramid as a review flag', () => {
  const boundary = rectangle();
  const solution = solvePyramidStair({ boundary, steppingEdgeIds: [boundary.edges[0].id], totalRise: 10, treadDepth: 8 });
  assert.equal(solution.ok, true);
  assert.equal(solution.warnings.length, 3, 'shallow risers, shallow treads and a straight run');
  const pyramid = createPyramidStair(boundary, solution, {}, ids());
  assert.equal(pyramid.lifecycle.needsReview, true);
  assert.equal(pyramid.lifecycle.reviewReason, solution.warnings.join(' '));
});
