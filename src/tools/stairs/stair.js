import { createEdgeProperties, mergeEdgeProperties, normalizeBoundaryEdge } from '../../core/construction-objects/edge-properties.js';
import { distance } from '../../core/geometry/vector.js';
import { validateDeckBoundary, withComputedProperties } from '../deck-boundary/deck-boundary.js';

export const STAIR_TYPE = 'stair';
export const STAIR_SCHEMA_VERSION = 1;
export const MAX_RISER_HEIGHT = 7.5;
export const MAX_TREAD_DEPTH = 11;
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

export function calculateStairDragLayout(totalRun, riseToRunRatio = 0.9) {
  const run = Math.max(0, Number(totalRun));
  if (!Number.isFinite(run) || run < 6) return null;
  const totalRise = Math.max(0.5, Math.round(run * riseToRunRatio * 2) / 2);
  const riserCount = Math.max(2, Math.ceil(totalRise / MAX_RISER_HEIGHT), Math.ceil(run / MAX_TREAD_DEPTH) + 1);
  const treadCount = riserCount - 1;
  return {
    stepCount: riserCount,
    riserCount,
    treadCount,
    totalRise,
    totalRun: run,
    riserHeight: totalRise / riserCount,
    treadDepth: run / treadCount,
  };
}

export function deriveStairOpeningSnap(boundary, edgeId, pointer, preferredWidth = 36, snapTolerance = 12) {
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
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const totalRun = Math.max(0, (pointer.x - midpoint.x) * normal.x + (pointer.y - midpoint.y) * normal.y);
  const layout = calculateStairDragLayout(totalRun);
  return layout ? { width, startOffset, ...layout } : null;
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
  if (options.treadDepth > MAX_TREAD_DEPTH) issues.push('Each stair tread must be 11 inches or less.');
  if (Number.isFinite(options.totalRise) && options.totalRise > 0) {
    const layout = calculateStairLayout(options.totalRise, options.targetRiserHeight ?? MAX_RISER_HEIGHT, options.treadDepth);
    const riserHeight = Number.isInteger(options.riserCount) && options.riserCount >= 2 ? options.totalRise / options.riserCount : layout.riserHeight;
    if (riserHeight > MAX_RISER_HEIGHT) issues.push('Each stair riser must be 7.5 inches or less.');
  }
  if (boundary.edges[edgeIndex]?.properties?.attachments?.stairId) issues.push('This edge already belongs to a staircase.');
  if (boundary.edges[edgeIndex]?.properties?.custom?.locked) issues.push('Unlock this construction edge before attaching stairs.');
  return { valid: issues.length === 0, issues, edgeLength };
}

export function attachStairToBoundary(boundary, edgeId, options = {}, idFactory = defaultId) {
  const settings = { width: 36, totalRise: 36, treadDepth: 10, targetRiserHeight: 7.5, ...options };
  const validation = validateStairPlacement(boundary, edgeId, settings);
  if (!validation.valid) throw new Error(validation.issues.join(' '));
  const edgeIndex = boundary.edges.findIndex((edge) => edge.id === edgeId);
  const sourceEdge = normalizeBoundaryEdge(boundary.edges[edgeIndex]);
  const start = boundary.vertices[edgeIndex];
  const end = boundary.vertices[(edgeIndex + 1) % boundary.vertices.length];
  const length = distance(start, end);
  const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  const outwardSign = signedTwiceArea(boundary.vertices) >= 0 ? 1 : -1;
  const normal = { x: unit.y * outwardSign, y: -unit.x * outwardSign };
  const calculatedLayout = calculateStairLayout(settings.totalRise, settings.targetRiserHeight, settings.treadDepth);
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
  const stairId = idFactory('stair');
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
    host: { boundaryId: boundary.id, sourceEdgeId: edgeId },
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
    lifecycle: { phase: 'established', revision: 1 },
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
  return Array.from({ length: treadCount }, (_, index) => {
    const t = (index + 1) / riserCount;
    return {
      start: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
      end: { x: d.x + (c.x - d.x) * t, y: d.y + (c.y - d.y) * t },
    };
  });
}
