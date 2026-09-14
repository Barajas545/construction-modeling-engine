import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject, upsertObject } from '../src/core/document/project-document.js';
import { applyCatOffset, createCatLine, createCatMeasurement, createCatNote, deriveCatBoundaries, deriveCatLineGeometry, deriveCatMeasurement, dragCatLineArc, extendCatLine, extendCatLineToLine, getCatSnapObjects, offsetCatLine, resolveCatLineEndpoint, setCatLineSagitta, trimCatLine, updateCatNote } from '../src/tools/cat-cl/cat-cl.js';
import { convertCatBoundaryToDeckBoundary } from '../src/tools/cat-cl/cat-boundary.js';
import { getCatDimensionLayer, setCatDimensionLayerVisibility } from '../src/core/annotations/cat-dimension-layer.js';
import { parseConstructionLength } from '../src/core/units/parse-length.js';

test('CAT construction lines remain serializable reference geometry', () => {
  const line = createCatLine({ x: 0, y: 0 }, { x: 120, y: 60 }, {}, () => 'cat-1');
  const project = upsertObject(createProjectDocument({ id: 'project-1' }), line);
  const restored = parseProject(serializeProject(project));
  assert.equal(getCatSnapObjects(restored)[0].vertices[1].x, 120);
  assert.equal(getCatSnapObjects(restored)[0].snapSource, 'cat');
});

test('CAT measuring tape derives horizontal, vertical, and point-to-point dimensions', () => {
  const measurement = createCatMeasurement({ x: 10, y: 20 }, { x: 46, y: 68 }, {}, () => 'measure-1');
  assert.deepEqual(deriveCatMeasurement(measurement), {
    horizontal: 36,
    vertical: 48,
    horizontalDistance: 36,
    verticalDistance: 48,
    pointToPointDistance: 60,
    corner: { x: 46, y: 20 },
    midpoint: { x: 28, y: 44 },
  });
});

test('CAT dimensions use an independent serializable layer', () => {
  const hidden = setCatDimensionLayerVisibility(createProjectDocument({ id: 'project-1' }), false);
  assert.equal(getCatDimensionLayer(parseProject(serializeProject(hidden))).visible, false);
});

test('CAT Line places typed imperial and metric lengths along the live direction', () => {
  const start = { x: 10, y: 20 };
  const toward = { x: 13, y: 24 };
  for (const entry of ['23in', '6ft', '2m']) {
    const length = parseConstructionLength(entry);
    const end = resolveCatLineEndpoint(start, toward, length);
    assert.ok(Math.abs(Math.hypot(end.x - start.x, end.y - start.y) - length) < 1e-8);
  }
});

test('CAT Trim removes the clicked side at the nearest crossing', () => {
  const line = createCatLine({ x: 0, y: 0 }, { x: 100, y: 0 }, {}, () => 'trim-line');
  const cutter = { start: { x: 40, y: -20 }, end: { x: 40, y: 20 } };
  const trimmedStart = trimCatLine(line, { x: 10, y: 0 }, [cutter]);
  assert.equal(trimmedStart.vertices[0].x, 40);
  assert.equal(trimmedStart.vertices[1].x, 100);
  const trimmedEnd = trimCatLine(line, { x: 90, y: 0 }, [cutter]);
  assert.equal(trimmedEnd.vertices[0].x, 0);
  assert.equal(trimmedEnd.vertices[1].x, 40);
});

test('CAT Extend moves the nearest endpoint to the first crossing beyond it', () => {
  const line = createCatLine({ x: 20, y: 0 }, { x: 80, y: 0 }, {}, () => 'extend-line');
  const cutters = [
    { start: { x: 0, y: -20 }, end: { x: 0, y: 20 } },
    { start: { x: 100, y: -20 }, end: { x: 100, y: 20 } },
  ];
  assert.equal(extendCatLine(line, { x: 22, y: 0 }, cutters).vertices[0].x, 0);
  assert.equal(extendCatLine(line, { x: 78, y: 0 }, cutters).vertices[1].x, 100);
});

test('two-stage Extend changes only the first straight CAT Line at the virtual intersection', () => {
  const source = createCatLine({ x: 0, y: 0 }, { x: 50, y: 0 }, {}, () => 'source');
  const target = createCatLine({ x: 80, y: -40 }, { x: 80, y: 40 }, {}, () => 'target');
  const extended = extendCatLineToLine(source, target, { x: 48, y: 0 });
  assert.equal(extended.vertices[1].x, 80);
  assert.deepEqual(target.vertices.map(({ x, y }) => ({ x, y })), [{ x: 80, y: -40 }, { x: 80, y: 40 }]);
});

test('a straight CAT Line extends to the virtual circumference of a CAT arc', () => {
  const source = createCatLine({ x: 0, y: 0 }, { x: 20, y: 0 }, {}, () => 'source');
  const target = setCatLineSagitta(createCatLine({ x: 40, y: 0 }, { x: 50, y: 10 }, {}, () => 'target-arc'), 2.9375);
  const extended = extendCatLineToLine(source, target, { x: 19, y: 0 });
  assert.ok(extended.vertices[1].x > 39 && extended.vertices[1].x < 41);
  assert.ok(Math.abs(extended.vertices[1].y) < 1e-7);
  assert.equal(target.vertices[0].x, 40);
});

test('CAT arc Extend follows its original circumference to the second line', () => {
  const quarter = setCatLineSagitta(createCatLine({ x: -50, y: 0 }, { x: 0, y: 50 }, {}, () => 'quarter'), 14.64466094067262);
  const target = createCatLine({ x: 50, y: -100 }, { x: 50, y: 100 }, {}, () => 'target');
  const extended = extendCatLineToLine(quarter, target, { x: 0, y: 49 });
  const original = deriveCatLineGeometry(quarter);
  const geometry = deriveCatLineGeometry(extended);
  assert.ok(Math.abs(extended.vertices[1].x - 50) < 1e-7);
  assert.ok(Math.abs(geometry.radius - original.radius) < 1e-7);
  assert.ok(Math.abs(geometry.sweep) > Math.abs(original.sweep));
});

