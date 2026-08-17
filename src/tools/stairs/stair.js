import { createEdgeProperties, mergeEdgeProperties, normalizeBoundaryEdge } from '../../core/construction-objects/edge-properties.js';
import { distance } from '../../core/geometry/vector.js';
import { validateDeckBoundary, withComputedProperties } from '../deck-boundary/deck-boundary.js';

export const STAIR_TYPE = 'stair';
export const STAIR_SCHEMA_VERSION = 2;
export const MIN_RISER_HEIGHT = 5;
export const PREFERRED_MIN_RISER_HEIGHT = 6;
export const MAX_RISER_HEIGHT = 7.5;
export const MIN_TREAD_DEPTH = 10;
export const MAX_TREAD_DEPTH = 11;
export const STAIR_SIDE_SNAP_TOLERANCE = 6;
const defaultId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

function signedTwiceArea(vertices) {
  return vertices.reduce((sum, vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + vertex.x * next.y - next.x * vertex.y;
  }, 0);
}

export function calculateStairLayout(totalRise, targetRiserHeight = MAX_RISER_HEIGHT, treadDepth = 10) {
  const limitedRiserHeight = Math.min(targetRiserHeight, MAX_RISER_HEIGHT);
  const riserCount = Math.max(2, Math.ceil(totalRise / limitedRiserHeight));
  const treadCount = riserCount - 1;
  return {
    stepCount: riserCount,
    riserCount,
    treadCount,
    riserHeight: totalRise / riserCount,
    treadDepth,
    totalRun: treadCount * treadDepth,
  };
}

export function solveStairLayout(totalRise, options = {}) {
  const rise = Number(totalRise);
  if (!Number.isFinite(rise) || rise < MIN_RISER_HEIGHT * 2) return null;
  const minimumCount = Math.max(2, Math.ceil(rise / MAX_RISER_HEIGHT));
  const maximumCount = Math.floor(rise / MIN_RISER_HEIGHT);
  if (maximumCount < minimumCount) return null;
  const candidates = Array.from({ length: maximumCount - minimumCount + 1 }, (_, index) => minimumCount + index)
    .map((riserCount) => ({ riserCount, riserHeight: rise / riserCount }));
  const preferred = candidates.filter((candidate) => candidate.riserHeight >= PREFERRED_MIN_RISER_HEIGHT - 1e-8);
  const pool = preferred.length ? preferred : candidates;
  const preserved = pool.find((candidate) => candidate.riserCount === options.previousRiserCount);
  const targetRiserHeight = Math.min(MAX_RISER_HEIGHT, Math.max(PREFERRED_MIN_RISER_HEIGHT, Number(options.targetRiserHeight ?? 7)));
  const chosen = preserved ?? pool.sort((a, b) => Math.abs(a.riserHeight - targetRiserHeight) - Math.abs(b.riserHeight - targetRiserHeight))[0];
  const treadCount = chosen.riserCount - 1;
  const treadDepth = Math.min(MAX_TREAD_DEPTH, Math.max(MIN_TREAD_DEPTH, Number(options.treadDepth ?? 10.5)));
  return {
    stepCount: chosen.riserCount,
    riserCount: chosen.riserCount,
    treadCount,
    totalRise: rise,
    totalRun: treadCount * treadDepth,
    riserHeight: chosen.riserHeight,
    treadDepth,
    usesExtendedRiserRange: chosen.riserHeight < PREFERRED_MIN_RISER_HEIGHT - 1e-8,
  };
}

export function calculateStairDragLayout(totalRise, options = {}) {
  return solveStairLayout(Math.max(0, Number(totalRise)), options);
}

export function deriveStairOpeningSnap(boundary, edgeId, pointer, preferredWidth = 36, snapTolerance = STAIR_SIDE_SNAP_TOLERANCE) {
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (edgeIndex < 0) return null;
  const start = boundary.vertices[edgeIndex];
  const end = boundary.vertices[(edgeIndex + 1) % boundary.vertices.length];
  const edgeLength = distance(start, end);
  if (edgeLength < 24) return null;
  const unit = { x: (end.x - start.x) / edgeLength, y: (end.y - start.y) / edgeLength };
  const centerDistance = Math.max(0, Math.min(edgeLength, (pointer.x - start.x) * unit.x + (pointer.y - start.y) * unit.y));
  if (edgeLength <= preferredWidth + snapTolerance * 2) return { width: edgeLength, startOffset: 0, snappedStart: true, snappedEnd: true };
  let openingStart = Math.max(0, Math.min(edgeLength - preferredWidth, centerDistance - preferredWidth / 2));
  let openingEnd = openingStart + preferredWidth;
  const snappedStart = openingStart <= snapTolerance;
  const snappedEnd = edgeLength - openingEnd <= snapTolerance;
  if (snappedStart) openingStart = 0;
  if (snappedEnd) openingEnd = edgeLength;
  return { width: openingEnd - openingStart, startOffset: openingStart, snappedStart, snappedEnd };
}

