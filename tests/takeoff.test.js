import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject, upsertObject } from '../src/core/document/project-document.js';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { createJoist } from '../src/tools/joist-group/joist-group.js';
import { analyzeRailingGeometries } from '../src/tools/railing/railing.js';
import { addManualTakeoffLine, consolidateTakeoffLines, createTakeoffExport, deriveAutomaticTakeoff, getEffectiveTakeoffLines, planWildHogHandrailStock, resetTakeoffLine, updateTakeoffLine } from '../src/tools/takeoff/takeoff.js';

const ids = (() => { let next = 0; return (prefix) => `${prefix}-${++next}`; })();

function deckDocument() {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 288, y: 0 }, { x: 288, y: 144 }, { x: 0, y: 144 }], {}, ids);
  boundary.edges[0].properties.finishes.pictureFrame = true;
  boundary.edges[1].properties.finishes.fascia = true;
  return upsertObject(createProjectDocument({ id: 'takeoff-project' }), boundary, '2026-08-18T00:00:00.000Z');
}

test('derives preliminary decking purchase lines from authoritative geometry and edge properties', () => {
  const lines = deriveAutomaticTakeoff(deckDocument());
  assert.equal(lines.find((line) => line.id === 'auto:decking:grooved-field').quantity, 42);
  assert.equal(lines.find((line) => line.id === 'auto:decking:square-picture-frame').requiredLinearFeet, 24);
  assert.equal(lines.find((line) => line.id === 'auto:decking:fascia').requiredLinearFeet, 12);
});

test('keeps calculated quantity while preserving a serializable user override', () => {
  const document = updateTakeoffLine(deckDocument(), 'auto:decking:grooved-field', { quantity: 46, unitPrice: 42.5 });
  const restored = parseProject(serializeProject(document));
  const line = getEffectiveTakeoffLines(restored).find((entry) => entry.id === 'auto:decking:grooved-field');
  assert.equal(line.calculatedQuantity, 42);
  assert.equal(line.quantity, 46);
  assert.equal(line.origin, 'adjusted');
  assert.equal(getEffectiveTakeoffLines(resetTakeoffLine(restored, line.id)).find((entry) => entry.id === line.id).quantity, 42);
});

test('manual materials and supplier exports may omit pricing', () => {
  const document = addManualTakeoffLine(deckDocument(), { category: 'framing', description: 'Pressure treated joist', specification: '2×8×16', quantity: 8, unitPrice: 31.25 }, () => 'manual-1');
  const restored = parseProject(serializeProject(document));
  const supplier = createTakeoffExport(restored, { includePrices: false, now: '2026-08-18T00:00:00.000Z' });
  const internal = createTakeoffExport(restored, { includePrices: true, now: '2026-08-18T00:00:00.000Z' });
  assert.equal(supplier.lines.find((line) => line.id === 'manual-1').unitPrice, undefined);
  assert.equal(internal.lines.find((line) => line.id === 'manual-1').subtotal, 250);
});

test('Wild Hog recipe assigns one complete 6 ft Hog Track Kit to every panel', () => {
  const railing = { id: 'rail-1', settings: { system: 'wild-hog' } };
  const lines = deriveAutomaticTakeoff(createProjectDocument(), { railingGeometries: [{ railing, length: 144, sectionCount: 2, postCount: 3 }], railingPostCount: 3 });
  assert.deepEqual(lines.filter((line) => line.category === 'railing').map((line) => line.description), ['Wild Hog panel', '6 ft. Wild Hog Black Aluminum Hog Track Kit', '2×6 DW handrail', 'Panel support', 'Railing post stock']);
  const trackKit = lines.find((line) => line.id === 'auto:railing:wild-hog-track');
  assert.equal(trackKit.quantity, 2);
  assert.equal(trackKit.calculatedQuantity, 2);
  assert.equal(trackKit.requiredLinearFeet, null);
  assert.equal(trackKit.specification, 'Complete 6 ft kit · 1 kit per railing panel');
  assert.equal(lines.find((line) => line.id === 'auto:railing:wild-hog-support').quantity, 4);
  const postStock = lines.find((line) => line.id === 'auto:railing:wild-hog-post');
  assert.equal(postStock.quantity, 2);
  assert.equal(postStock.stockLengthFeet, 10);
  assert.equal(postStock.specification, '4×4×10 · 2 cuts at 5 ft · 3 posts required');
});

