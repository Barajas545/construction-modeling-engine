import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject, upsertObject } from '../src/core/document/project-document.js';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { addManualTakeoffLine, createTakeoffExport, deriveAutomaticTakeoff, getEffectiveTakeoffLines, resetTakeoffLine, updateTakeoffLine } from '../src/tools/takeoff/takeoff.js';

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

test('Wild Hog recipe expands railing geometry into panels, tracks, rails, supports, and posts', () => {
  const railing = { id: 'rail-1', settings: { system: 'wild-hog' } };
  const lines = deriveAutomaticTakeoff(createProjectDocument(), { railingGeometries: [{ railing, length: 144, sectionCount: 2, postCount: 3 }], railingPostCount: 3 });
  assert.deepEqual(lines.filter((line) => line.category === 'railing').map((line) => line.description), ['Wild Hog panel', 'Wild Hog aluminum track', '2×6 DW handrail', 'Panel support', 'Railing post']);
  assert.equal(lines.find((line) => line.id === 'auto:railing:wild-hog-support').quantity, 4);
});
