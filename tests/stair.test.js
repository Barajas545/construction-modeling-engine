import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeckBoundary, validateDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { attachStairToBoundary, calculateStairDragLayout, calculateStairLayout, deriveStairDragOptions, deriveStairOpeningSnap, deriveStairSideSegments, deriveStairTreads, detachStairFromBoundary, findStairBoundaryConnection, getStairInterfaceEdge, mergeStairBoundaryConnection, resolveStairHostEdge, setStairSidePosition, setStairWidth, solveStairLayout, synchronizeConnectedStairLevels, updateStairDimensions, updateStairInterfaceEdgeProperties, validateStairPlacement } from '../src/tools/stairs/stair.js';

function ids() { let count = 0; return (prefix) => `${prefix}-${++count}`; }

test('calculates internal stair geometry from total rise', () => {
  const layout = calculateStairLayout(36, 7.5, 10);
  assert.equal(layout.stepCount, 5);
  assert.equal(layout.riserCount, 5);
  assert.equal(layout.treadCount, 4);
  assert.equal(layout.riserHeight, 7.2);
  assert.equal(layout.totalRun, 40);
});

test('drag layout treats drag distance as total rise and derives construction-valid run', () => {
  [24, 40, 60, 96].forEach((rise) => {
    const layout = calculateStairDragLayout(rise);
    assert.ok(layout.treadDepth <= 11);
    assert.ok(layout.treadDepth >= 10);
    assert.ok(layout.riserHeight <= 7.5);
    assert.ok(layout.riserHeight >= 5);
    assert.equal(layout.treadCount, layout.riserCount - 1);
    assert.equal(layout.totalRise, rise);
    assert.equal(layout.totalRun, layout.treadCount * layout.treadDepth);
  });
});

test('dragging outward from a boundary edge derives a live stair definition', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const options = deriveStairDragOptions(boundary, boundary.edges[0].id, { x: 96, y: -40 }, 36);
  assert.equal(options.totalRise, 40);
  assert.equal(options.riserCount, 6);
  assert.equal(options.treadCount, 5);
  assert.ok(Math.abs(options.riserHeight - 6.6666666667) < 1e-8);
  assert.equal(options.treadDepth, 10.5);
  assert.equal(options.totalRun, 52.5);
  const attached = attachStairToBoundary(boundary, boundary.edges[0].id, options, makeId);
  assert.equal(attached.stair.dimensions.totalRun, 52.5);
  assert.equal(attached.stair.dimensions.riserCount, 6);
  assert.equal(deriveStairTreads(attached.boundary, attached.stair).length, 4);
});

test('stairs recognize a parallel lower Deck Boundary as a connected landing', () => {
  const makeId = ids();
  const source = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const target = createDeckBoundary([{ x: 0, y: -54 }, { x: 192, y: -54 }, { x: 192, y: -24 }, { x: 0, y: -24 }], { idFactory: makeId, metadata: { levelDownInches: 30 } });
  const connection = findStairBoundaryConnection(source, source.edges[0].id, { width: 36, startOffset: 78 }, [target], { x: 96, y: -32 });
  assert.equal(connection.boundaryId, target.id);
  assert.equal(connection.edgeId, null);
  assert.equal(connection.totalRise, 30);
  assert.ok(connection.totalRun >= 30 && connection.totalRun <= 33);
  assert.ok(connection.riserHeight <= 7.5);
  assert.ok(connection.treadDepth <= 11);
  const attached = attachStairToBoundary(source, source.edges[0].id, { width: 36, startOffset: 78, ...connection, destination: { boundaryId: connection.boundaryId, landing: connection.landing } }, makeId);
  assert.equal(attached.stair.destination.boundaryId, target.id);
  assert.equal(attached.stair.destination.relationship, 'lower-deck-area-landing');
  target.metadata.levelDownInches = 36;
  const synchronized = synchronizeConnectedStairLevels({ objects: [attached.boundary, target, attached.stair] });
  const updatedStair = synchronized.objects.find((object) => object.type === 'stair');
  assert.equal(updatedStair.dimensions.totalRise, 36);
  assert.ok(updatedStair.dimensions.riserHeight <= 7.5);
});