test('CAT Trim cuts an arc at a finite crossing and preserves its circumference', () => {
  const arc = setCatLineSagitta(createCatLine({ x: -50, y: 0 }, { x: 50, y: 0 }, {}, () => 'arc'), 50);
  const cutter = createCatLine({ x: 0, y: 25 }, { x: 0, y: 75 }, {}, () => 'cutter');
  const trimmed = trimCatLine(arc, { x: -40, y: 20 }, [cutter]);
  const geometry = deriveCatLineGeometry(trimmed);
  assert.ok(Math.abs(trimmed.vertices[0].x) < 1e-7);
  assert.ok(Math.abs(trimmed.vertices[0].y - 50) < 1e-7);
  assert.ok(Math.abs(geometry.radius - 50) < 1e-7);
  assert.ok(Math.abs(Math.abs(geometry.sweep) - Math.PI / 2) < 1e-7);
});

test('CAT Notes preserve arrow point, draggable label, text, and optional voice data', () => {
  const note = createCatNote({ x: 10, y: 20 }, 'Verify footing', {}, () => 'note-1');
  const updated = updateCatNote(note, { labelOffset: { x: 60, y: -40 }, audioDataUrl: 'data:audio/webm;base64,AAAA' });
  assert.deepEqual(updated.anchor, { x: 10, y: 20 });
  assert.deepEqual(updated.labelOffset, { x: 60, y: -40 });
  assert.equal(updated.text, 'Verify footing');
  assert.match(updated.audioDataUrl, /^data:audio\/webm/);
});

test('CAT straight lines can become editable arcs', () => {
  const line = createCatLine({ x: 0, y: 0 }, { x: 120, y: 0 }, {}, () => 'arc-line');
  const curved = dragCatLineArc(line, { x: 60, y: 20 });
  const geometry = deriveCatLineGeometry(curved);
  assert.equal(geometry.kind, 'arc');
  assert.equal(geometry.sagitta, 20);
  assert.ok(geometry.length > 120);
});

test('CAT Offset creates a parallel straight construction line', () => {
  const line = createCatLine({ x: 0, y: 0 }, { x: 120, y: 0 }, {}, () => 'source');
  const offset = offsetCatLine(line, { x: 60, y: 18 }, {}, () => 'offset');
  assert.deepEqual(offset.vertices.map(({ x, y }) => ({ x, y })), [{ x: 0, y: 18 }, { x: 120, y: 18 }]);
});

test('CAT Offset creates a concentric arc by changing the original radius', () => {
  const source = dragCatLineArc(createCatLine({ x: 0, y: 0 }, { x: 120, y: 0 }, {}, () => 'arc-source'), { x: 60, y: 20 });
  const original = deriveCatLineGeometry(source);
  const radial = { x: original.center.x + (source.vertices[0].x - original.center.x) / original.radius * (original.radius + 6), y: original.center.y + (source.vertices[0].y - original.center.y) / original.radius * (original.radius + 6) };
  const offset = offsetCatLine(source, radial, { distanceInches: 6 }, () => 'arc-offset');
  const derived = deriveCatLineGeometry(offset);
  assert.equal(derived.kind, 'arc');
  assert.ok(Math.abs(derived.radius - original.radius - 6) < 1e-8);
  assert.equal(offset.metadata.offset.sourceLineId, source.id);
});

test('repeated offsets of adjacent straight CAT lines meet at one miter corner', () => {
  const horizontal = createCatLine({ x: 0, y: 0 }, { x: 120, y: 0 }, {}, () => 'horizontal');
  const vertical = createCatLine({ x: 120, y: 0 }, { x: 120, y: 96 }, {}, () => 'vertical');
  let project = upsertObject(upsertObject(createProjectDocument({ id: 'project-1' }), horizontal), vertical);
  project = applyCatOffset(project, horizontal.id, { x: 60, y: 12 }, { distanceInches: 12 }, () => 'horizontal-offset').document;
  const repeated = applyCatOffset(project, vertical.id, { x: 108, y: 48 }, { distanceInches: 12 }, () => 'vertical-offset');
  const first = repeated.document.objects.find((object) => object.id === 'horizontal-offset');
  const second = repeated.document.objects.find((object) => object.id === 'vertical-offset');
  assert.deepEqual({ x: first.vertices[1].x, y: first.vertices[1].y }, { x: 108, y: 12 });
  assert.deepEqual({ x: second.vertices[0].x, y: second.vertices[0].y }, { x: 108, y: 12 });
});

test('closed CAT line sets derive one area and convert to a Deck Boundary', () => {
  let project = createProjectDocument({ id: 'project-1' });
  const points = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 60 }, { x: 0, y: 60 }];
  points.forEach((start, index) => { project = upsertObject(project, createCatLine(start, points[(index + 1) % points.length], {}, () => `cat-${index}`)); });
  const regions = deriveCatBoundaries(project);
  assert.equal(regions.length, 1);
  assert.equal(regions[0].areaSquareInches, 7200);
  const deck = convertCatBoundaryToDeckBoundary(regions[0]);
  assert.equal(deck.type, 'deck-boundary');
  assert.equal(deck.computed.areaSquareInches, 7200);
  assert.deepEqual(deck.metadata.sourceCatLineIds, ['cat-0', 'cat-1', 'cat-2', 'cat-3']);
});
