import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject, upsertObject } from '../src/core/document/project-document.js';
import { createCatLine, createCatMeasurement, deriveCatMeasurement, getCatSnapObjects } from '../src/tools/cat-cl/cat-cl.js';
import { getCatDimensionLayer, setCatDimensionLayerVisibility } from '../src/core/annotations/cat-dimension-layer.js';

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