export function deriveStairDragOptions(boundary, edgeId, pointer, width = 36, startOffset = null) {
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (edgeIndex < 0) return null;
  const start = boundary.vertices[edgeIndex];
  const end = boundary.vertices[(edgeIndex + 1) % boundary.vertices.length];
  const edgeLength = distance(start, end);
  const unit = { x: (end.x - start.x) / edgeLength, y: (end.y - start.y) / edgeLength };
  const outwardSign = signedTwiceArea(boundary.vertices) >= 0 ? 1 : -1;
  const normal = { x: unit.y * outwardSign, y: -unit.x * outwardSign };
  const openingCenter = startOffset === null
    ? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    : { x: start.x + unit.x * (startOffset + width / 2), y: start.y + unit.y * (startOffset + width / 2) };
  const totalRise = Math.max(0, (pointer.x - openingCenter.x) * normal.x + (pointer.y - openingCenter.y) * normal.y);
  const layout = calculateStairDragLayout(totalRise);
  return layout ? { width, startOffset, ...layout } : null;
}

export function findStairBoundaryConnection(sourceBoundary, edgeId, opening, candidateBoundaries, pointer, tolerance = 18) {
  const edgeIndex = sourceBoundary.edges.findIndex((edge) => edge.id === edgeId);
  if (edgeIndex < 0) return null;
  const start = sourceBoundary.vertices[edgeIndex];
  const end = sourceBoundary.vertices[(edgeIndex + 1) % sourceBoundary.vertices.length];
  const edgeLength = distance(start, end);
  const unit = { x: (end.x - start.x) / edgeLength, y: (end.y - start.y) / edgeLength };
  const outwardSign = signedTwiceArea(sourceBoundary.vertices) >= 0 ? 1 : -1;
  const normal = { x: unit.y * outwardSign, y: -unit.x * outwardSign };
  const openingStart = opening.startOffset ?? (edgeLength - opening.width) / 2;
  const openingEnd = openingStart + opening.width;
  const sourceLevel = Math.max(0, Number(sourceBoundary.metadata?.levelDownInches ?? 0));
  const candidates = [];
  for (const boundary of candidateBoundaries.filter((entry) => entry.id !== sourceBoundary.id)) {
    const targetLevel = Math.max(0, Number(boundary.metadata?.levelDownInches ?? 0));
    const totalRise = targetLevel - sourceLevel;
    if (totalRise <= 0) continue;
    const nearSurface = pointInPolygon(pointer, boundary.vertices)
      || boundary.edges.some((edge, index) => nearestOnSegment(pointer, boundary.vertices[index], boundary.vertices[(index + 1) % boundary.vertices.length]).distance <= tolerance);
    if (!nearSurface) continue;
    const baseLayout = solveStairLayout(totalRise);
    if (!baseLayout) continue;
    const pointerRun = (pointer.x - start.x) * normal.x + (pointer.y - start.y) * normal.y;
    const preferredDepth = Math.min(MAX_TREAD_DEPTH, Math.max(MIN_TREAD_DEPTH, pointerRun / baseLayout.treadCount));
    const depthCandidates = [...new Set([preferredDepth, 10, 10.25, 10.5, 10.75, 11].map((value) => Number(value.toFixed(4))))]
      .sort((a, b) => Math.abs(a - preferredDepth) - Math.abs(b - preferredDepth));
    for (const treadDepth of depthCandidates) {
      const layout = solveStairLayout(totalRise, { treadDepth, previousRiserCount: baseLayout.riserCount });
      const outerStart = { x: start.x + unit.x * openingStart + normal.x * layout.totalRun, y: start.y + unit.y * openingStart + normal.y * layout.totalRun };
      const outerEnd = { x: start.x + unit.x * openingEnd + normal.x * layout.totalRun, y: start.y + unit.y * openingEnd + normal.y * layout.totalRun };
      if (!lineInsidePolygon(outerStart, outerEnd, boundary.vertices)) continue;
      const landingCenter = { x: (outerStart.x + outerEnd.x) / 2, y: (outerStart.y + outerEnd.y) / 2 };
      candidates.push({
        boundaryId: boundary.id,
        edgeId: null,
        ...layout,
        landing: { start: outerStart, end: outerEnd, center: landingCenter, width: opening.width, direction: normal },
        distance: distance(pointer, landingCenter),
      });
      break;
    }
  }
  return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function synchronizeConnectedStairLevels(document) {
  const objects = [...document.objects];
  const objectIndex = new Map(objects.map((object, index) => [object.id, index]));
  for (const original of objects.filter((object) => object.type === STAIR_TYPE && object.destination?.boundaryId)) {
    const stairIndex = objectIndex.get(original.id);
    const stair = objects[stairIndex];
    const sourceIndex = objectIndex.get(stair.host?.boundaryId);
    const destinationIndex = objectIndex.get(stair.destination.boundaryId);
    const source = objects[sourceIndex];
    const destination = objects[destinationIndex];
    const invalid = (reason) => {
      objects[stairIndex] = { ...stair, lifecycle: { ...stair.lifecycle, revision: (stair.lifecycle?.revision ?? 1) + 1, needsReview: true, reviewReason: reason } };
    };
    if (!source || !destination) { invalid('Connected deck is missing.'); continue; }
    const sourceLevel = Math.max(0, Number(source.metadata?.levelDownInches ?? 0));
    const destinationLevel = Math.max(0, Number(destination.metadata?.levelDownInches ?? 0));
    const totalRise = destinationLevel - sourceLevel;
    if (totalRise <= 0) { invalid('Destination deck must remain below the stair host.'); continue; }
    const layout = solveStairLayout(totalRise, { previousRiserCount: stair.dimensions.riserCount, treadDepth: stair.dimensions.treadDepth });
    if (!layout) { invalid(`No equal riser layout fits ${MIN_RISER_HEIGHT}″–${MAX_RISER_HEIGHT}″.`); continue; }
    const regenerated = regenerateStairGeometry(source, stair, layout);
    if (!regenerated) { invalid('Stair geometry can no longer regenerate from its host edge.'); continue; }
    const byId = new Map(regenerated.boundary.vertices.map((vertex) => [vertex.id, vertex]));
    const outerStart = byId.get(stair.anchors.outerStartVertexId);
    const outerEnd = byId.get(stair.anchors.outerEndVertexId);
    if (!outerStart || !outerEnd || !lineInsidePolygon(outerStart, outerEnd, destination.vertices)) {
      invalid('No valid landing remains inside the lower deck surface.');
      continue;
    }
    const validation = validateDeckBoundary(regenerated.boundary);
    if (!validation.valid) { invalid('Regenerated stair would create invalid Deck Boundary geometry.'); continue; }
    objects[sourceIndex] = regenerated.boundary;
    objects[stairIndex] = {
      ...regenerated.stair,
      destination: {
        ...stair.destination,
        relationship: 'lower-deck-area-landing',
        landing: { start: { x: outerStart.x, y: outerStart.y }, end: { x: outerEnd.x, y: outerEnd.y }, center: { x: (outerStart.x + outerEnd.x) / 2, y: (outerStart.y + outerEnd.y) / 2 } },
      },
      lifecycle: { ...stair.lifecycle, revision: (stair.lifecycle?.revision ?? 1) + 1, needsReview: false, reviewReason: null },
    };
  }
  return { ...document, objects };
}

function nearestOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;
  const t = denominator ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator)) : 0;
  return { point: { x: start.x + dx * t, y: start.y + dy * t }, t };
}

