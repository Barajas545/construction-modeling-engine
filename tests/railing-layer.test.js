import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject } from '../src/core/document/project-document.js';
import { getRailingLayer, setRailingLayerVisibility, setRailingSnapSettings } from '../src/core/annotations/railing-layer.js';

test('railing defaults to a visible independent layer with edge and grid snaps', () => {
  const project = createProjectDocument({ id: 'railing-layer-project' });
  assert.equal(getRailingLayer(project).visible, true);
  assert.deepEqual(getRailingLayer(project).snap, { edges: true, grid: true });
});

test('railing visibility and snap preferences remain serializable', () => {
  let project = createProjectDocument({ id: 'railing-layer-project' });
  project = setRailingLayerVisibility(project, false);
  project = setRailingSnapSettings(project, { grid: false });
  const restored = parseProject(serializeProject(project));
  assert.equal(getRailingLayer(restored).visible, false);
  assert.deepEqual(getRailingLayer(restored).snap, { edges: true, grid: false });
});