test('a shared edge automatically chooses the upper deck as the stair host', () => {
  const makeId = ids();
  const upper = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }], { idFactory: makeId, metadata: { levelDownInches: 0 } });
  const lower = createDeckBoundary([{ x: 0, y: 120 }, { x: 120, y: 120 }, { x: 120, y: 240 }, { x: 0, y: 240 }], { idFactory: makeId, metadata: { levelDownInches: 24 } });
  const pointer = { x: 60, y: 120 };
  const host = resolveStairHostEdge(lower, lower.edges[0].id, [upper, lower], pointer);
  assert.equal(host.boundary.id, upper.id);
  assert.equal(host.edgeId, upper.edges[2].id);
  const opening = deriveStairOpeningSnap(host.boundary, host.edgeId, pointer, 36);
  const freeLayout = deriveStairDragOptions(host.boundary, host.edgeId, { x: 60, y: 150 }, opening.width, opening.startOffset);
  const connection = findStairBoundaryConnection(host.boundary, host.edgeId, opening, [upper, lower], { x: 60, y: 150 });
  const connectedOptions = mergeStairBoundaryConnection(freeLayout, connection, host.edgeId);
  assert.ok(freeLayout.totalRise > 0);
  assert.equal(connection.boundaryId, lower.id);
  assert.equal(connection.totalRise, 24);
  assert.equal(connection.riserCount, 4);
  assert.equal(connection.treadCount, 3);
  assert.equal(connectedOptions.edgeId, host.edgeId);
  assert.equal(connectedOptions.destination.boundaryId, lower.id);
  const attached = attachStairToBoundary(host.boundary, connectedOptions.edgeId, { ...opening, ...connectedOptions }, makeId);
  assert.equal(attached.stair.host.sourceEdgeId, host.edgeId);
  assert.equal(attached.stair.destination.boundaryId, lower.id);
});

test('stair sides snap simply to adjacent boundary nodes', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 48, y: 0 }, { x: 48, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const opening = deriveStairOpeningSnap(boundary, boundary.edges[0].id, { x: 24, y: 0 }, 36);
  assert.deepEqual(opening, { width: 48, startOffset: 0, snappedStart: true, snappedEnd: true });
  const attached = attachStairToBoundary(boundary, boundary.edges[0].id, { ...opening, totalRise: 30, treadDepth: 10 }, makeId);
  assert.equal(attached.stair.anchors.openingStartVertexId, boundary.vertices[0].id);
  assert.equal(attached.stair.anchors.openingEndVertexId, boundary.vertices[1].id);
  assert.equal(attached.boundary.vertices.length, boundary.vertices.length + 2);
  assert.equal(validateDeckBoundary(attached.boundary).valid, true);
});

test('manual stair definitions reject treads over 11 inches', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const result = validateStairPlacement(boundary, boundary.edges[0].id, { width: 36, totalRise: 36, treadDepth: 11.5, targetRiserHeight: 7.5 });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(' '), /11 inches/);
});

test('attaching stairs reshapes the boundary and preserves unaffected identities', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const sourceEdgeId = boundary.edges[0].id;
  const unaffectedIds = boundary.edges.slice(1).map((edge) => edge.id);
  const result = attachStairToBoundary(boundary, sourceEdgeId, { width: 36, totalRise: 36, treadDepth: 10 }, makeId);
  assert.equal(result.stair.type, 'stair');
  assert.equal(result.stair.host.boundaryId, boundary.id);
  assert.equal(result.stair.host.sourceEdgeId, sourceEdgeId);
  assert.equal(result.boundary.edges[0].id, sourceEdgeId);
  unaffectedIds.forEach((id) => assert.ok(result.boundary.edges.some((edge) => edge.id === id)));
  assert.equal(result.boundary.vertices.length, boundary.vertices.length + 4);
  assert.equal(validateDeckBoundary(result.boundary).valid, true);
  assert.equal(deriveStairTreads(result.boundary, result.stair).length, result.stair.dimensions.treadCount - 1);
});

test('generated stair edges reference their owning construction object', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const result = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, totalRise: 30, treadDepth: 10 }, makeId);
  const generated = result.boundary.edges.filter((edge) => edge.properties.attachments.stairId === result.stair.id);
  assert.equal(generated.length, 3);
  assert.deepEqual(result.stair.generatedEdgeIds, generated.map((edge) => edge.id));
});

