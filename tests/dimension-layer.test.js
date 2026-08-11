import test from 'node:test';
import assert from 'node:assert/strict';
import { createDimensionLayer, getDimensionLayer, getDimensionOffset, isDimensionReferenceVisible, setDimensionLayerVisibility, setDimensionOffset, setDimensionReferenceVisibility } from '../src/core/annotations/dimension-layer.js';
import { createProjectDocument, parseProject, serializeProject } from '../src/core/document/project-document.js';

test('dimension annotations default to a visible independent layer', () => {
  const project = createProjectDocument({ id: 'project-dimensions' });
  assert.deepEqual(getDimensionLayer(project), createDimensionLayer());
});

test('dimension visibility and label offsets remain serializable without changing geometry', () => {
  const project = createProjectDocument({ id: 'project-dimensions' });
  const hidden = setDimensionLayerVisibility(project, false);
  const moved = setDimensionOffset(hidden, 'edge-1', { x: 18, y: -7 });
  const restored = parseProject(serializeProject(moved));

  assert.equal(getDimensionLayer(restored).visible, false);
  assert.deepEqual(getDimensionOffset(restored, 'edge-1'), { x: 18, y: -7 });
  assert.deepEqual(project.objects, []);
});

test('individual dimensions can be hidden and restored without hiding the layer', () => {
  const project = createProjectDocument({ id: 'project-dimensions' });
  const hidden = setDimensionReferenceVisibility(project, 'edge-1', false);
  assert.equal(isDimensionReferenceVisible(hidden, 'edge-1'), false);
  assert.equal(getDimensionLayer(hidden).visible, true);
  const restored = setDimensionReferenceVisibility(hidden, 'edge-1', true);
  assert.equal(isDimensionReferenceVisible(restored, 'edge-1'), true);
});
