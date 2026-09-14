import test from 'node:test';
import assert from 'node:assert/strict';
import { circularArc, getBoundaryArc } from '../../core/geometry/circular-arc.js';
import { createDeckBoundary, validateDeckBoundary, moveVertexWithConstraints, splitEdgeIntoSegments, offsetEdge, updateEdgeProperties } from '../deck-boundary/deck-boundary.js';
import { setArchLineSagitta, straightenArchLine, dragArchLine, archLineBlockReason } from './arch-line.js';
import { collectSnapTargets } from '../../core/geometry/snap-engine.js';
import { createProjectDocument, upsertObject, parseProject, serializeProject } from '../../core/document/project-document.js';
import { deriveAutomaticTakeoff } from '../takeoff/takeoff.js';
import { translateDeckAssembly } from '../../core/construction-objects/multi-deck-project.js';
import { setDeckBoardingDirection, deriveDeckBoardingSegments } from '../deck-boarding/deck-boarding.js';

const rectangle = () => createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }]);
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

test('circular arc radius, sagitta and center agree on both sides and after rotation', () => {
  for (const sign of [-1, 1]) {
    const arc = circularArc({ x: 0, y: 0 }, { x: 120, y: 0 }, sign * 20);
    close(arc.radius, 100);
    close(arc.centerOffset, 80);
    assert.deepEqual(arc.apex, { x: 60, y: sign * 20 });
    arc.points.forEach((p) => close(Math.hypot(p.x - arc.center.x, p.y - arc.center.y), 100));
    const rotated = circularArc({ x: 10, y: 20 }, { x: 10, y: 140 }, sign * 20);
    close(rotated.radius, arc.radius);
    close(rotated.apex.x, 10 - sign * 20);
    close(rotated.apex.y, 80);
  }
  const half = circularArc({ x: 0, y: 0 }, { x: 120, y: 0 }, 60);
  close(half.length, Math.PI * 60);
  close(half.centerOffset, 0);
  assert.equal(circularArc({ x: 0, y: 0 }, { x: 120, y: 0 }, 0), null);
});

test('arc is a real contour: area and perimeter update, arbitrary edge including closing edge works', () => {
  for (const index of [0, 1, 2, 3]) {
    const deck = rectangle();
    const next = setArchLineSagitta(deck, deck.edges[index].id, -20);
    assert.equal(validateDeckBoundary(next).valid, true);
    const arc = getBoundaryArc(next, deck.edges[index].id);
    const segmentArea = arc.radius ** 2 * (Math.abs(arc.sweep) - Math.sin(Math.abs(arc.sweep))) / 2;
    close(next.computed.areaSquareInches, 14400 + segmentArea, 2);
    close(next.computed.perimeterInches, 360 + arc.length, .02);
    next.edges.forEach((edge, i) => {
      assert.equal(edge.startVertexId, next.vertices[i].id);
      assert.equal(edge.endVertexId, next.vertices[(i + 1) % next.vertices.length].id);
    });
    const restored = straightenArchLine(next, arc.id);
    assert.deepEqual(restored.vertices, deck.vertices);
    assert.deepEqual(restored.edges, deck.edges);
  }
});

test('reshape is non-mutating, preserves original identities and restores properties', () => {
  const deck = rectangle();
  deck.edges[0].properties.finishes.fascia = true;
  const before = structuredClone(deck);
  const root = deck.edges[0].id;
  let next = setArchLineSagitta(deck, root, -20);
  next = dragArchLine(next, root, { x: 60, y: -30 });
  close(getBoundaryArc(next, root).sagitta, -30);
  assert.deepEqual(deck, before);
  assert.deepEqual(straightenArchLine(next, root).edges, deck.edges);
  const straight = setArchLineSagitta(next, root, 0);
  assert.equal(straight.vertices.length, 4);
});

test('generated samples are hidden snap nodes; arc and chord midpoints remain references without C center', () => {
  const deck = rectangle();
  const curved = setArchLineSagitta(deck, deck.edges[0].id, -20);
  const targets = collectSnapTargets([curved]);
  assert.equal(targets.filter((t) => t.type === 'endpoint').length, 4);
  assert.ok(targets.some((t) => t.label === 'Arc midpoint'));
  assert.ok(targets.some((t) => t.label === 'Chord midpoint'));
  assert.ok(!targets.some((t) => t.label === 'Arc center'));
  assert.ok(!targets.some((t) => t.type === 'endpoint' && t.point.archLineId));
});