test('deck-to-stair interface is a selectable construction edge with editable properties', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const result = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, totalRise: 36, treadDepth: 10 }, makeId);
  const interfaceEdge = getStairInterfaceEdge(result.stair);
  const enriched = updateStairInterfaceEdgeProperties(result.stair, { finishes: { fascia: true, pictureFrame: true } });

  assert.equal(interfaceEdge.type, 'stair-interface-edge');
  assert.equal(interfaceEdge.startVertexId, result.stair.anchors.openingStartVertexId);
  assert.equal(interfaceEdge.endVertexId, result.stair.anchors.openingEndVertexId);
  assert.equal(enriched.interfaceEdge.id, interfaceEdge.id);
  assert.equal(enriched.interfaceEdge.properties.finishes.fascia, true);
  assert.equal(enriched.interfaceEdge.properties.finishes.pictureFrame, true);
});

test('exact stair interface width resizes all four stair anchors without replacing their identities', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const result = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, totalRise: 36, treadDepth: 10 }, makeId);
  const resized = setStairWidth(result.boundary, result.stair, 42);
  const byId = new Map(resized.boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const start = byId.get(resized.stair.anchors.openingStartVertexId);
  const end = byId.get(resized.stair.anchors.openingEndVertexId);

  assert.ok(Math.abs(Math.hypot(end.x - start.x, end.y - start.y) - 42) < 1e-6);
  assert.equal(resized.stair.dimensions.width, 42);
  assert.equal(getStairInterfaceEdge(resized.stair).id, getStairInterfaceEdge(result.stair).id);
  assert.equal(validateDeckBoundary(resized.boundary).valid, true);
});

test('a 24 inch deck connection generates four equal risers and three treads', () => {
  const layout = solveStairLayout(24);
  assert.equal(layout.riserCount, 4);
  assert.equal(layout.treadCount, 3);
  assert.equal(layout.riserHeight, 6);
  assert.ok(layout.totalRun >= 30 && layout.totalRun <= 33);
});

test('plan representation draws only interior riser lines and spaces them by tread depth', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const attached = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, totalRise: 24, treadDepth: 10 }, makeId);
  const lines = deriveStairTreads(attached.boundary, attached.stair);
  assert.equal(lines.length, 2);
  const top = attached.boundary.vertices.find((vertex) => vertex.id === attached.stair.anchors.openingStartVertexId);
  assert.ok(Math.abs(Math.hypot(lines[0].start.x - top.x, lines[0].start.y - top.y) - 10) < 1e-8);
  assert.ok(Math.abs(Math.hypot(lines[1].start.x - lines[0].start.x, lines[1].start.y - lines[0].start.y) - 10) < 1e-8);
});

test('completed stair dimensions regenerate while preserving object and anchor identities', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const attached = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, totalRise: 24, treadDepth: 10 }, makeId);
  const edited = updateStairDimensions(attached.boundary, attached.stair, { totalRise: 30, riserHeight: 7.5, treadDepth: 11 });
  assert.equal(edited.stair.id, attached.stair.id);
  assert.deepEqual(edited.stair.anchors, attached.stair.anchors);
  assert.equal(edited.stair.dimensions.riserCount, 4);
  assert.equal(edited.stair.dimensions.treadCount, 3);
  assert.equal(edited.stair.dimensions.totalRun, 33);
});

test('dragging one stair side changes width without breaking side parallelism and snaps within six inches', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const attached = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, startOffset: 10, totalRise: 24, treadDepth: 10 }, makeId);
  const snapped = setStairSidePosition(attached.boundary, attached.stair, 'start', { x: 4, y: 25 }, makeId);
  assert.equal(snapped.stair.dimensions.snappedStart, true);
  assert.equal(snapped.stair.anchors.openingStartVertexId, boundary.vertices[0].id);
  const byId = new Map(snapped.boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const topStart = byId.get(snapped.stair.anchors.openingStartVertexId);
  const outerStart = byId.get(snapped.stair.anchors.outerStartVertexId);
  const topEnd = byId.get(snapped.stair.anchors.openingEndVertexId);
  const outerEnd = byId.get(snapped.stair.anchors.outerEndVertexId);
  assert.ok(Math.abs((outerStart.x - topStart.x) - (outerEnd.x - topEnd.x)) < 1e-8);
  assert.ok(Math.abs((outerStart.y - topStart.y) - (outerEnd.y - topEnd.y)) < 1e-8);
});

