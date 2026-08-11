import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevelDown, setLevelDownRiserHeight, splitLevelDownSegment } from '../src/tools/level-down/level-down.js';

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