function pointOnSegment(point, start, end, tolerance = 1e-6) {
  const projected = nearestOnSegment(point, start, end);
  return projected.distance <= tolerance;
}

export function pointInPolygon(point, vertices) {
  if (vertices.some((vertex, index) => pointOnSegment(point, vertex, vertices[(index + 1) % vertices.length]))) return true;
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
    const a = vertices[index];
    const b = vertices[previous];
    const crosses = ((a.y > point.y) !== (b.y > point.y))
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-12) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function lineInsidePolygon(start, end, vertices) {
  return [0, .25, .5, .75, 1].every((t) => pointInPolygon({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }, vertices));
}

export function validateStairPlacement(boundary, edgeId, options) {
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  if (edgeIndex < 0) return { valid: false, issues: ['Select a valid Deck Boundary edge.'] };
  const edgeLength = distance(boundary.vertices[edgeIndex], boundary.vertices[(edgeIndex + 1) % boundary.vertices.length]);
  const issues = [];
  if (!Number.isFinite(options.width) || options.width < 24) issues.push('Stair width must be at least 24 inches.');
  if (options.width > edgeLength) issues.push('Stair width cannot exceed its host construction edge.');
  const startOffset = options.startOffset ?? (edgeLength - options.width) / 2;
  if (!Number.isFinite(startOffset) || startOffset < 0 || startOffset + options.width > edgeLength + 1e-8) issues.push('Stair sides must remain on the selected construction edge.');
  if (!Number.isFinite(options.totalRise) || options.totalRise <= 0) issues.push('Enter a positive total rise.');
  if (!Number.isFinite(options.treadDepth) || options.treadDepth <= 0) issues.push('Tread depth must be positive.');
  if (options.treadDepth < MIN_TREAD_DEPTH) issues.push('Each stair tread must be at least 10 inches.');
  if (options.treadDepth > MAX_TREAD_DEPTH) issues.push('Each stair tread must be 11 inches or less.');
  if (Number.isFinite(options.totalRise) && options.totalRise > 0) {
    const layout = calculateStairLayout(options.totalRise, options.targetRiserHeight ?? MAX_RISER_HEIGHT, options.treadDepth);
    const riserHeight = Number.isInteger(options.riserCount) && options.riserCount >= 2 ? options.totalRise / options.riserCount : layout.riserHeight;
    if (riserHeight > MAX_RISER_HEIGHT) issues.push('Each stair riser must be 7.5 inches or less.');
    if (riserHeight < MIN_RISER_HEIGHT) issues.push('Each stair riser must be at least 5 inches.');
  }
  if (boundary.edges[edgeIndex]?.properties?.attachments?.stairId) issues.push('This edge already belongs to a staircase.');
  if (boundary.edges[edgeIndex]?.properties?.custom?.locked) issues.push('Unlock this construction edge before attaching stairs.');
  return { valid: issues.length === 0, issues, edgeLength };
}

