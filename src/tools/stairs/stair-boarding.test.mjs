import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStairBoardingSeams } from './stair-boarding.js';
import { deriveAutomaticTakeoff } from '../takeoff/takeoff.js';
import { createProjectDocument, upsertObject } from '../../core/document/project-document.js';

function fixture(style = 'square-cut', depth = 11) {
  return {
    id: 'stair-pattern', type: 'stair', covering: { style },
    dimensions: { width: 36, totalRise: 24, totalRun: depth * 3, treadDepth: depth, riserCount: 4, treadCount: 3 },
    anchors: { openingStartVertexId: 'a', outerStartVertexId: 'b', outerEndVertexId: 'c', openingEndVertexId: 'd' },
    geometry: { vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: depth * 3 }, { id: 'c', x: 36, y: depth * 3 }, { id: 'd', x: 36, y: 0 }] },
  };
}

test('square cut draws one full-width seam per tread, creating two straight boards', () => {
  const seams = deriveStairBoardingSeams(null, fixture());
  assert.equal(seams.length, 3);
  seams.forEach((seam, i) => {
    assert.equal(seam.role, 'board-joint');
    assert.deepEqual(seam.start, { x: 0, y: 5.5 + i * 11 });
    assert.deepEqual(seam.end, { x: 36, y: 5.5 + i * 11 });
  });
});

test('board width starts at each nosing, not at the riser for custom tread depth', () => {
  const seams = deriveStairBoardingSeams(null, fixture('square-cut', 10));
  assert.deepEqual(seams.map((seam) => seam.start.y), [4.5, 14.5, 24.5]);
});

test('pictureframe draws an inner board and U-shaped frame with two 45-degree nosing joints', () => {
  const seams = deriveStairBoardingSeams(null, fixture('picture-frame'));
  assert.equal(seams.length, 15);
  const first = seams.filter((seam) => seam.treadIndex === 0);
  assert.deepEqual(first.map(({ role, start, end }) => [role, start, end]), [
    ['board-joint', { x: 5.5, y: 5.5 }, { x: 30.5, y: 5.5 }],
    ['left-return', { x: 5.5, y: 0 }, { x: 5.5, y: 5.5 }],
    ['right-return', { x: 30.5, y: 0 }, { x: 30.5, y: 5.5 }],
    ['left-miter', { x: 0, y: 11 }, { x: 5.5, y: 5.5 }],
    ['right-miter', { x: 36, y: 11 }, { x: 30.5, y: 5.5 }],
  ]);
});

test('pattern follows horizontal, vertical, diagonal and mirrored stairs without leaving a tread', () => {
  for (const style of ['picture-frame', 'square-cut']) for (const angle of [0, Math.PI / 2, Math.PI / 4, Math.PI]) for (const mirror of [1, -1]) {
    const stair = fixture(style, 10.5);
    const original = deriveStairBoardingSeams(null, stair);
    const transform = (p) => ({ x: 17 + Math.cos(angle) * p.x * mirror - Math.sin(angle) * p.y, y: -20 + Math.sin(angle) * p.x * mirror + Math.cos(angle) * p.y });
    stair.geometry.vertices = stair.geometry.vertices.map((p) => ({ ...p, ...transform(p) }));
    const moved = deriveStairBoardingSeams(null, stair);
    assert.equal(moved.length, original.length);
    moved.forEach((seam, i) => {
      for (const endpoint of ['start', 'end']) {
        const expected = transform(original[i][endpoint]);
        assert.ok(Math.hypot(expected.x - seam[endpoint].x, expected.y - seam[endpoint].y) < 1e-8);
        const local = original[i][endpoint];
        assert.ok(local.x >= 0 && local.x <= 36);
        assert.ok(local.y >= seam.treadIndex * 10.5 && local.y <= (seam.treadIndex + 1) * 10.5);
      }
    });
  }
});

test('display pattern does not mutate geometry or change takeoff, and supports legacy vertices', () => {
  const stair = fixture('picture-frame');
  const snapshot = JSON.stringify(stair);
  const document = upsertObject(createProjectDocument(), stair);
  const before = deriveAutomaticTakeoff(document);
  const seams = deriveStairBoardingSeams(null, stair);
  assert.equal(JSON.stringify(stair), snapshot);
  assert.deepEqual(deriveAutomaticTakeoff(document), before);
  const { geometry, ...legacy } = stair;
  assert.deepEqual(deriveStairBoardingSeams({ vertices: geometry.vertices }, legacy), seams);
  assert.deepEqual(deriveStairBoardingSeams(null, {}), []);
  assert.deepEqual(deriveStairBoardingSeams(null, { ...stair, dimensions: { treadCount: 0 } }), []);
});
