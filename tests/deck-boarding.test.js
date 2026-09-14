import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { clearDeckBoardingDirection, DEFAULT_BOARD_GAP, deriveDeckBoardingSegments, getDeckBoarding, rotateDeckBoardingDirection, setDeckBoardingCurve, setDeckBoardingDirection } from '../src/tools/deck-boarding/deck-boarding.js';
import { getBoundaryArc } from '../src/core/geometry/circular-arc.js';
import { setArchLineSagitta } from '../src/tools/arch-line/arch-line.js';

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

test('a curved Deck Boundary edge creates concentric clipped decking rows', () => {
  let boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }], { idFactory: ids() });
  const edgeId = boundary.edges[1].id;
  boundary = setArchLineSagitta(boundary, edgeId, -24);
  const arc = getBoundaryArc(boundary, edgeId);
  const directed = setDeckBoardingCurve(boundary, arc, { kind: 'boundary-arc', id: arc.id, ownerId: boundary.id });
  const boarding = getDeckBoarding(directed);
  const segments = deriveDeckBoardingSegments(directed);
  assert.equal(boarding.pattern, 'curved');
  assert.equal(boarding.reference.id, arc.id);
  assert.ok(segments.length > 3);
  assert.ok(segments.every((segment) => segment.curved && segment.points.length > 1));
  const radii = [...new Set(segments.map((segment) => segment.radius))].sort((a, b) => a - b);
  assert.ok(radii.length > 2);
  assert.ok(Math.abs(radii[1] - radii[0] - (boarding.boardWidth + boarding.gap)) < 1e-8);
  assert.doesNotThrow(() => JSON.stringify(directed));
});