test('Wild Hog railing post stock rounds up when an odd post remains', () => {
  const railing = { id: 'rail-seven-posts', settings: { system: 'wild-hog' } };
  const line = deriveAutomaticTakeoff(createProjectDocument(), {
    railingGeometries: [{ railing, length: 360, sectionCount: 6, postCount: 7 }],
    railingPostCount: 7,
  }).find((entry) => entry.id === 'auto:railing:wild-hog-post');
  assert.equal(line.quantity, 4);
  assert.equal(line.calculatedQuantity, 4);
  assert.equal(line.specification, '4×4×10 · 2 cuts at 5 ft · 7 posts required');
});

test('Railing Takeoff follows equalized double-corner spans and removes unnecessary panels and posts', () => {
  const first = { railing: { id: 'rail-corner-a', settings: { system: 'wild-hog' } }, length: 152, sectionCount: 3, postCount: 4, postWidth: 3.5, start: { x: 0, y: 0 }, end: { x: 152, y: 0 }, posts: [{ x: 0, y: 0 }, { x: 152 / 3, y: 0 }, { x: 304 / 3, y: 0 }, { x: 152, y: 0 }] };
  const second = { railing: { id: 'rail-corner-b', settings: { system: 'wild-hog' } }, length: 152, sectionCount: 3, postCount: 4, postWidth: 3.5, start: { x: 152, y: 0 }, end: { x: 152, y: 152 }, posts: [{ x: 152, y: 0 }, { x: 152, y: 152 / 3 }, { x: 152, y: 304 / 3 }, { x: 152, y: 152 }] };
  const geometries = [first, second];
  const singleLines = deriveAutomaticTakeoff(createProjectDocument(), { railingGeometries: geometries });
  const cornerId = analyzeRailingGeometries(geometries).corners[0].id;
  const doubledLines = deriveAutomaticTakeoff(createProjectDocument(), { railingGeometries: geometries, railingCornerSettings: { [cornerId]: { double: true } } });
  assert.match(singleLines.find((entry) => entry.id === 'auto:railing:wild-hog-post').specification, /7 posts required/);
  assert.equal(singleLines.find((entry) => entry.id === 'auto:railing:wild-hog-panel').quantity, 6);
  assert.match(doubledLines.find((entry) => entry.id === 'auto:railing:wild-hog-post').specification, /6 posts required/);
  assert.equal(doubledLines.find((entry) => entry.id === 'auto:railing:wild-hog-panel').quantity, 4);
});

test('Wild Hog handrail spans consecutive panels with the shortest commercial board', () => {
  const railing = { id: 'rail-two-panels', settings: { system: 'wild-hog' } };
  const geometry = { railing, length: 112, sectionCount: 2, postCount: 3 };
  assert.deepEqual(planWildHogHandrailStock(geometry), [10]);
  const lines = deriveAutomaticTakeoff(createProjectDocument(), { railingGeometries: [geometry], railingPostCount: 3 });
  const handrails = lines.filter((line) => line.id.startsWith('auto:railing:wild-hog-handrail:'));
  assert.equal(handrails.length, 1);
  assert.equal(handrails[0].quantity, 1);
  assert.equal(handrails[0].stockLengthFeet, 10);
  assert.equal(handrails[0].specification, '2×6×10 · continuous across panels; joints land at posts');
});

