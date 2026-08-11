import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevelDown, deriveLevelDownDepth, deriveLevelDownRegion, orthogonalizeLevelDown, setLevelDownRiserHeight, splitLevelDownSegment, updateLevelDownProperties } from '../src/tools/level-down/level-down.js';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';

function ids() {
  let counter = 0;
  return (prefix) => `${prefix}-${++counter}`;
}

const edgeAnchor = (x, y, edgeId) => ({ x, y, anchor: { snapType: 'edge', edgeId, point: { x, y } } });

test('creates a serializable boundary-to-boundary Level Down polyline', () => {
  const levelDown = createLevelDown([
    edgeAnchor(0, 20, 'edge-a'),
    { x: 40, y: 40, anchor: { snapType: 'grid', point: { x: 40, y: 40 } } },
    edgeAnchor(96, 20, 'edge-b'),
  ], { boundaryId: 'deck-1' }, ids());
  assert.equal(levelDown.type, 'level-down');
  assert.equal(levelDown.host.boundaryId, 'deck-1');
  assert.equal(levelDown.segments.length, 2);
  assert.equal(levelDown.dimensions.riserHeight, 7.5);
  assert.doesNotThrow(() => JSON.stringify(levelDown));
});

test('requires both endpoints to attach to construction geometry', () => {
  assert.throws(() => createLevelDown([
    { x: 0, y: 0, anchor: { snapType: 'grid', point: { x: 0, y: 0 } } },
    edgeAnchor(24, 0, 'edge-b'),
  ], {}, ids()), /begin and end/i);
});

test('updates one shared riser for every section', () => {
  const source = createLevelDown([edgeAnchor(0, 0, 'edge-a'), edgeAnchor(96, 0, 'edge-b')], {}, ids());
  const updated = setLevelDownRiserHeight(source, 6.75);
  assert.equal(updated.dimensions.riserHeight, 6.75);
  assert.equal(updated.lifecycle.revision, 2);
  assert.throws(() => setLevelDownRiserHeight(source, 13), /between/i);
});

test('divides a selected Level Down section without changing its owner or riser', () => {
  const source = createLevelDown([edgeAnchor(0, 0, 'edge-a'), edgeAnchor(96, 0, 'edge-b')], {}, ids());
  const divided = splitLevelDownSegment(source, source.segments[0].id, 3, ids());
  assert.equal(divided.segments.length, 3);
  assert.equal(divided.vertices.length, 4);
  assert.equal(divided.segments[0].id, source.segments[0].id);
  assert.ok(divided.segments.every((segment) => segment.ownerId === source.id));
  assert.equal(divided.dimensions.riserHeight, 7.5);
});

test('derives a selectable lowered region inside or outside the boundary', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], { idFactory: ids() });
  const inside = createLevelDown([edgeAnchor(50, 0, boundary.edges[0].id), edgeAnchor(50, 100, boundary.edges[2].id)], { boundaryId: boundary.id }, ids());
  assert.equal(deriveLevelDownRegion(inside, boundary).areaSquareInches, 5_000);
  const outside = createLevelDown([
    edgeAnchor(0, 20, boundary.edges[3].id),
    { x: -40, y: 50, anchor: { snapType: 'grid', point: { x: -40, y: 50 } } },
    edgeAnchor(0, 80, boundary.edges[3].id),
  ], { boundaryId: boundary.id }, ids());
  assert.equal(deriveLevelDownRegion(outside, boundary).areaSquareInches, 1_200);
});

test('supports lowered-area side, fascia, and picture-frame properties', () => {
  const source = createLevelDown([edgeAnchor(0, 0, 'edge-a'), edgeAnchor(96, 48, 'edge-b')], {}, ids());
  const updated = updateLevelDownProperties(source, { regionSide: 'larger', finishes: { fascia: true, pictureFrame: true } });
  assert.equal(updated.properties.regionSide, 'larger');
  assert.equal(updated.properties.finishes.fascia, true);
  assert.equal(updated.properties.finishes.pictureFrame, true);
});

test('converts diagonal lowered-area lines into 90-degree construction segments', () => {
  const source = createLevelDown([edgeAnchor(0, 0, 'edge-a'), edgeAnchor(96, 48, 'edge-b')], {}, ids());
  const aligned = orthogonalizeLevelDown(source, ids());
  assert.equal(aligned.segments.length, 2);
  assert.deepEqual(aligned.vertices[0].anchor, source.vertices[0].anchor);
  assert.deepEqual(aligned.vertices.at(-1).anchor, source.vertices.at(-1).anchor);
  assert.ok(aligned.segments.every((segment, index) => {
    const start = aligned.vertices[index];
    const end = aligned.vertices[index + 1];
    return start.x === end.x || start.y === end.y;
  }));
});

test('accumulates nested level changes from the main deck elevation', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], { idFactory: makeId });
  const outer = createLevelDown([edgeAnchor(25, 0, boundary.edges[0].id), edgeAnchor(25, 100, boundary.edges[2].id)], { boundaryId: boundary.id }, makeId);
  const inner = createLevelDown([edgeAnchor(10, 0, boundary.edges[0].id), edgeAnchor(10, 100, boundary.edges[2].id)], { boundaryId: boundary.id }, makeId);
  assert.equal(deriveLevelDownDepth(outer, [outer, inner], boundary), 7.5);
  assert.equal(deriveLevelDownDepth(inner, [outer, inner], boundary), 15);
});
