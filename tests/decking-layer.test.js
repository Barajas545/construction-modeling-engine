import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject } from '../src/core/document/project-document.js';
import { getDeckingLayer, setDeckingLayerVisibility } from '../src/core/annotations/decking-layer.js';

test('decking visibility is independent and serializable', () => {
  const project = createProjectDocument({ id: 'decking-layer-project' });
  assert.equal(getDeckingLayer(project).visible, true);
  const hidden = setDeckingLayerVisibility(project, false);
  assert.equal(getDeckingLayer(parseProject(serializeProject(hidden))).visible, false);
});