test('Stair Takeoff includes 2x12 PT side and internal stringers plus the top ledger/header', () => {
  const stair = { id: 'stair-framing-1', type: 'stair', host: { boundaryId: 'missing-boundary' }, dimensions: { width: 36, totalRise: 24, totalRun: 31.5, riserCount: 4, treadCount: 3 } };
  const document = upsertObject(createProjectDocument({ id: 'stair-framing-project' }), stair);
  const lines = deriveAutomaticTakeoff(document);
  const stringers = lines.find((line) => line.id === 'auto:stairs:stringer:8');
  const header = lines.find((line) => line.id === 'auto:stairs:ledger:8');
  assert.equal(stringers.quantity, 5);
  assert.equal(stringers.stockLengthFeet, 8);
  assert.equal(header.quantity, 1);
  assert.equal(header.stockLengthFeet, 8);
  assert.equal(stringers.category, 'framing');
  assert.equal(header.category, 'framing');
  const purchasing = consolidateTakeoffLines(lines);
  const combined = purchasing.find((line) => line.description === '2×12 PT lumber' && line.stockLengthFeet === 8);
  assert.equal(combined.quantity, 6);
  assert.equal(combined.specification, '8 ft stock · combined: Stair stringer, Stair ledger / header');
});

test('pictureframe lower framing supports adjustments, serialization and price-free purchasing export', () => {
  const stair = { id: 'picture', type: 'stair', covering: { style: 'picture-frame' }, dimensions: { width: 36, totalRise: 28, totalRun: 33, treadCount: 3, riserCount: 4 } };
  let document = upsertObject(createProjectDocument(), stair);
  const id = 'auto:stairs:bottom-tie:8';
  document = updateTakeoffLine(document, id, { quantity: 2, unitPrice: 15 });
  document = parseProject(serializeProject(document));
  const lines = getEffectiveTakeoffLines(document);
  assert.equal(lines.find((line) => line.id === id).quantity, 2);
  assert.equal(lines.find((line) => line.id === id).unitPrice, 15);
  const combined = consolidateTakeoffLines(lines);
  assert.equal(combined.find((line) => line.description === '2×4 PT lumber').quantity, 2);
  assert.equal(combined.find((line) => line.description === '2×8 PT lumber').quantity, 1);
  const exported = createTakeoffExport(document, { includePrices: false });
  assert.ok(exported.lines.some((line) => line.id === id));
  assert.ok(exported.lines.every((line) => !Object.hasOwn(line, 'unitPrice')));
});

test('Ledger SDWS screws are purchased in 50-piece boxes and always round up', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 121, y: 0 }, { x: 121, y: 96 }, { x: 0, y: 96 }], {}, ids);
  boundary.edges[0].role = 'house';
  boundary.edges[0].properties.classification.relationship = 'house-attachment';
  boundary.edges[0].properties.attachments.ledger = true;
  const document = upsertObject(createProjectDocument({ id: 'ledger-project' }), boundary);
  const line = deriveAutomaticTakeoff(document).find((entry) => entry.id === 'auto:hardware:ledger-sdws-5-box');
  assert.equal(line.calculatedQuantity, 2, '51 required screws buy two full boxes');
  assert.equal(line.quantity, 2);
  assert.equal(line.unit, 'box');
  assert.equal(line.specification, '50 pcs/box · 51 required at 5/LF · 49 spare');
  assert.deepEqual(line.sourceObjectIds, [boundary.edges[0].id]);
  const ledger = deriveAutomaticTakeoff(document).find((entry) => entry.id.startsWith('auto:framing:ledger:'));
  assert.equal(ledger.description, '2×6 PT ledger');
  assert.equal(ledger.specification, '12 ft stock · structural house attachment');
  assert.equal(ledger.quantity, 1);
});

