import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, upsertObject } from '../src/core/document/project-document.js';
import { getBoundaryLevelDown, getProjectSurfaceArea, setBoundaryLevelDown, translateDeckAssembly } from '../src/core/construction-objects/multi-deck-project.js';
import { createDeckBoundary, setVertexLocked } from '../src/tools/deck-boundary/deck-boundary.js';
import { createLevelDown } from '../src/tools/level-down/level-down.js';

const rectangle = (x, width, height) => createDeckBoundary([{ x, y: 0 }, { x: x + width, y: 0 }, { x: x + width, y: height }, { x, y: height }]);

test('project surface area is the sum of every Deck Boundary', () => {
  let document = createProjectDocument();
  document = upsertObject(document, rectangle(0, 120, 120));
  document = upsertObject(document, rectangle(180, 60, 120));
  assert.equal(getProjectSurfaceArea(document), 21_600);
});

test('a Deck Boundary owns a serializable down level', () => {
  const lowered = setBoundaryLevelDown(rectangle(0, 120, 120), 18);
  assert.equal(getBoundaryLevelDown(lowered), 18);
  assert.ok(lowered.vertices.every((vertex) => vertex.elevation === -18));
});

test('moving a Deck Boundary translates hosted Level Down geometry', () => {
  const boundary = rectangle(0, 120, 120);
  const levelDown = createLevelDown([
    { x: 0, y: 20, anchor: { snapType: 'edge', boundaryId: boundary.id, edgeId: boundary.edges[3].id, edgeKind: 'boundary-edge' } },
    { x: 120, y: 20, anchor: { snapType: 'edge', boundaryId: boundary.id, edgeId: boundary.edges[1].id, edgeKind: 'boundary-edge' } },
  ], { boundaryId: boundary.id });
  let document = upsertObject(upsertObject(createProjectDocument(), boundary), levelDown);
  document = translateDeckAssembly(document, boundary.id, { x: 24, y: -12 });
  const movedBoundary = document.objects.find((object) => object.id === boundary.id);
  const movedLevel = document.objects.find((object) => object.id === levelDown.id);
  assert.deepEqual({ x: movedBoundary.vertices[0].x, y: movedBoundary.vertices[0].y }, { x: 24, y: -12 });
  assert.deepEqual({ x: movedLevel.vertices[0].x, y: movedLevel.vertices[0].y }, { x: 24, y: 8 });
});

test('moving a complete Deck Boundary respects geometry locks', () => {
  const boundary = rectangle(0, 120, 120);
  const locked = setVertexLocked(boundary, boundary.vertices[0].id, true);
  const document = upsertObject(createProjectDocument(), locked);
  assert.throws(() => translateDeckAssembly(document, boundary.id, { x: 12, y: 0 }), /unlock/i);
});

test('a cross-deck staircase constrains independent assembly movement', () => {
  const upper = rectangle(0, 120, 120);
  const lower = rectangle(180, 120, 120);
  let document = upsertObject(upsertObject(createProjectDocument(), upper), lower);
  document = upsertObject(document, { type: 'stair', id: 'stair-between-decks', host: { boundaryId: upper.id }, destination: { boundaryId: lower.id, edgeId: lower.edges[0].id } });
  assert.throws(() => translateDeckAssembly(document, upper.id, { x: 12, y: 0 }), /connected staircase/i);
  assert.throws(() => translateDeckAssembly(document, lower.id, { x: 12, y: 0 }), /connected staircase/i);
});
