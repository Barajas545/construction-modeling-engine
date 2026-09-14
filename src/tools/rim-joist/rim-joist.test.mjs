import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, upsertObject } from '../../core/document/project-document.js';
import { createDeckBoundary } from '../deck-boundary/deck-boundary.js';
import { updateEdgeProperties } from '../deck-boundary/deck-boundary.js';
import { setArchLineSagitta } from '../arch-line/arch-line.js';
import { createJoist, deriveSharedRimFlushSupports } from '../joist-group/joist-group.js';
import { createRimJoistProperty, describeRimJoistTakeoff, normalizeRimJoist, rimJoistLabel } from './rim-joist.js';

const ids = (() => { let next = 0; return (prefix) => `${prefix}-${++next}`; })();

function documentWithRim(lengthInches, rim) {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: lengthInches, y: 0 }, { x: lengthInches, y: 96 }, { x: 0, y: 96 }], {}, ids);
  boundary.edges[0].properties.attachments.rimJoist = rim;
  return { boundary, document: upsertObject(createProjectDocument({ id: 'rim-project' }), boundary) };
}

test('a Rim Joist / Flush Beam defaults to a single 2x6 PT member', () => {
  const rim = createRimJoistProperty();
  assert.equal(rimJoistLabel(rim), '2×6 PT');
  assert.equal(rim.plyCount, 1);
  assert.equal(normalizeRimJoist(null).enabled, false);
});

test('a double Rim Joist doubles every commercial stock piece in Takeoff', () => {
  const { boundary, document } = documentWithRim(243, createRimJoistProperty({ plyCount: 2 }));
  const lines = describeRimJoistTakeoff(document);
  assert.deepEqual(lines.map((line) => [line.specification, line.quantity]), [['10 ft stock · double joist', 2], ['12 ft stock · double joist', 2]]);
  assert.ok(lines.every((line) => line.description === '2×6 PT rim joist / flush beam'));
  assert.ok(lines.every((line) => line.sourceObjectIds[0] === boundary.edges[0].id));
});

test('custom Rim Joist material remains structured and reaches Takeoff', () => {
  const custom = createRimJoistProperty({ preset: 'custom', customLabel: '3×12 DF #1', plyCount: 1 });
  const { document } = documentWithRim(120, custom);
  const [line] = describeRimJoistTakeoff(document);
  assert.equal(line.description, '3×12 DF #1 rim joist / flush beam');
  assert.equal(line.specification, '10 ft stock · single joist');
});

test('a curved rim is counted once by true arc length and inherits the dominant Joist Field profile', () => {
  let boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 96 }, { x: 0, y: 96 }], {}, ids);
  const root = boundary.edges[0].id;
  boundary = setArchLineSagitta(boundary, root, -20);
  boundary = updateEdgeProperties(boundary, root, { attachments: { rimJoist: createRimJoistProperty({ inheritedFromJoistField: true }) } });
  const joist = createJoist({ start: { x: 0, y: 0 }, end: { x: 0, y: 96 }, size: '2×8 PT', layout: { boundaryId: boundary.id, fieldId: 'field-1' } }, ids);
  let document = upsertObject(createProjectDocument({ id: 'curved-rim-project' }), boundary);
  document = upsertObject(document, joist);
  const lines = describeRimJoistTakeoff(document);
  const supports = deriveSharedRimFlushSupports([boundary], boundary);
  const supportedLength = supports.reduce((sum, support) => sum + Math.hypot(support.end.x - support.start.x, support.end.y - support.start.y), 0);
  assert.ok(supports.length > 1);
  assert.ok(Math.abs(supportedLength - 128.7) < .1);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].description, '2×8 PT curved rim joist / flush beam');
  assert.equal(lines[0].specification, '12 ft stock · single joist · arc length; bending/lamination review');
  assert.equal(lines[0].quantity, 1);
  assert.deepEqual(lines[0].sourceObjectIds, [root]);
});
