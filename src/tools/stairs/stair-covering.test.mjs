import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, upsertObject, parseProject, serializeProject } from '../../core/document/project-document.js';
import { createDeckBoundary } from '../deck-boundary/deck-boundary.js';
import { attachStairToBoundary, calculateStairDragLayout, calculateStairLayout, updateStairDimensions } from './stair.js';
import { deriveStairCovering, getStairCoveringStyle, planStairRiserFasciaStock, setStairCoveringStyle } from './stair-covering.js';
import { renderStairCoveringControls } from './stair-covering-controls.js';
import { createTakeoffExport, deriveAutomaticTakeoff, getEffectiveTakeoffLines, updateTakeoffLine } from '../takeoff/takeoff.js';

const sample = (style = 'picture-frame') => ({ id: 'stairs-1', type: 'stair', covering: { schemaVersion: 1, style }, dimensions: { width: 48, treadDepth: 11, totalRun: 33, totalRise: 24, riserCount: 4, treadCount: 3 } });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('pictureframe measures inner strip, 45 degree front/returns, risers and sloped side fascia', () => {
  const covering = deriveStairCovering(sample());
  assert.equal(covering.innerStripLengthInches, 37);
  assert.equal(covering.outerFrameLengthInches, 70);
  assert.deepEqual(covering.treadCuts.map((cut) => [cut.lengthInches, cut.quantity, cut.cutAngle]), [[37, 3, 90], [48, 3, 45], [11, 6, 45]]);
  assert.equal(covering.squareShoulderLinearFeet, 26.75);
  assert.equal(covering.riserFasciaLinearFeet, 16);
  close(covering.sideFasciaLinearFeet, 2 * (Math.hypot(33, 24) + 16) / 12);
});

test('square cut uses two full width strips and two run-plus-16 side fascia cuts', () => {
  const covering = deriveStairCovering(sample('square-cut'));
  assert.equal(covering.squareShoulderLinearFeet, 24);
  assert.equal(covering.riserFasciaLinearFeet, 16);
  assert.equal(covering.sideLengthInches, 49);
  assert.deepEqual(covering.treadCuts, [{ role: 'square-cut-tread', lengthInches: 48, quantity: 6, cutAngle: 90 }]);
  close(covering.sideFasciaLinearFeet, 98 / 12);
});

test('new stairs default to 11 inch treads and pictureframe without changing an existing tread', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 144, y: 0 }, { x: 144, y: 144 }, { x: 0, y: 144 }]);
  const created = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 48, totalRise: 24 });
  assert.equal(created.stair.dimensions.treadDepth, 11);
  assert.equal(created.stair.dimensions.totalRun, 33);
  assert.equal(created.stair.covering.style, 'picture-frame');
  assert.equal(calculateStairLayout(24).treadDepth, 11);
  assert.equal(calculateStairDragLayout(24).treadDepth, 11);
  const old = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 48, totalRise: 24, treadDepth: 10.5 });
  const { covering, ...legacy } = old.stair;
  assert.equal(getStairCoveringStyle(legacy), 'picture-frame');
  const changed = setStairCoveringStyle(legacy, 'square-cut');
  assert.equal(changed.dimensions.treadDepth, 10.5);
  assert.deepEqual(changed.geometry, legacy.geometry);
  assert.deepEqual(created.boundary, boundary);
});

test('covering selection persists through save and tread editing while host boundary stays unchanged', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 144, y: 0 }, { x: 144, y: 144 }, { x: 0, y: 144 }]);
  const created = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 48, totalRise: 24, covering: { style: 'square-cut' } });
  const restored = parseProject(serializeProject(upsertObject(createProjectDocument(), created.stair))).objects[0];
  assert.equal(getStairCoveringStyle(restored), 'square-cut');
  const edited = updateStairDimensions(boundary, restored, { treadDepth: 10 });
  assert.equal(edited.stair.dimensions.totalRun, 30);
  assert.equal(getStairCoveringStyle(edited.stair), 'square-cut');
  assert.equal(deriveStairCovering(edited.stair).sideLengthInches, 46);
  assert.deepEqual(edited.boundary, boundary);
  const framed = deriveStairCovering(setStairCoveringStyle(edited.stair, 'picture-frame'));
  assert.equal(framed.outerFrameLengthInches, 68);
  assert.equal(framed.squareShoulderLinearFeet, 26.25);
});

test('stair covering selector exposes both styles and the effective selection', () => {
  const html = renderStairCoveringControls(sample('square-cut'));
  assert.match(html, /id="stair-covering-style"/);
  assert.match(html, /Pictureframe stairs/);
  assert.match(html, /value="square-cut" selected/);
  assert.match(html, /Square cut stairs/);
  assert.match(html, /90°/);
  assert.throws(() => setStairCoveringStyle(sample(), 'unsupported'), /supported/);
});