export function attachStairToBoundary(boundary, edgeId, options = {}, idFactory = defaultId) {
  const settings = { width: 36, totalRise: 36, treadDepth: 10.5, targetRiserHeight: 7, ...options };
  const validation = validateStairPlacement(boundary, edgeId, settings);
  if (!validation.valid) throw new Error(validation.issues.join(' '));
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  const originalSourceEdge = normalizeBoundaryEdge(boundary.edges[edgeIndex]);
  const start = boundary.vertices[edgeIndex];
  const end = boundary.vertices[(edgeIndex + 1) % boundary.vertices.length];
  const length = distance(start, end);
  const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  const outwardSign = signedTwiceArea(boundary.vertices) >= 0 ? 1 : -1;
  const normal = { x: unit.y * outwardSign, y: -unit.x * outwardSign };
  const stairId = idFactory('stair');
  const sourceEdge = normalizeBoundaryEdge({
    ...originalSourceEdge,
    properties: mergeEdgeProperties(originalSourceEdge.properties, {
      custom: { stairHostId: stairId, orientationConstraint: { type: 'fixed-angle', angleRadians: Math.atan2(end.y - start.y, end.x - start.x) } },
    }),
  });
  const calculatedLayout = solveStairLayout(settings.totalRise, { targetRiserHeight: settings.targetRiserHeight, treadDepth: settings.treadDepth });
  if (!calculatedLayout) throw new Error(`No equal riser layout fits ${MIN_RISER_HEIGHT}″–${MAX_RISER_HEIGHT}″.`);
  const layout = Number.isInteger(settings.riserCount) && settings.riserCount >= 2
    ? {
        stepCount: settings.riserCount,
        riserCount: settings.riserCount,
        treadCount: settings.riserCount - 1,
        riserHeight: settings.totalRise / settings.riserCount,
        treadDepth: settings.treadDepth,
        totalRun: settings.totalRun ?? (settings.riserCount - 1) * settings.treadDepth,
      }
    : calculatedLayout;
  const margin = settings.startOffset ?? (length - settings.width) / 2;
  const snappedStart = margin <= 1e-8;
  const snappedEnd = margin + settings.width >= length - 1e-8;
  const openingStart = snappedStart ? start : { id: idFactory('vertex'), x: start.x + unit.x * margin, y: start.y + unit.y * margin, elevation: 0 };
  const openingEnd = snappedEnd ? end : { id: idFactory('vertex'), x: start.x + unit.x * (margin + settings.width), y: start.y + unit.y * (margin + settings.width), elevation: 0 };
  const outerStart = { id: idFactory('vertex'), x: openingStart.x + normal.x * layout.totalRun, y: openingStart.y + normal.y * layout.totalRun, elevation: -settings.totalRise };
  const outerEnd = { id: idFactory('vertex'), x: openingEnd.x + normal.x * layout.totalRun, y: openingEnd.y + normal.y * layout.totalRun, elevation: -settings.totalRise };
  const vertices = [...boundary.vertices.slice(0, edgeIndex + 1), ...(!snappedStart ? [openingStart] : []), outerStart, outerEnd, ...(!snappedEnd ? [openingEnd] : []), ...boundary.vertices.slice(edgeIndex + 1)].map((vertex, order) => ({ ...vertex, order }));
  const generated = new Map();
  if (!snappedStart) generated.set(`${start.id}:${openingStart.id}`, normalizeBoundaryEdge({ ...sourceEdge, id: sourceEdge.id, endVertexId: openingStart.id }));
  generated.set(`${openingStart.id}:${outerStart.id}`, stairEdge(snappedStart ? sourceEdge.id : idFactory('edge'), openingStart.id, outerStart.id, stairId, 'left-stringer'));
  generated.set(`${outerStart.id}:${outerEnd.id}`, stairEdge(idFactory('edge'), outerStart.id, outerEnd.id, stairId, 'lower-landing-edge'));
  generated.set(`${outerEnd.id}:${openingEnd.id}`, stairEdge(idFactory('edge'), outerEnd.id, openingEnd.id, stairId, 'right-stringer'));
  if (!snappedEnd) generated.set(`${openingEnd.id}:${end.id}`, normalizeBoundaryEdge({ ...sourceEdge, id: idFactory('edge'), startVertexId: openingEnd.id }));
  const oldByPair = new Map(boundary.edges.map((edge) => [`${edge.startVertexId}:${edge.endVertexId}`, normalizeBoundaryEdge(edge)]));
  const edges = vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return generated.get(`${vertex.id}:${next.id}`)
      ?? oldByPair.get(`${vertex.id}:${next.id}`)
      ?? normalizeBoundaryEdge({ id: idFactory('edge'), startVertexId: vertex.id, endVertexId: next.id, role: 'open', metadata: {}, properties: createEdgeProperties() });
  });
  const stair = {
    type: STAIR_TYPE,
    schemaVersion: STAIR_SCHEMA_VERSION,
    id: stairId,
    name: options.name ?? 'Main stairs',
    host: {
      boundaryId: boundary.id,
      sourceEdgeId: edgeId,
      originalStartVertexId: start.id,
      originalEndVertexId: end.id,
      angleRadians: Math.atan2(end.y - start.y, end.x - start.x),
      sourceEdge: normalizeBoundaryEdge(originalSourceEdge),
    },
    destination: settings.destination ? { ...settings.destination, relationship: 'lower-deck-area-landing', landing: settings.landing ?? settings.destination.landing ?? null } : null,
    anchors: { openingStartVertexId: openingStart.id, outerStartVertexId: outerStart.id, outerEndVertexId: outerEnd.id, openingEndVertexId: openingEnd.id },
    interfaceEdge: normalizeBoundaryEdge({
      type: 'stair-interface-edge',
      id: idFactory('edge'),
      startVertexId: openingStart.id,
      endVertexId: openingEnd.id,
      role: 'stair-interface',
      metadata: { generatedBy: stairId, interface: 'deck-to-stair' },
      properties: createEdgeProperties({ classification: { relationship: 'stair-interface', exterior: true }, attachments: { stairId, stairComponent: 'deck-interface' } }),
    }),
    generatedEdgeIds: edges.filter((edge) => edge.properties?.attachments?.stairId === stairId).map((edge) => edge.id),
    dimensions: { width: settings.width, startOffset: margin, snappedStart, snappedEnd, totalRise: settings.totalRise, ...layout },
    lifecycle: { phase: 'established', revision: 1, needsReview: false, reviewReason: null },
  };
  return { boundary: withComputedProperties({ ...boundary, vertices, edges }), stair };
}

