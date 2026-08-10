import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, parseProject, serializeProject, upsertObject } from '../src/core/document/project-document.js';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';

test('round-trips a deck boundary through the versioned project document', () => {
  const project = createProjectDocument({ id: 'project-1', name: 'Test deck', now: '2026-08-10T00:00:00.000Z' });
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }]);
  const populated = upsertObject(project, boundary, '2026-08-10T00:01:00.000Z');
  assert.deepEqual(parseProject(serializeProject(populated)), populated);
});

test('rejects an unknown project schema', () => {
  assert.throws(() => parseProject('{"schema":"unknown","schemaVersion":1,"objects":[]}'), /unsupported/i);
});
