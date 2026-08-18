import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { clearDeckBoardingDirection, DEFAULT_BOARD_GAP, deriveDeckBoardingSegments, getDeckBoarding, rotateDeckBoardingDirection, setDeckBoardingDirection } from '../src/tools/deck-boarding/deck-boarding.js';

function ids() { let count = 0; return (prefix) => `${prefix}-${++count}`; }

test('stores a serializable board direction from a construction line', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 60 }, { x: 0, y: 60 }], { idFactory: ids() });
  const directed = setDeckBoardingDirection(boundary, { x: 0, y: 0 }, { x: 120, y: 0 }, { kind: 'boundary-edge', id: boundary.edges[0].id });
  const boarding = getDeckBoarding(directed);
  assert.equal(boarding.reference.id, boundary.edges[0].id);
  assert.equal(boarding.angleRadians, 0);
  assert.equal(boarding.boardWidth, 5.5);
  assert.equal(boarding.gap, DEFAULT_BOARD_GAP);
  assert.doesNotThrow(() => JSON.stringify(directed));
});

test('derives clipped board lines and removes stair footprint intervals', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 60 }, { x: 0, y: 60 }], { idFactory: ids() });
  const directed = setDeckBoardingDirection(boundary, { x: 0, y: 0 }, { x: 120, y: 0 });
  const withoutExclusion = deriveDeckBoardingSegments(directed);
  const withExclusion = deriveDeckBoardingSegments(directed, [[{ x: 40, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 60 }, { x: 40, y: 60 }]]);
  assert.ok(withoutExclusion.length > 5);
  assert.ok(withExclusion.length > withoutExclusion.length);
  assert.ok(withExclusion.every((segment) => segment.start.x >= -1e-8 && segment.end.x <= 120 + 1e-8));
  assert.ok(withExclusion.every((segment) => segment.end.x <= 40 + 1e-7 || segment.start.x >= 80 - 1e-7));
});

test('rotates board direction by 90 degrees and clears it independently', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 60 }, { x: 0, y: 60 }], { idFactory: ids() });
  const directed = setDeckBoardingDirection(boundary, { x: 0, y: 0 }, { x: 120, y: 0 });
  assert.equal(rotateDeckBoardingDirection(directed).metadata.deckBoarding.angleRadians, Math.PI / 2);
  assert.equal(getDeckBoarding(clearDeckBoardingDirection(directed)), null);
});
