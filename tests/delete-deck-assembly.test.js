import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, upsertObject } from '../src/core/document/project-document.js';
import { createDimensionLayer } from '../src/core/annotations/dimension-layer.js';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { deleteDeckAssembly } from '../src/tools/deck-boundary/delete-deck-assembly.js';
import { createLevelDown } from '../src/tools/level-down/level-down.js';
import { attachStairToBoundary, getStairInterfaceEdge } from '../src/tools/stairs/stair.js';

function ids() { let count = 0; return (prefix) => `${prefix}-${++count}`; }

test('deletes one complete deck assembly and keeps an independent deck', () => {
  const makeId = ids();
  const source = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const independent = createDeckBoundary([{ x: 300, y: 0 }, { x: 420, y: 0 }, { x: 420, y: 120 }, { x: 300, y: 120 }], { idFactory: makeId });
  const attached = attachStairToBoundary(source, source.edges[0].id, { width: 36, totalRise: 24, treadDepth: 10 }, makeId);
  const stair = attached.stair;
  const boundary = attached.boundary;
  const levelDown = createLevelDown([
    { x: 0, y: 60, anchor: { snapType: 'edge', edgeId: boundary.edges.at(-1).id } },
    { x: 192, y: 60, anchor: { snapType: 'edge', edgeId: boundary.edges[1].id } },
  ], { boundaryId: boundary.id }, makeId);
  const railing = {
    type: 'railing-run', id: 'railing-hosted', host: { boundaryId: boundary.id, edgeId: getStairInterfaceEdge(stair).id, ownerId: stair.id },
    anchors: { startT: 0, endT: 1 }, settings: {}, lifecycle: { phase: 'established', revision: 1 },
  };
  const dimensionLayer = createDimensionLayer({
    offsets: { [`${boundary.id}:area`]: { x: 4, y: 8 }, [`${independent.id}:area`]: { x: 2, y: 3 } },
    hiddenReferenceIds: [boundary.edges[0].id, independent.edges[0].id],
  });
  let document = createProjectDocument();
  [boundary, independent, stair, levelDown, railing, dimensionLayer].forEach((object) => { document = upsertObject(document, object); });
  const result = deleteDeckAssembly(document, boundary.id);
  const idsLeft = new Set(result.document.objects.map((object) => object.id));
  assert.ok(idsLeft.has(independent.id));
  assert.ok(!idsLeft.has(boundary.id));
  assert.ok(!idsLeft.has(stair.id));
  assert.ok(!idsLeft.has(levelDown.id));
  assert.ok(!idsLeft.has(railing.id));
  const cleanedLayer = result.document.objects.find((object) => object.type === 'dimension-layer');
  assert.equal(cleanedLayer.offsets[`${boundary.id}:area`], undefined);
  assert.deepEqual(cleanedLayer.offsets[`${independent.id}:area`], { x: 2, y: 3 });
  assert.ok(cleanedLayer.hiddenReferenceIds.includes(independent.edges[0].id));
  assert.equal(result.removed.stairCount, 1);
});
