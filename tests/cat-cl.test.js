import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject, upsertObject } from '../src/core/document/project-document.js';
import { createCatLine, createCatMeasurement, createCatNote, deriveCatMeasurement, extendCatLine, getCatSnapObjects, resolveCatLineEndpoint, trimCatLine, updateCatNote } from '../src/tools/cat-cl/cat-cl.js';
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

test('CAT Notes preserve arrow point, draggable label, text, and optional voice data', () => {
  const note = createCatNote({ x: 10, y: 20 }, 'Verify footing', {}, () => 'note-1');
  const updated = updateCatNote(note, { labelOffset: { x: 60, y: -40 }, audioDataUrl: 'data:audio/webm;base64,AAAA' });
  assert.deepEqual(updated.anchor, { x: 10, y: 20 });
  assert.deepEqual(updated.labelOffset, { x: 60, y: -40 });
  assert.equal(updated.text, 'Verify footing');
  assert.match(updated.audioDataUrl, /^data:audio\/webm/);
});