test('persistence, complete deck movement, decking and fascia use the curved contour', () => {
  let deck = rectangle();
  deck.edges[0].properties.finishes.fascia = true;
  deck = setDeckBoardingDirection(deck, deck.vertices[0], deck.vertices[1]);
  const oldBoards = deriveDeckBoardingSegments(deck);
  const curved = setArchLineSagitta(deck, deck.edges[0].id, -20);
  let doc = parseProject(serializeProject(upsertObject(createProjectDocument(), curved)));
  const radius = getBoundaryArc(doc.objects[0], deck.edges[0].id).radius;
  doc = translateDeckAssembly(doc, curved.id, { x: 40, y: -10 });
  close(getBoundaryArc(doc.objects[0], deck.edges[0].id).radius, radius);
  const sum = (lines) => lines.reduce((n, line) => n + Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y), 0);
  assert.ok(sum(deriveDeckBoardingSegments(curved)) > sum(oldBoards));
  const fascia = deriveAutomaticTakeoff(doc).find((line) => line.id === 'auto:decking:fascia');
  assert.ok(fascia.requiredLinearFeet > 10);
});

test('unsafe edits and attached straight elements are protected', () => {
  const deck = rectangle();
  const root = deck.edges[0].id;
  const curved = setArchLineSagitta(deck, root, -20);
  assert.throws(() => moveVertexWithConstraints(curved, deck.vertices[0].id, { x: 5, y: 5 }), /Arch line/);
  assert.throws(() => splitEdgeIntoSegments(curved, root, 2), /Straighten/);
  assert.throws(() => offsetEdge(curved, root, 10), /Arch line/);
  assert.throws(() => setArchLineSagitta(deck, root, 80), /semicircle/);
  assert.equal(archLineBlockReason({ objects: [] }, deck, root), null);
  assert.match(archLineBlockReason({ objects: [{ type: 'railing-run', anchors: { edgeId: root } }] }, deck, root), /anchors/);
  deck.edges[0].role = 'house';
  assert.match(archLineBlockReason({ objects: [] }, deck, root), /ledger/);
});

test('inward arc intersecting the other boundary is rejected', () => {
  const deck = createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 15 }, { x: 0, y: 15 }]);
  assert.throws(() => setArchLineSagitta(deck, deck.edges[0].id, 30), /cross/);
});

test('finish edits propagate to the complete curve and survive Straighten', () => {
  const deck = rectangle();
  const root = deck.edges[0].id;
  let curved = setArchLineSagitta(deck, root, -20);
  curved = updateEdgeProperties(curved, root, { finishes: { fascia: true, pictureFrame: true } });
  assert.ok(curved.edges.filter((edge) => edge.metadata?.archLineId === root).every((edge) => edge.properties.finishes.fascia && edge.properties.finishes.pictureFrame));
  const straight = straightenArchLine(curved, root);
  assert.equal(straight.edges[0].properties.finishes.fascia, true);
  assert.equal(straight.edges[0].properties.finishes.pictureFrame, true);
  assert.throws(() => updateEdgeProperties(curved, root, { attachments: { ledger: true } }), /Straighten/);
});

test('curved picture frame uses exact arc length and is identified as heat-bent composite decking', () => {
  const deck = rectangle();
  const root = deck.edges[0].id;
  let curved = setArchLineSagitta(deck, root, -20);
  curved = updateEdgeProperties(curved, root, { finishes: { pictureFrame: true } });
  const arc = getBoundaryArc(curved, root);
  const document = upsertObject(createProjectDocument(), curved);
  const lines = deriveAutomaticTakeoff(document);
  assert.equal(lines.some((line) => line.id === 'auto:decking:square-picture-frame'), false);
  const heatBent = lines.find((line) => line.id === 'auto:decking:square-picture-frame-curved');
  close(heatBent.requiredLinearFeet, Number((arc.length / 12).toFixed(2)), .001);
  assert.match(heatBent.description, /Heat-bent/);
  assert.equal(heatBent.confidence, 'review');
});