export function getStairInterfaceEdge(stair) {
  return normalizeBoundaryEdge(stair.interfaceEdge ?? {
    type: 'stair-interface-edge',
    id: `${stair.id}:deck-interface`,
    startVertexId: stair.anchors.openingStartVertexId,
    endVertexId: stair.anchors.openingEndVertexId,
    role: 'stair-interface',
    metadata: { generatedBy: stair.id, interface: 'deck-to-stair', migrated: true },
    properties: createEdgeProperties({ classification: { relationship: 'stair-interface', exterior: true }, attachments: { stairId: stair.id, stairComponent: 'deck-interface' } }),
  });
}

export function updateStairInterfaceEdgeProperties(stair, patch) {
  const interfaceEdge = getStairInterfaceEdge(stair);
  return {
    ...stair,
    interfaceEdge: normalizeBoundaryEdge({ ...interfaceEdge, properties: mergeEdgeProperties(interfaceEdge.properties, patch) }),
    lifecycle: { ...stair.lifecycle, revision: (stair.lifecycle?.revision ?? 1) + 1 },
  };
}

function regenerateStairGeometry(boundary, stair, layout) {
  const byId = new Map(boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const openingStart = byId.get(stair.anchors.openingStartVertexId);
  const openingEnd = byId.get(stair.anchors.openingEndVertexId);
  const outerStart = byId.get(stair.anchors.outerStartVertexId);
  const outerEnd = byId.get(stair.anchors.outerEndVertexId);
  if (![openingStart, openingEnd, outerStart, outerEnd].every(Boolean)) return null;
  const currentRun = distance(openingStart, outerStart);
  if (currentRun < 1e-8) return null;
  const normal = { x: (outerStart.x - openingStart.x) / currentRun, y: (outerStart.y - openingStart.y) / currentRun };
  const positions = new Map([
    [outerStart.id, { x: openingStart.x + normal.x * layout.totalRun, y: openingStart.y + normal.y * layout.totalRun, elevation: -layout.totalRise }],
    [outerEnd.id, { x: openingEnd.x + normal.x * layout.totalRun, y: openingEnd.y + normal.y * layout.totalRun, elevation: -layout.totalRise }],
  ]);
  return {
    boundary: withComputedProperties({ ...boundary, vertices: boundary.vertices.map((vertex) => positions.has(vertex.id) ? { ...vertex, ...positions.get(vertex.id) } : vertex) }),
    stair: {
      ...stair,
      dimensions: { ...stair.dimensions, ...layout },
      lifecycle: { ...stair.lifecycle, revision: (stair.lifecycle?.revision ?? 1) + 1, needsReview: false, reviewReason: null },
    },
  };
}

export function updateStairDimensions(boundary, stair, changes = {}) {
  const totalRise = Number(changes.totalRise ?? stair.dimensions.totalRise);
  const requestedRiserHeight = Number(changes.riserHeight ?? stair.dimensions.riserHeight);
  const treadDepth = Number(changes.treadDepth ?? stair.dimensions.treadDepth);
  if (!Number.isFinite(totalRise) || totalRise <= 0) throw new Error('Total rise must be positive.');
  if (!Number.isFinite(treadDepth) || treadDepth < MIN_TREAD_DEPTH || treadDepth > MAX_TREAD_DEPTH) throw new Error('Tread depth must remain between 10 and 11 inches.');
  let previousRiserCount = stair.dimensions.riserCount;
  if (changes.riserHeight !== undefined) {
    if (!Number.isFinite(requestedRiserHeight) || requestedRiserHeight < MIN_RISER_HEIGHT || requestedRiserHeight > MAX_RISER_HEIGHT) throw new Error('Riser height must remain between 5 and 7.5 inches.');
    previousRiserCount = Math.max(2, Math.round(totalRise / requestedRiserHeight));
  }
  const layout = solveStairLayout(totalRise, { previousRiserCount, targetRiserHeight: requestedRiserHeight, treadDepth });
  if (!layout) throw new Error(`No equal riser layout fits ${MIN_RISER_HEIGHT}″–${MAX_RISER_HEIGHT}″.`);
  const regenerated = regenerateStairGeometry(boundary, stair, layout);
  if (!regenerated) throw new Error('Stair geometry is incomplete.');
  const validation = validateDeckBoundary(regenerated.boundary);
  if (!validation.valid) throw new Error(`Stair cannot regenerate: ${validation.issues[0].message}`);
  return regenerated;
}

function rebuildBoundaryEdges(boundary, stair, vertices, idFactory = defaultId) {
  const oldByPair = new Map(boundary.edges.map((edge) => [`${edge.startVertexId}:${edge.endVertexId}`, normalizeBoundaryEdge(edge)]));
  const components = new Map(boundary.edges
    .filter((edge) => edge.properties?.attachments?.stairId === stair.id)
    .map((edge) => [edge.properties.attachments.stairComponent, normalizeBoundaryEdge(edge)]));
  const anchors = stair.anchors;
  return vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const pair = `${vertex.id}:${next.id}`;
    if (oldByPair.has(pair)) return oldByPair.get(pair);
    let component = null;
    if (vertex.id === anchors.openingStartVertexId && next.id === anchors.outerStartVertexId) component = 'left-stringer';
    if (vertex.id === anchors.outerStartVertexId && next.id === anchors.outerEndVertexId) component = 'lower-landing-edge';
    if (vertex.id === anchors.outerEndVertexId && next.id === anchors.openingEndVertexId) component = 'right-stringer';
    if (component) return stairEdge(components.get(component)?.id ?? idFactory('edge'), vertex.id, next.id, stair.id, component);
    const source = normalizeBoundaryEdge(stair.host?.sourceEdge ?? {});
    return normalizeBoundaryEdge({ ...source, id: source.id || idFactory('edge'), startVertexId: vertex.id, endVertexId: next.id });
  });
}

