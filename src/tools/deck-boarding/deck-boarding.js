import { getBoundaryArc } from '../../core/geometry/circular-arc.js';

export const DECK_BOARDING_SCHEMA_VERSION = 1;
export const DEFAULT_BOARD_WIDTH = 5.5;
export const DEFAULT_BOARD_GAP = 3 / 16;

const EPSILON = 1e-7;
const TAU = Math.PI * 2;

function normalizeAngle(angle) {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}

export function getDeckBoarding(boundary) {
  return boundary?.metadata?.deckBoarding ?? null;
}

export function setDeckBoardingDirection(boundary, start, end, reference = {}, options = {}) {
  const dx = Number(end?.x) - Number(start?.x);
  const dy = Number(end?.y) - Number(start?.y);
  if (!boundary || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < EPSILON) {
    throw new Error('Choose a construction line with a measurable direction.');
  }
  const current = getDeckBoarding(boundary);
  const deckBoarding = {
    schemaVersion: DECK_BOARDING_SCHEMA_VERSION,
    reference: {
      kind: reference.kind ?? 'construction-line',
      id: reference.id ?? null,
      ownerId: reference.ownerId ?? null,
    },
    pattern: 'linear',
    angleRadians: normalizeAngle(Math.atan2(dy, dx)),
    origin: { x: Number(start.x), y: Number(start.y) },
    boardWidth: Number(options.boardWidth ?? current?.boardWidth ?? DEFAULT_BOARD_WIDTH),
    gap: Number(options.gap ?? current?.gap ?? DEFAULT_BOARD_GAP),
  };
  return { ...boundary, metadata: { ...boundary.metadata, deckBoarding } };
}

export function setDeckBoardingCurve(boundary, arc, reference = {}, options = {}) {
  if (!boundary || !arc?.center || !Number.isFinite(arc.radius) || arc.radius <= EPSILON || !Number.isFinite(arc.sweep)) {
    throw new Error('Choose a curved Deck Boundary edge with a valid radius.');
  }
  const current = getDeckBoarding(boundary);
  return {
    ...boundary,
    metadata: {
      ...boundary.metadata,
      deckBoarding: {
        schemaVersion: DECK_BOARDING_SCHEMA_VERSION,
        reference: { kind: reference.kind ?? 'boundary-arc', id: reference.id ?? null, ownerId: reference.ownerId ?? boundary.id },
        pattern: 'curved',
        curve: {
          center: { x: Number(arc.center.x), y: Number(arc.center.y) },
          radius: Number(arc.radius),
          sweep: Number(arc.sweep),
        },
        angleRadians: normalizeAngle(Math.atan2(arc.points?.[1]?.y - arc.points?.[0]?.y || 0, arc.points?.[1]?.x - arc.points?.[0]?.x || 1)),
        origin: { x: Number(arc.start?.x ?? arc.points?.[0]?.x), y: Number(arc.start?.y ?? arc.points?.[0]?.y) },
        boardWidth: Number(options.boardWidth ?? current?.boardWidth ?? DEFAULT_BOARD_WIDTH),
        gap: Number(options.gap ?? current?.gap ?? DEFAULT_BOARD_GAP),
      },
    },
  };
}

export function rotateDeckBoardingDirection(boundary) {
  const current = getDeckBoarding(boundary);
  if (!current) return boundary;
  if (current.pattern === 'curved') return boundary;
  return {
    ...boundary,
    metadata: {
      ...boundary.metadata,
      deckBoarding: { ...current, angleRadians: normalizeAngle(current.angleRadians + Math.PI / 2) },
    },
  };
}

function pointInPolygon(candidate, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index]; const b = polygon[previous];
    const crosses = ((a.y > candidate.y) !== (b.y > candidate.y)) && candidate.x < (b.x - a.x) * (candidate.y - a.y) / ((b.y - a.y) || EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function deriveBoundaryOutline(boundary) {
  if (boundary.vertices.some((vertex) => vertex.archLineId)) return boundary.vertices;
  const verticesById = new Map(boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const outline = [];
  const emittedArcs = new Set();
  for (const edge of boundary.edges ?? []) {
    const arc = getBoundaryArc(boundary, edge.id);
    if (arc) {
      if (emittedArcs.has(arc.id)) continue;
      emittedArcs.add(arc.id);
      outline.push(...arc.points.slice(0, -1));
      continue;
    }
    const start = verticesById.get(edge.startVertexId);
    if (start) outline.push(start);
  }
  return outline.length >= 3 ? outline : boundary.vertices;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * amount), point.y - (start.y + dy * amount));
}

