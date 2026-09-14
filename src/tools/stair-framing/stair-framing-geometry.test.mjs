import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStairFramingGeometry } from './stair-framing-geometry.js';
import { deriveStairFraming, describeStairFramingTakeoff } from './stair-framing.js';

function fixture(width = 36) {
  return { id: 'stairs', type: 'stair', covering: { style: 'square-cut' }, dimensions: { width, totalRun: 33, totalRise: 28, treadCount: 3, riserCount: 4 },
    anchors: { openingStartVertexId: 'a', openingEndVertexId: 'b', outerStartVertexId: 'c', outerEndVertexId: 'd' },
    geometry: { vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: width, y: 0 }, { id: 'c', x: 0, y: 33 }, { id: 'd', x: width, y: 33 }] } };
}

test('plan view matches takeoff: one ledger, two sides and internal stringers at <=12 inches', () => {
  for (const width of [36, 49, 72]) {
    const stair = fixture(width);
    const members = deriveStairFramingGeometry(null, stair);
    const framing = deriveStairFraming(stair);
    assert.equal(members.length, framing.stringerCount + 1);
    assert.equal(members.filter((m) => m.role === 'side-stringer').length, 2);
    assert.equal(members.filter((m) => m.role === 'internal-stringer').length, framing.internalStringerCount);
    assert.deepEqual(members.at(-1), { role: 'ledger', material: '2×12 PT', start: { x: 0, y: 0 }, end: { x: width, y: 0 } });
    members.slice(0, -1).forEach((m, i) => {
      assert.equal(m.start.y, 0);
      assert.equal(m.end.y, 33);
      assert.equal(m.start.x, m.end.x);
      if (i) assert.ok(m.start.x - members[i - 1].start.x <= 12 + 1e-8);
    });
  }
});

test('framing visibility controls stairs independently from joist or decking visibility', () => {
  assert.deepEqual(deriveStairFramingGeometry(null, fixture(), { visible: false }), []);
  assert.equal(deriveStairFramingGeometry(null, fixture(), { visible: true, joistsVisible: false }).length, 5);
});

test('rotated and mirrored stairs follow their anchors, including legacy boundary vertices', () => {
  const original = fixture();
  const expected = deriveStairFramingGeometry(null, original);
  for (const angle of [Math.PI / 2, Math.PI / 4, Math.PI]) {
    for (const mirror of [1, -1]) {
      const at = (p) => ({ x: 80 + p.x * Math.cos(angle) - mirror * p.y * Math.sin(angle), y: -12 + p.x * Math.sin(angle) + mirror * p.y * Math.cos(angle) });
      const stair = fixture();
      const vertices = stair.geometry.vertices.map((p) => ({ id: p.id, ...at(p) }));
      delete stair.geometry;
      deriveStairFramingGeometry({ vertices }, stair).forEach((member, i) => {
        for (const endpoint of ['start', 'end']) {
          const target = at(expected[i][endpoint]);
          assert.ok(Math.hypot(member[endpoint].x - target.x, member[endpoint].y - target.y) < 1e-8);
        }
      });
    }
  }
});

test('display geometry is non-mutating and does not add any takeoff quantities', () => {
  const stair = fixture();
  const before = structuredClone(stair);
  const takeoff = describeStairFramingTakeoff({ objects: [stair] });
  deriveStairFramingGeometry(null, stair);
  assert.deepEqual(stair, before);
  assert.deepEqual(describeStairFramingTakeoff({ objects: [stair] }), takeoff);
  assert.deepEqual(deriveStairFramingGeometry(null, null), []);
  const invalid = fixture();
  invalid.geometry.vertices.pop();
  assert.deepEqual(deriveStairFramingGeometry(null, invalid), []);
  const zero = fixture(0);
  assert.deepEqual(deriveStairFramingGeometry(null, zero), []);
});

test('pictureframe plan uses exact offsets and closes the lower riser opposite the ledger', () => {
  const stair = fixture();
  stair.covering.style = 'picture-frame';
  const members = deriveStairFramingGeometry(null, stair);
  const stringers = members.filter((member) => member.role.includes('stringer'));
  assert.deepEqual(stringers.map((member) => member.start.x), [0, 6.5, 18, 29.5, 36]);
  const closure = members.find((member) => member.role === 'lower-closure');
  assert.deepEqual(closure, { role: 'lower-closure', material: '2×8 PT', start: { x: 0, y: 33 }, end: { x: 36, y: 33 } });
  assert.equal(members.length, deriveStairFraming(stair).stringerCount + 2);
  assert.deepEqual(deriveStairFramingGeometry(null, stair, { visible: false }), []);
  const transformed = structuredClone(stair);
  transformed.geometry.vertices = stair.geometry.vertices.map((p) => ({ id: p.id, x: 50 + p.y, y: 10 - p.x }));
  deriveStairFramingGeometry(null, transformed).forEach((member, i) => {
    for (const end of ['start', 'end']) assert.deepEqual(member[end], { x: 50 + members[i][end].y, y: 10 - members[i][end].x });
  });
});