export function setStairSidePosition(boundary, stair, side, point, idFactory = defaultId) {
  if (!['start', 'end'].includes(side)) throw new Error('Select a valid stair side.');
  if ((side === 'start' && stair.dimensions.snappedStart) || (side === 'end' && stair.dimensions.snappedEnd)) throw new Error('This stair side is snapped to the base node. Recreate the stair to detach it.');
  const byId = new Map(boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const topStart = byId.get(stair.anchors.openingStartVertexId);
  const topEnd = byId.get(stair.anchors.openingEndVertexId);
  const outerStart = byId.get(stair.anchors.outerStartVertexId);
  const outerEnd = byId.get(stair.anchors.outerEndVertexId);
  const topStartIndex = boundary.vertices.findIndex((vertex) => vertex.id === topStart?.id);
  const topEndIndex = boundary.vertices.findIndex((vertex) => vertex.id === topEnd?.id);
  const hostStart = byId.get(stair.host?.originalStartVertexId)
    ?? (stair.dimensions.snappedStart ? topStart : boundary.vertices[(topStartIndex - 1 + boundary.vertices.length) % boundary.vertices.length]);
  const hostEnd = byId.get(stair.host?.originalEndVertexId)
    ?? (stair.dimensions.snappedEnd ? topEnd : boundary.vertices[(topEndIndex + 1) % boundary.vertices.length]);
  if (![topStart, topEnd, outerStart, outerEnd, hostStart, hostEnd].every(Boolean)) throw new Error('Stair host references are incomplete.');
  const hostLength = distance(hostStart, hostEnd);
  const unit = { x: (hostEnd.x - hostStart.x) / hostLength, y: (hostEnd.y - hostStart.y) / hostLength };
  let offset = (point.x - hostStart.x) * unit.x + (point.y - hostStart.y) * unit.y;
  const fixedOffset = side === 'start'
    ? (topEnd.x - hostStart.x) * unit.x + (topEnd.y - hostStart.y) * unit.y
    : (topStart.x - hostStart.x) * unit.x + (topStart.y - hostStart.y) * unit.y;
  offset = side === 'start' ? Math.max(0, Math.min(fixedOffset - 24, offset)) : Math.max(fixedOffset + 24, Math.min(hostLength, offset));
  const snapTarget = side === 'start' ? 0 : hostLength;
  const shouldSnap = Math.abs(offset - snapTarget) <= STAIR_SIDE_SNAP_TOLERANCE;
  offset = shouldSnap ? snapTarget : offset;
  const desired = { x: hostStart.x + unit.x * offset, y: hostStart.y + unit.y * offset };
  const movingTop = side === 'start' ? topStart : topEnd;
  const movingOuter = side === 'start' ? outerStart : outerEnd;
  const delta = { x: desired.x - movingTop.x, y: desired.y - movingTop.y };
  let nextStair = { ...stair, anchors: { ...stair.anchors }, interfaceEdge: { ...getStairInterfaceEdge(stair) } };
  let vertices = boundary.vertices.map((vertex) => [movingTop.id, movingOuter.id].includes(vertex.id) ? { ...vertex, x: vertex.x + delta.x, y: vertex.y + delta.y } : vertex);
  if (shouldSnap) {
    const target = side === 'start' ? hostStart : hostEnd;
    nextStair.anchors[side === 'start' ? 'openingStartVertexId' : 'openingEndVertexId'] = target.id;
    nextStair.interfaceEdge = { ...nextStair.interfaceEdge, [side === 'start' ? 'startVertexId' : 'endVertexId']: target.id };
    vertices = vertices.filter((vertex) => vertex.id !== movingTop.id);
  }
  const width = side === 'start' ? fixedOffset - offset : offset - fixedOffset;
  const startOffset = side === 'start' ? offset : fixedOffset;
  nextStair.dimensions = {
    ...nextStair.dimensions,
    width,
    startOffset,
    snappedStart: side === 'start' ? shouldSnap : nextStair.dimensions.snappedStart,
    snappedEnd: side === 'end' ? shouldSnap : nextStair.dimensions.snappedEnd,
  };
  const ordered = vertices.map((vertex, order) => ({ ...vertex, order }));
  const resizedBoundary = withComputedProperties({ ...boundary, vertices: ordered, edges: rebuildBoundaryEdges(boundary, nextStair, ordered, idFactory) });
  const validation = validateDeckBoundary(resizedBoundary);
  if (!validation.valid) throw new Error(`Stair width cannot change: ${validation.issues[0].message}`);
  return { boundary: resizedBoundary, stair: { ...nextStair, lifecycle: { ...nextStair.lifecycle, revision: (nextStair.lifecycle?.revision ?? 1) + 1 } } };
}

export function detachStairFromBoundary(boundary, stair, idFactory = defaultId) {
  const removeIds = new Set([stair.anchors.outerStartVertexId, stair.anchors.outerEndVertexId]);
  if (!stair.dimensions.snappedStart) removeIds.add(stair.anchors.openingStartVertexId);
  if (!stair.dimensions.snappedEnd) removeIds.add(stair.anchors.openingEndVertexId);
  const vertices = boundary.vertices.filter((vertex) => !removeIds.has(vertex.id)).map((vertex, order) => ({ ...vertex, order }));
  const oldByPair = new Map(boundary.edges.map((edge) => [`${edge.startVertexId}:${edge.endVertexId}`, normalizeBoundaryEdge(edge)]));
  const source = normalizeBoundaryEdge(stair.host?.sourceEdge ?? {});
  const edges = vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return oldByPair.get(`${vertex.id}:${next.id}`) ?? normalizeBoundaryEdge({ ...source, id: source.id || stair.host?.sourceEdgeId || idFactory('edge'), startVertexId: vertex.id, endVertexId: next.id });
  });
  const restored = withComputedProperties({ ...boundary, vertices, edges });
  const validation = validateDeckBoundary(restored);
  if (!validation.valid) throw new Error(`Stair cannot be removed safely: ${validation.issues[0].message}`);
  return restored;
}

