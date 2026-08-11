import test from 'node:test';
import assert from 'node:assert/strict';
import { createDimensionLayer, getDimensionLayer, getDimensionOffset, setDimensionLayerVisibility, setDimensionOffset } from '../src/core/annotations/dimension-layer.js';
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
