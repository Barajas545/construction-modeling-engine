import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveModelProgress } from '../src/core/construction-objects/progressive-model.js';
import { createProjectDocument, parseProject, setProjectWorkflowStage, upsertObject } from '../src/core/document/project-document.js';
import { createDeckBoundary, establishDeckBoundary, getBoundaryLifecycle, markBoundaryEdited } from '../src/tools/deck-boundary/deck-boundary.js';

const vertices = [{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }];

test('new boundaries transition from reviewed sketch to authoritative object', () => {
  const boundary = createDeckBoundary(vertices);
  assert.equal(getBoundaryLifecycle(boundary).phase, 'review');
  assert.equal(getBoundaryLifecycle(boundary).authoritative, false);
  const established = establishDeckBoundary(boundary, '2026-08-10T10:00:00.000Z');
  assert.equal(getBoundaryLifecycle(established).phase, 'established');
  assert.equal(getBoundaryLifecycle(established).authoritative, true);
});

test('editing preserves authority and increments object revision', () => {
  const established = establishDeckBoundary(createDeckBoundary(vertices));
  const edited = markBoundaryEdited(established, '2026-08-10T11:00:00.000Z');
  assert.equal(edited.lifecycle.phase, 'established');
  assert.equal(edited.lifecycle.authoritative, true);
  assert.equal(edited.lifecycle.revision, 2);
});

test('project detail progresses without replacing the project or boundary', () => {
  const project = createProjectDocument({ id: 'project-1', now: '2026-08-10T00:00:00.000Z' });
  const boundary = establishDeckBoundary(createDeckBoundary(vertices));
  const populated = upsertObject(project, boundary);
  const advanced = setProjectWorkflowStage(populated, 'detailed-modeling', '2026-08-10T12:00:00.000Z');
  assert.equal(advanced.id, project.id);
  assert.equal(advanced.objects[0].id, boundary.id);
  assert.equal(advanced.workflow.detailLevel, 3);
  assert.equal(deriveModelProgress(advanced).milestones[0].state, 'complete');
});

test('version one projects migrate into field capture', () => {
  const legacy = JSON.stringify({ schema: 'com.dcr.cme.project', schemaVersion: 1, id: 'legacy', updatedAt: '2026-08-10T00:00:00.000Z', objects: [] });
  const migrated = parseProject(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.workflow.stage, 'field-capture');
});