export function setStairWidth(boundary, stair, width) {
  if (!Number.isFinite(width) || width < 24) throw new Error('Stair width must be at least 24 inches.');
  if (stair.dimensions.snappedStart || stair.dimensions.snappedEnd) throw new Error('This stair side is snapped to an adjacent node. Move the node to change its width.');
  const byId = new Map(boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const anchors = stair.anchors;
  const controlledIds = new Set(Object.values(anchors));
  if (boundary.vertices.some((vertex) => controlledIds.has(vertex.id) && vertex.locked)) throw new Error('Unlock the connected stair node before changing its width.');
  if (boundary.edges.some((edge) => edge.properties?.custom?.locked && (controlledIds.has(edge.startVertexId) || controlledIds.has(edge.endVertexId)))) throw new Error('Unlock the connected construction edge before changing stair width.');
  const topStart = byId.get(anchors.openingStartVertexId);
  const outerStart = byId.get(anchors.outerStartVertexId);
  const outerEnd = byId.get(anchors.outerEndVertexId);
  const topEnd = byId.get(anchors.openingEndVertexId);
  if (![topStart, outerStart, outerEnd, topEnd].every(Boolean)) throw new Error('Stair anchors are incomplete.');
  const currentWidth = distance(topStart, topEnd);
  const unit = { x: (topEnd.x - topStart.x) / currentWidth, y: (topEnd.y - topStart.y) / currentWidth };
  const topMid = { x: (topStart.x + topEnd.x) / 2, y: (topStart.y + topEnd.y) / 2 };
  const outerMid = { x: (outerStart.x + outerEnd.x) / 2, y: (outerStart.y + outerEnd.y) / 2 };
  const half = width / 2;
  const positions = new Map([
    [topStart.id, { x: topMid.x - unit.x * half, y: topMid.y - unit.y * half }],
    [topEnd.id, { x: topMid.x + unit.x * half, y: topMid.y + unit.y * half }],
    [outerStart.id, { x: outerMid.x - unit.x * half, y: outerMid.y - unit.y * half }],
    [outerEnd.id, { x: outerMid.x + unit.x * half, y: outerMid.y + unit.y * half }],
  ]);
  const resizedBoundary = withComputedProperties({
    ...boundary,
    vertices: boundary.vertices.map((vertex) => positions.has(vertex.id) ? { ...vertex, ...positions.get(vertex.id) } : vertex),
  });
  const validation = validateDeckBoundary(resizedBoundary);
  if (!validation.valid) throw new Error(`Stair width cannot change: ${validation.issues[0].message}`);
  return {
    boundary: resizedBoundary,
    stair: {
      ...stair,
      interfaceEdge: getStairInterfaceEdge(stair),
      dimensions: { ...stair.dimensions, width },
      lifecycle: { ...stair.lifecycle, revision: (stair.lifecycle?.revision ?? 1) + 1 },
    },
  };
}

function stairEdge(id, startVertexId, endVertexId, stairId, component) {
  return normalizeBoundaryEdge({
    id,
    startVertexId,
    endVertexId,
    role: 'stair',
    metadata: { generatedBy: stairId },
    properties: createEdgeProperties({ classification: { relationship: 'stair', exterior: true }, attachments: { stairId, stairComponent: component } }),
  });
}

export function deriveStairTreads(boundary, stair) {
  const byId = new Map(boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const a = byId.get(stair.anchors.openingStartVertexId);
  const b = byId.get(stair.anchors.outerStartVertexId);
  const c = byId.get(stair.anchors.outerEndVertexId);
  const d = byId.get(stair.anchors.openingEndVertexId);
  if (![a, b, c, d].every(Boolean)) return [];
  const riserCount = stair.dimensions.riserCount ?? stair.dimensions.stepCount;
  const treadCount = stair.dimensions.treadCount ?? Math.max(1, riserCount - 1);
  const interiorLineCount = Math.max(0, treadCount - 1);
  return Array.from({ length: interiorLineCount }, (_, index) => {
    const t = (index + 1) / treadCount;
    return {
      start: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
      end: { x: d.x + (c.x - d.x) * t, y: d.y + (c.y - d.y) * t },
    };
  });
}

export function deriveStairSideSegments(boundary, stair, side) {
  const byId = new Map(boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const start = byId.get(side === 'start' ? stair.anchors.openingStartVertexId : stair.anchors.openingEndVertexId);
  const end = byId.get(side === 'start' ? stair.anchors.outerStartVertexId : stair.anchors.outerEndVertexId);
  if (!start || !end) return [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-8) return [];
  const overlaps = [];
  for (const edge of boundary.edges) {
    if (edge.properties?.attachments?.stairId === stair.id) continue;
    const a = byId.get(edge.startVertexId);
    const b = byId.get(edge.endVertexId);
    if (!a || !b) continue;
    const crossDirection = Math.abs(dx * (b.y - a.y) - dy * (b.x - a.x));
    const crossOffset = Math.abs(dx * (a.y - start.y) - dy * (a.x - start.x));
    if (crossDirection > 1e-6 * Math.sqrt(lengthSquared) * Math.max(1, distance(a, b)) || crossOffset > 1e-6 * lengthSquared) continue;
    const ta = ((a.x - start.x) * dx + (a.y - start.y) * dy) / lengthSquared;
    const tb = ((b.x - start.x) * dx + (b.y - start.y) * dy) / lengthSquared;
    const from = Math.max(0, Math.min(ta, tb));
    const to = Math.min(1, Math.max(ta, tb));
    if (to - from > 1e-8) overlaps.push({ from, to, edgeId: edge.id });
  }
  const breaks = [...new Set([0, 1, ...overlaps.flatMap((overlap) => [overlap.from, overlap.to])])].sort((a, b) => a - b);
  return breaks.slice(0, -1).map((from, index) => {
    const to = breaks[index + 1];
    const midpoint = (from + to) / 2;
    const shared = overlaps.find((overlap) => midpoint >= overlap.from - 1e-8 && midpoint <= overlap.to + 1e-8);
    return {
      role: shared ? 'shared-boundary' : 'stair-only',
      boundaryEdgeId: shared?.edgeId ?? null,
      start: { x: start.x + dx * from, y: start.y + dy * from },
      end: { x: start.x + dx * to, y: start.y + dy * to },
      length: Math.sqrt(lengthSquared) * (to - from),
    };
  });
}
