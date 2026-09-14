import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStairFraming, describeStairFramingTakeoff } from './stair-framing.js';

const stair = (overrides = {}) => ({
  id: overrides.id ?? 'stair-1',
  type: 'stair',
  covering: { style: overrides.style ?? 'square-cut' },
  dimensions: { width: 36, totalRise: 24, totalRun: 31.5, riserCount: 4, treadCount: 3, ...overrides.dimensions },
});

test('stair framing places two side stringers plus internal 2x12 PT stringers at 12 inches maximum', () => {
  const framing = deriveStairFraming(stair());
  assert.equal(framing.stringerCount, 4);
  assert.equal(framing.sideStringerCount, 2);
  assert.equal(framing.internalStringerCount, 2);
  assert.equal(framing.actualSpacingInches, 12);
  assert.equal(framing.material, '2×12 PT');
  assert.equal(framing.stringerStockLengthFeet, 8);
  assert.deepEqual(framing.ledgerStockPieces, [8]);
});

test('nonmodular stair widths tighten the layout instead of exceeding 12 inches', () => {
  const framing = deriveStairFraming(stair({ dimensions: { width: 49 } }));
  assert.equal(framing.stringerCount, 6);
  assert.equal(framing.internalStringerCount, 4);
  assert.ok(Math.abs(framing.actualSpacingInches - 9.8) < 1e-8);
  assert.ok(framing.actualSpacingInches <= 12);
});

test('takeoff counts continuous stringer stock and one measured stair ledger/header', () => {
  const lines = describeStairFramingTakeoff({ objects: [stair()] });
  const stringers = lines.find((line) => line.id === 'auto:stairs:stringer:8');
  const ledger = lines.find((line) => line.id === 'auto:stairs:ledger:8');
  assert.equal(stringers.quantity, 4);
  assert.equal(stringers.description, '2×12 PT stair stringer');
  assert.equal(ledger.quantity, 1);
  assert.equal(ledger.description, '2×12 PT stair ledger / header');
});

test('a stringer longer than commercial stock remains visible as a review item', () => {
  const long = stair({ dimensions: { width: 36, totalRise: 144, totalRun: 240 } });
  const framing = deriveStairFraming(long);
  assert.equal(framing.stringerStockLengthFeet, null);
  assert.equal(framing.needsReview, true);
  const [line] = describeStairFramingTakeoff({ objects: [long] }).filter((entry) => entry.id.includes(':review:'));
  assert.equal(line.quantity, 4);
  assert.equal(line.confidence, 'review');
});

test('pictureframe fixes the support pair at 6.5 inches and subdivides the middle at <=12 inches', () => {
  const framing = deriveStairFraming(stair({ style: 'picture-frame' }));
  assert.deepEqual(framing.stringerOffsetsInches, [0, 6.5, 18, 29.5, 36]);
  assert.equal(framing.stringerCount, 5);
  assert.equal(framing.actualSpacingInches, 11.5);
  for (const width of [24, 37, 48, 49, 96, 120]) {
    const layout = deriveStairFraming(stair({ style: 'picture-frame', dimensions: { width } }));
    const offsets = layout.stringerOffsetsInches;
    assert.equal(offsets[1], 6.5);
    assert.equal(offsets.at(-2), width - 6.5);
    assert.equal(new Set(offsets).size, offsets.length);
    offsets.slice(1).forEach((x, i) => assert.ok(x - offsets[i] <= 12 + 1e-8));
  }
});

test('pictureframe lower closure and sole plate use full-width commercial stock, grouped by role', () => {
  const a = stair({ style: 'picture-frame', id: 'a', dimensions: { width: 112 } });
  const b = stair({ style: 'picture-frame', id: 'b', dimensions: { width: 112 } });
  const square = stair({ id: 'square' });
  const lines = describeStairFramingTakeoff({ objects: [a, b, square] });
  for (const [role, material] of [['lower-closure', '2×8 PT'], ['bottom-tie', '2×4 PT']]) {
    const line = lines.find((entry) => entry.id === `auto:stairs:${role}:10`);
    assert.equal(line.quantity, 2);
    assert.equal(line.stockLengthFeet, 10);
    assert.ok(line.description.startsWith(material));
    assert.deepEqual(line.sourceObjectIds, ['a', 'b']);
  }
  assert.deepEqual(deriveStairFraming(square).lowerMembers, []);
});

test('overwide lower members require review rather than silently splicing stock', () => {
  const wide = stair({ style: 'picture-frame', dimensions: { width: 250 } });
  const framing = deriveStairFraming(wide);
  assert.equal(framing.needsReview, true);
  assert.ok(framing.lowerMembers.every((member) => member.stockLengthFeet === null));
  const lines = describeStairFramingTakeoff({ objects: [wide] });
  assert.equal(lines.filter((line) => /lower-closure|bottom-tie/.test(line.id) && line.confidence === 'review').length, 2);
  const narrow = deriveStairFraming(stair({ style: 'picture-frame', dimensions: { width: 13 } }));
  assert.equal(narrow.needsReview, true);
  assert.deepEqual(narrow.stringerOffsetsInches, [0, 6.5, 13]);
});