test('takeoff replaces legacy grooved/riser boards, applies configured stocks and waste once', () => {
  const document = upsertObject(createProjectDocument(), sample());
  const lines = deriveAutomaticTakeoff(document);
  const cover = lines.filter((line) => line.category === 'stairs');
  assert.equal(cover.length, 3);
  assert.ok(!cover.some((line) => /grooved|square-riser|square-nose/.test(line.id)));
  const treads = cover.find((line) => line.id.endsWith('square-shoulder-treads'));
  assert.equal(treads.requiredLinearFeet, 26.75);
  assert.equal(treads.stockLengthFeet, 16);
  assert.equal(treads.quantity, 2);
  assert.equal(treads.wastePercent, 10);
  assert.equal(cover.find((line) => line.id === 'auto:stairs:fascia-risers:12').quantity, 2);
  assert.equal(cover.find((line) => line.id.endsWith('fascia-sides')).quantity, 1);
  const custom = { ...document, takeoff: { settings: { wastePercent: 0, squareEdgeStockFeet: 12, fasciaStockFeet: 16 } } };
  assert.equal(deriveAutomaticTakeoff(custom).find((line) => line.id === treads.id).quantity, 3);
  const framed = lines.filter((line) => line.category === 'framing');
  const squareFraming = deriveAutomaticTakeoff(upsertObject(document, sample('square-cut'))).filter((line) => line.category === 'framing');
  assert.deepEqual(squareFraming.find((line) => line.id.includes(':ledger:')), framed.find((line) => line.id.includes(':ledger:')));
  assert.ok(framed.find((line) => line.id.includes(':stringer:')).quantity > squareFraming.find((line) => line.id.includes(':stringer:')).quantity);
  assert.ok(framed.some((line) => line.id.includes(':lower-closure:')));
  assert.ok(!squareFraming.some((line) => /lower-closure|bottom-tie/.test(line.id)));
});

test('mixed styles aggregate actual quantities and preserve overrides and price-free supplier export', () => {
  let document = upsertObject(upsertObject(createProjectDocument(), sample()), { ...sample('square-cut'), id: 'stairs-2' });
  const id = 'auto:stairs:square-shoulder-treads';
  assert.equal(deriveAutomaticTakeoff(document).find((line) => line.id === id).requiredLinearFeet, 50.75);
  document = updateTakeoffLine(document, id, { quantity: 7, unitPrice: 42 });
  const restored = parseProject(serializeProject(document));
  const line = getEffectiveTakeoffLines(restored).find((entry) => entry.id === id);
  assert.equal(line.quantity, 7);
  assert.equal(line.calculatedQuantity, 4);
  assert.equal(line.unitPrice, 42);
  const supplier = createTakeoffExport(restored, { includePrices: false });
  assert.equal(supplier.lines.find((entry) => entry.id === id).unitPrice, undefined);
  assert.equal(deriveAutomaticTakeoff(createProjectDocument()).filter((entry) => entry.category === 'stairs').length, 0);
});

test('four 3 ft risers report 12 LF net and buy one 16 ft fascia board in either style', () => {
  for (const style of ['picture-frame', 'square-cut']) {
    const stair = sample(style);
    stair.dimensions.width = 36;
    const document = upsertObject(createProjectDocument(), stair);
    const lines = deriveAutomaticTakeoff(document);
    const risers = lines.filter((line) => line.id.startsWith('auto:stairs:fascia-risers:'));
    assert.equal(risers.length, 1);
    assert.equal(risers[0].stockLengthFeet, 16);
    assert.equal(risers[0].quantity, 1);
    assert.equal(risers[0].requiredLinearFeet, 12);
    assert.match(risers[0].specification, /4 risers × 3 ft/);
    assert.match(risers[0].specification, /risers only/);
    assert.ok(lines.some((line) => line.id === 'auto:stairs:fascia-sides'));
    stair.dimensions.totalRise = 60;
    stair.dimensions.totalRun = 100;
    assert.deepEqual(deriveAutomaticTakeoff(upsertObject(document, stair)).filter((line) => line.id.startsWith('auto:stairs:fascia-risers:')), risers);
  }
});

test('exact commercial riser totals still leave reserve at zero waste', () => {
  const stair = sample();
  stair.dimensions.width = 36;
  const plan = planStairRiserFasciaStock([deriveStairCovering(stair)], { wastePercent: 0 });
  assert.deepEqual(plan.pieces.map((piece) => piece.stockLengthFeet), [16]);
  assert.equal(plan.pieces[0].usedFeet, 12);
});

test('riser fascia keeps wide cuts continuous and total net length independent of purchase reserve', () => {
  const stair = sample();
  stair.dimensions.width = 114;
  stair.dimensions.riserCount = 3;
  const plan = planStairRiserFasciaStock([deriveStairCovering(stair)]);
  assert.equal(plan.pieces.length, 3, 'three 9.5 ft cuts cannot come from two 16 ft boards');
  assert.equal(plan.pieces.reduce((sum, piece) => sum + piece.usedFeet, 0), 28.5);
  for (const piece of plan.pieces) assert.ok(piece.usedFeet <= piece.stockLengthFeet);
  stair.dimensions.width = 240;
  const lines = deriveAutomaticTakeoff(upsertObject(createProjectDocument(), stair));
  const review = lines.find((line) => line.id === 'auto:stairs:fascia-risers:review');
  assert.equal(review.quantity, 3);
  assert.equal(review.requiredLinearFeet, 60);
  assert.equal(review.stockLengthFeet, null);
});

test('length-specific riser rows preserve overrides in save/load and supplier exports', () => {
  const stair = sample();
  stair.dimensions.width = 36;
  const id = 'auto:stairs:fascia-risers:16';
  const document = updateTakeoffLine(upsertObject(createProjectDocument(), stair), id, { quantity: 2, unitPrice: 50 });
  const restored = parseProject(serializeProject(document));
  const line = getEffectiveTakeoffLines(restored).find((entry) => entry.id === id);
  assert.equal(line.quantity, 2);
  assert.equal(line.calculatedQuantity, 1);
  assert.equal(line.requiredLinearFeet, 12);
  const exported = createTakeoffExport(restored, { includePrices: false }).lines.find((entry) => entry.id === id);
  assert.equal(exported.unitPrice, undefined);
  assert.match(exported.specification, /16 ft board/);
});
