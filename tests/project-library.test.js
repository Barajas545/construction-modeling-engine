import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument } from '../src/core/document/project-document.js';
import { activateLibraryProject, createProjectLibrary, getActiveProject, parseProjectLibrary, removeLibraryProject, serializeProjectLibrary, upsertLibraryProject } from '../src/core/document/project-library.js';

test('stores multiple independent CME projects without overwriting the active project', () => {
  const first = createProjectDocument({ id: 'project-1', name: 'First', now: '2026-08-18T00:00:00.000Z' });
  const second = createProjectDocument({ id: 'project-2', name: 'Second', now: '2026-08-18T00:01:00.000Z' });
  const library = upsertLibraryProject(createProjectLibrary(first), second);
  assert.equal(library.projects.length, 2);
  assert.equal(getActiveProject(library).id, 'project-2');
  assert.equal(getActiveProject(activateLibraryProject(library, 'project-1')).name, 'First');
});

test('round-trips the project library and selects a remaining project after deletion', () => {
  const first = createProjectDocument({ id: 'project-1', now: '2026-08-18T00:00:00.000Z' });
  const second = createProjectDocument({ id: 'project-2', now: '2026-08-18T00:01:00.000Z' });
  const library = upsertLibraryProject(createProjectLibrary(first), second);
  const parsed = parseProjectLibrary(serializeProjectLibrary(library));
  const removed = removeLibraryProject(parsed, 'project-2');
  assert.equal(removed.activeProjectId, 'project-1');
  assert.equal(removed.projects.length, 1);
});
