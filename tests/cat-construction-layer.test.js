import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject } from '../src/core/document/project-document.js';
import { getCatConstructionLayer, setCatConstructionLayerVisibility } from '../src/core/annotations/cat-construction-layer.js';

test('CAT construction lines use an independent serializable visibility layer', () => {
  const project = createProjectDocument({ id: 'cat-layer-project' });
  assert.equal(getCatConstructionLayer(project).visible, true);
  const hidden = setCatConstructionLayerVisibility(project, false);
  const restored = parseProject(serializeProject(hidden));
  assert.equal(getCatConstructionLayer(restored).visible, false);
});