test('consolidated purchasing view combines identical framing stock across construction roles', () => {
  const lines = consolidateTakeoffLines([
    { id: 'joist', category: 'framing', description: '2×6 PT joist', specification: '16 ft stock', stockLengthFeet: 16, calculatedQuantity: 4, quantity: 4, unit: 'ea', unitPrice: 20, requiredLinearFeet: null, origin: 'auto', confidence: 'preliminary', sourceObjectIds: ['j1'] },
    { id: 'blocking', category: 'framing', description: '2×6 PT joist blocking', specification: '16 ft stock · optimized cuts', stockLengthFeet: 16, calculatedQuantity: 2, quantity: 2, unit: 'ea', unitPrice: 20, requiredLinearFeet: null, origin: 'auto', confidence: 'preliminary', sourceObjectIds: ['j2'] },
    { id: 'ledger', category: 'framing', description: '2×6 PT ledger', specification: '16 ft stock', stockLengthFeet: 16, calculatedQuantity: 1, quantity: 1, unit: 'ea', unitPrice: 20, requiredLinearFeet: null, origin: 'auto', confidence: 'preliminary', sourceObjectIds: ['e1'] },
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].description, '2×6 PT lumber');
  assert.equal(lines[0].quantity, 7);
  assert.equal(lines[0].specification, '16 ft stock · combined: Joist, Joist blocking, Ledger');
  assert.deepEqual(lines[0].sourceObjectIds, ['j1', 'j2', 'e1']);
});

test('Ledger lumber inherits the dominant Joist Field size in its Deck Boundary', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 96 }, { x: 0, y: 96 }], {}, ids);
  boundary.edges[0].role = 'house';
  boundary.edges[0].properties.attachments.ledger = true;
  let document = upsertObject(createProjectDocument({ id: 'ledger-inheritance' }), boundary);
  for (let index = 0; index < 3; index += 1) {
    document = upsertObject(document, createJoist({ start: { x: index * 16, y: 0 }, end: { x: index * 16, y: 96 }, size: '2×8 PT', layout: { boundaryId: boundary.id, fieldId: 'field-1' } }, ids));
  }
  const ledger = deriveAutomaticTakeoff(document).find((entry) => entry.id.startsWith('auto:framing:ledger:'));
  assert.equal(ledger.description, '2×8 PT ledger');
});

test('Takeoff export records whether it is detailed or consolidated', () => {
  const detailed = createTakeoffExport(deckDocument(), { mode: 'detailed', now: '2026-08-25T00:00:00.000Z' });
  const consolidated = createTakeoffExport(deckDocument(), { mode: 'consolidated', now: '2026-08-25T00:00:00.000Z' });
  assert.equal(detailed.mode, 'detailed');
  assert.equal(consolidated.mode, 'consolidated');
});

test('House Attachment without Ledger does not buy structural ledger screws', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 96 }, { x: 0, y: 96 }], {}, ids);
  boundary.edges[0].role = 'house';
  boundary.edges[0].properties.classification.relationship = 'house-attachment';
  boundary.edges[0].properties.attachments.ledger = false;
  const document = upsertObject(createProjectDocument({ id: 'non-ledger-project' }), boundary);
  assert.equal(deriveAutomaticTakeoff(document).some((entry) => entry.id === 'auto:hardware:ledger-sdws-5-box'), false);
});

test('a doubled Boundary Rim Joist reaches project Takeoff as doubled stock', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 96 }, { x: 0, y: 96 }], {}, ids);
  boundary.edges[0].properties.attachments.rimJoist = { enabled: true, preset: '2x6', widthInches: 2, depthInches: 6, treatment: 'PT', customLabel: '', plyCount: 2 };
  const document = upsertObject(createProjectDocument({ id: 'rim-takeoff-project' }), boundary);
  const line = deriveAutomaticTakeoff(document).find((entry) => entry.id.startsWith('auto:framing:rim-joist:'));
  assert.equal(line.description, '2×6 PT rim joist / flush beam');
  assert.equal(line.specification, '10 ft stock · double joist');
  assert.equal(line.quantity, 2);
  assert.equal(line.stockLengthFeet, 10);
});
