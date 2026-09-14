import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSnapTargets, resolveSnap } from '../../core/geometry/snap-engine.js';
import { createBoundaryDraftSnapContext } from './boundary-draft-snap.js';

test('an unfinished Boundary uses its first corner to close an orthogonal layout', () => {
  const points = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 96 }];
  const context = createBoundaryDraftSnapContext(points, points.at(-1));
  const snap = resolveSnap({ x: 2, y: 94 }, {
    anchor: points.at(-1),
    anchorReferenceId: context.anchorReferenceId,
    targets: collectSnapTargets([context.object]),
    tolerance: 4,
    inferenceTolerance: 5,
    angleToleranceRadians: 5 * Math.PI / 180,
    gridEnabled: false,
    edgesEnabled: false,
    nodeInference: true,
    diagonalInference: false,
  });
  assert.equal(snap.type, 'node-intersection');
  assert.equal(snap.referenceId, context.firstReferenceId);
  assert.ok(Math.abs(snap.point.x) < 1e-8);
  assert.ok(Math.abs(snap.point.y - 96) < 1e-8);
  assert.equal(snap.label, 'Horizontal · Vertical to node');
});

test('the active Boundary corner has a stable identity for self-exclusion', () => {
  const points = [{ x: 0, y: 0 }, { x: 120, y: 0 }];
  const context = createBoundaryDraftSnapContext(points, points.at(-1));
  assert.equal(context.anchorReferenceId, 'active-boundary-draft:node:1');
  const endpoints = collectSnapTargets([context.object]).filter((target) => target.type === 'endpoint');
  assert.deepEqual(endpoints.map((target) => target.referenceId), ['active-boundary-draft:node:0', 'active-boundary-draft:node:1']);
});