function deriveCurvedBoardingSegments(boundary, exclusionPolygons, boarding, pitch, options) {
  const currentReferenceArc = boarding.reference?.id ? getBoundaryArc(boundary, boarding.reference.id) : null;
  const center = currentReferenceArc?.center ?? boarding.curve?.center;
  const referenceRadius = currentReferenceArc?.radius ?? boarding.curve?.radius;
  if (!center || !Number.isFinite(referenceRadius)) return [];
  const outline = deriveBoundaryOutline(boundary);
  const radii = outline.map((point) => Math.hypot(point.x - center.x, point.y - center.y));
  const minimumRadius = pointInPolygon(center, outline) ? 0 : Math.min(...outline.map((point, index) => distanceToSegment(center, point, outline[(index + 1) % outline.length])));
  const firstIndex = Math.ceil((minimumRadius - referenceRadius + EPSILON) / pitch);
  const lastIndex = Math.floor((Math.max(...radii) - referenceRadius - EPSILON) / pitch);
  const maxLines = Math.max(1, Number(options.maxLines ?? 2000));
  const exclusions = exclusionPolygons.filter((polygon) => Array.isArray(polygon) && polygon.length >= 3);
  const segments = [];
  for (let row = firstIndex; row <= lastIndex && row - firstIndex < maxLines; row += 1) {
    const radius = referenceRadius + row * pitch;
    if (radius <= EPSILON) continue;
    const count = Math.max(96, Math.min(720, Math.ceil(TAU * radius / 2.5)));
    let active = [];
    const flush = () => { if (active.length > 1) segments.push({ curved: true, radius, center: { ...center }, points: active }); active = []; };
    for (let index = 0; index <= count; index += 1) {
      const angle = TAU * index / count;
      const point = { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
      if (index === 0) { active = [point]; continue; }
      const previous = active.at(-1) ?? { x: center.x + radius * Math.cos(TAU * (index - 1) / count), y: center.y + radius * Math.sin(TAU * (index - 1) / count) };
      const midpoint = { x: (previous.x + point.x) / 2, y: (previous.y + point.y) / 2 };
      const visible = pointInPolygon(midpoint, outline) && !exclusions.some((polygon) => pointInPolygon(midpoint, polygon));
      if (visible) {
        if (!active.length) active.push(previous);
        active.push(point);
      } else flush();
    }
    flush();
  }
  return segments;
}

export function clearDeckBoardingDirection(boundary) {
  if (!getDeckBoarding(boundary)) return boundary;
  const metadata = { ...boundary.metadata };
  delete metadata.deckBoarding;
  return { ...boundary, metadata };
}

function lineIntervalsAtOffset(points, origin, direction, normal, offset) {
  const transformed = points.map((point) => ({
    u: (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y,
    v: (point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y,
  }));
  const intersections = [];
  transformed.forEach((first, index) => {
    const second = transformed[(index + 1) % transformed.length];
    if (!((first.v <= offset && second.v > offset) || (second.v <= offset && first.v > offset))) return;
    const t = (offset - first.v) / (second.v - first.v);
    intersections.push(first.u + (second.u - first.u) * t);
  });
  intersections.sort((a, b) => a - b);
  const intervals = [];
  for (let index = 0; index + 1 < intersections.length; index += 2) {
    if (intersections[index + 1] - intersections[index] > EPSILON) intervals.push([intersections[index], intersections[index + 1]]);
  }
  return intervals;
}

function subtractInterval(source, cut) {
  const [start, end] = source;
  const [cutStart, cutEnd] = cut;
  if (cutEnd <= start + EPSILON || cutStart >= end - EPSILON) return [source];
  const result = [];
  if (cutStart > start + EPSILON) result.push([start, Math.min(end, cutStart)]);
  if (cutEnd < end - EPSILON) result.push([Math.max(start, cutEnd), end]);
  return result;
}

export function deriveDeckBoardingSegments(boundary, exclusionPolygons = [], options = {}) {
  const boarding = getDeckBoarding(boundary);
  if (!boarding || !Array.isArray(boundary?.vertices) || boundary.vertices.length < 3) return [];
  const pitch = Number(options.pitch ?? boarding.boardWidth + boarding.gap);
  if (!Number.isFinite(pitch) || pitch <= EPSILON) return [];
  if (boarding.pattern === 'curved' && boarding.curve) return deriveCurvedBoardingSegments(boundary, exclusionPolygons, boarding, pitch, options);
  const origin = boarding.origin;
  const direction = { x: Math.cos(boarding.angleRadians), y: Math.sin(boarding.angleRadians) };
  const normal = { x: -direction.y, y: direction.x };
  const offsets = boundary.vertices.map((point) => (point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y);
  const firstIndex = Math.ceil((Math.min(...offsets) + EPSILON) / pitch);
  const lastIndex = Math.floor((Math.max(...offsets) - EPSILON) / pitch);
  const maxLines = Math.max(1, Number(options.maxLines ?? 2000));
  const segments = [];
  for (let index = firstIndex; index <= lastIndex && index - firstIndex < maxLines; index += 1) {
    const offset = index * pitch;
    let intervals = lineIntervalsAtOffset(boundary.vertices, origin, direction, normal, offset);
    for (const polygon of exclusionPolygons.filter((points) => Array.isArray(points) && points.length >= 3)) {
      for (const cut of lineIntervalsAtOffset(polygon, origin, direction, normal, offset)) {
        intervals = intervals.flatMap((interval) => subtractInterval(interval, cut));
      }
    }
    intervals.forEach(([start, end]) => segments.push({
      start: { x: origin.x + direction.x * start + normal.x * offset, y: origin.y + direction.y * start + normal.y * offset },
      end: { x: origin.x + direction.x * end + normal.x * offset, y: origin.y + direction.y * end + normal.y * offset },
    }));
  }
  return segments;
}
