import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject } from '../src/core/document/project-document.js';
import { getSnapSettings, setSnapSettings } from '../src/core/geometry/snap-settings.js';

test('precision snap settings are serializable project preferences', () => {
  const project = createProjectDocument({ id: 'snap-settings-project' });
  assert.deepEqual(getSnapSettings(project), {
    type: 'snap-settings', schemaVersion: 1, id: 'project-snap-settings', name: 'Precision snaps',
    edges: true, grid: true, nodeInference: true, diagonalInference: true,
  });
  const updated = setSnapSettings(project, { grid: false, diagonalInference: false });
  const restored = parseProject(serializeProject(updated));
  assert.equal(getSnapSettings(restored).grid, false);
  assert.equal(getSnapSettings(restored).diagonalInference, false);
  assert.equal(getSnapSettings(restored).nodeInference, true);
});

test('snap settings inherit existing railing snap preferences during migration', () => {
  const project = createProjectDocument({ id: 'legacy-snap-project' });
  project.objects.push({ type: 'railing-layer', id: 'railing-layer', visible: true, snap: { edges: false, grid: true } });
  const settings = getSnapSettings(project);
  assert.equal(settings.edges, false);
  assert.equal(settings.grid, true);
  assert.equal(settings.nodeInference, true);
});
