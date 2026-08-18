import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject } from '../src/core/document/project-document.js';
import { getGridLayer, setGridLayerVisibility } from '../src/core/annotations/grid-layer.js';

test('construction grid visibility is an independent serializable layer', () => {
  const project = createProjectDocument({ id: 'grid-layer-project' });
  assert.equal(getGridLayer(project).visible, true);
  const hidden = setGridLayerVisibility(project, false);
  const restored = parseProject(serializeProject(hidden));
  assert.equal(getGridLayer(restored).visible, false);
});
