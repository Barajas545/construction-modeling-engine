import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { createCatLine, deriveCatBoundaries } from '../src/tools/cat-cl/cat-cl.js';
import { isCatBoundaryVisible, isCatLineVisible, isDeckBoundaryVisible, setCatBoundaryVisibility, setDeckBoundaryVisibility, showAllBoundaries } from '../src/tools/boundary-visibility/boundary-visibility.js';

const ids = (() => { let count = 0; return (prefix) => `${prefix}-${++count}`; })();

test('Deck Boundary visibility is serializable and Show all restores it', () => {
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }], { idFactory: ids });
  const document = { objects: [boundary] };
  const hidden = setDeckBoundaryVisibility(document, boundary.id, false);
  assert.equal(isDeckBoundaryVisible(hidden.objects[0]), false);
  assert.doesNotThrow(() => JSON.stringify(hidden));
  assert.equal(isDeckBoundaryVisible(showAllBoundaries(hidden).objects[0]), true);
});

test('a derived CAT Boundary hides its source geometry but remains derivable', () => {
  const lines = [
    createCatLine({ x: 0, y: 0 }, { x: 120, y: 0 }, {}, ids),
    createCatLine({ x: 120, y: 0 }, { x: 120, y: 120 }, {}, ids),
    createCatLine({ x: 120, y: 120 }, { x: 0, y: 120 }, {}, ids),
    createCatLine({ x: 0, y: 120 }, { x: 0, y: 0 }, {}, ids),
  ];
  const document = { objects: lines };
  const region = deriveCatBoundaries(document)[0];
  const hidden = setCatBoundaryVisibility(document, region, false);
  assert.equal(isCatBoundaryVisible(hidden, deriveCatBoundaries(hidden)[0]), false);
  assert.ok(hidden.objects.every((line) => !isCatLineVisible(line)));
  assert.equal(deriveCatBoundaries(hidden).length, 1);
  assert.ok(showAllBoundaries(hidden).objects.every(isCatLineVisible));
});