test('a stair side snaps to a nearby boundary edge and exposes shared and remaining intervals', () => {
  const makeId = ids();
  const host = createDeckBoundary([{ x: 30, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 144 }, { x: 30, y: 144 }], { idFactory: makeId });
  const adjacent = createDeckBoundary([{ x: -20, y: -15 }, { x: 36, y: -15 }, { x: 36, y: 15 }, { x: -20, y: 15 }], { idFactory: makeId });
  const attached = attachStairToBoundary(host, host.edges[0].id, { width: 36, startOffset: 10, totalRise: 24, treadDepth: 10 }, makeId);
  const resized = setStairSidePosition(attached.boundary, attached.stair, 'start', { x: 39, y: -12 }, makeId, [attached.boundary, adjacent]);
  assert.equal(resized.snap.type, 'edge');
  assert.equal(resized.snap.boundaryId, adjacent.id);
  assert.equal(resized.stair.sideAttachments.start.edgeId, adjacent.edges[1].id);
  const byId = new Map(resized.boundary.vertices.map((vertex) => [vertex.id, vertex]));
  assert.equal(byId.get(resized.stair.anchors.openingStartVertexId).x, 36);
  assert.equal(byId.get(resized.stair.anchors.outerStartVertexId).x, 36);
  const segments = deriveStairSideSegments(resized.boundary, resized.stair, 'start', [resized.boundary, adjacent]);
  assert.deepEqual(segments.map((segment) => segment.role), ['shared-boundary', 'stair-only']);
  assert.equal(segments[0].boundaryEdgeId, adjacent.edges[1].id);
  assert.equal(segments[0].boundaryId, adjacent.id);
});

test('deleting a stair restores a valid Deck Boundary', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const attached = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, totalRise: 24, treadDepth: 10 }, makeId);
  const restored = detachStairFromBoundary(attached.boundary, attached.stair, makeId);
  assert.equal(restored.vertices.length, boundary.vertices.length);
  assert.equal(validateDeckBoundary(restored).valid, true);
});

test('a stair side is split into independently selectable shared-boundary and stair-only roles', () => {
  const makeId = ids();
  const boundary = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const attached = attachStairToBoundary(boundary, boundary.edges[0].id, { width: 36, startOffset: 0, totalRise: 24, treadDepth: 10 }, makeId);
  const byId = new Map(attached.boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const top = byId.get(attached.stair.anchors.openingStartVertexId);
  const outer = byId.get(attached.stair.anchors.outerStartVertexId);
  const midpoint = { id: 'shared-side-end', x: (top.x + outer.x) / 2, y: (top.y + outer.y) / 2 };
  const semanticBoundary = {
    ...attached.boundary,
    vertices: [...attached.boundary.vertices, midpoint],
    edges: [...attached.boundary.edges, { id: 'adjacent-boundary', startVertexId: top.id, endVertexId: midpoint.id, properties: { attachments: {} } }],
  };
  const segments = deriveStairSideSegments(semanticBoundary, attached.stair, 'start');
  assert.deepEqual(segments.map((segment) => segment.role), ['shared-boundary', 'stair-only']);
  assert.equal(segments[0].boundaryEdgeId, 'adjacent-boundary');
});

test('connected stair becomes invalid instead of silently deforming when its landing leaves the lower deck', () => {
  const makeId = ids();
  const source = createDeckBoundary([{ x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 144 }, { x: 0, y: 144 }], { idFactory: makeId });
  const target = createDeckBoundary([{ x: 70, y: -44 }, { x: 122, y: -44 }, { x: 122, y: -24 }, { x: 70, y: -24 }], { idFactory: makeId, metadata: { levelDownInches: 24 } });
  const connection = findStairBoundaryConnection(source, source.edges[0].id, { width: 36, startOffset: 78 }, [target], { x: 96, y: -31 });
  const attached = attachStairToBoundary(source, source.edges[0].id, { width: 36, startOffset: 78, ...connection, destination: { boundaryId: target.id, landing: connection.landing } }, makeId);
  const movedTarget = { ...target, vertices: target.vertices.map((vertex) => ({ ...vertex, x: vertex.x + 120 })) };
  const synchronized = synchronizeConnectedStairLevels({ objects: [attached.boundary, movedTarget, attached.stair] });
  const stair = synchronized.objects.find((object) => object.type === 'stair');
  assert.equal(stair.lifecycle.needsReview, true);
  assert.match(stair.lifecycle.reviewReason, /landing/i);
});
