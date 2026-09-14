export const CAT_LINE_TYPE = 'cat-construction-line';
export const CAT_MEASUREMENT_TYPE = 'cat-measurement';
export const CAT_NOTE_TYPE = 'cat-note';
export const CAT_OBJECT_SCHEMA_VERSION = 1;

const defaultId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const point = (value) => ({ x: Number(value.x), y: Number(value.y) });

function validatePoints(start, end) {
  if (![start?.x, start?.y, end?.x, end?.y].every(Number.isFinite)) throw new Error('CAT geometry requires two valid points.');
  if (Math.hypot(end.x - start.x, end.y - start.y) < .5) throw new Error('CAT points must be different.');
}

export function createCatLine(start, end, options = {}, idFactory = defaultId) {
  validatePoints(start, end);
  const id = idFactory('cat-line');
  return {
    type: CAT_LINE_TYPE,
    schemaVersion: CAT_OBJECT_SCHEMA_VERSION,
    id,
    name: options.name ?? 'CAT construction line',
    vertices: [
      { id: `${id}:start`, ...point(start) },
      { id: `${id}:end`, ...point(end) },
    ],
    edges: [{ id: `${id}:edge`, role: 'cat-reference' }],
    geometry: options.geometry ?? { kind: 'line' },
    metadata: structuredClone(options.metadata ?? {}),
    lifecycle: { phase: 'reference', revision: 1 },
  };
}

export function deriveCatLineGeometry(line) {
  if (line.type !== CAT_LINE_TYPE) throw new Error('A CAT Line is required.');
  const [start, end] = line.vertices;
  const sagitta = Number(line.geometry?.sagitta ?? 0);
  const arc = line.geometry?.kind === 'arc' && Math.abs(sagitta) >= .01 ? circularArc(start, end, sagitta) : null;
  return arc ? { kind: 'arc', ...arc } : { kind: 'line', points: [point(start), point(end)], length: Math.hypot(end.x - start.x, end.y - start.y), sagitta: 0 };
}

export function setCatLineSagitta(line, sagitta) {
  if (line.type !== CAT_LINE_TYPE) throw new Error('Arch line requires a CAT Line.');
  const [start, end] = line.vertices;
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  if (!Number.isFinite(sagitta)) throw new Error('Arc offset must be a finite number.');
  if (Math.abs(sagitta) > chord / 2 + 1e-8) throw new Error('CAT Arch line supports arcs up to a semicircle.');
  return {
    ...line,
    geometry: Math.abs(sagitta) < .01 ? { kind: 'line' } : { kind: 'arc', sagitta: Math.round(sagitta * 16) / 16 },
    lifecycle: { ...line.lifecycle, revision: Number(line.lifecycle?.revision ?? 0) + 1 },
  };
}

export function dragCatLineArc(line, candidate) {
  const [start, end] = line.vertices;
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  const h = ((candidate.x - (start.x + end.x) / 2) * -(end.y - start.y) + (candidate.y - (start.y + end.y) / 2) * (end.x - start.x)) / chord;
  return setCatLineSagitta(line, Math.max(-chord / 2, Math.min(chord / 2, h)));
}

export function deriveCatOffset(line, candidate) {
  const geometry = deriveCatLineGeometry(line);
  if (geometry.kind === 'arc') {
    const candidateRadius = Math.hypot(candidate.x - geometry.center.x, candidate.y - geometry.center.y);
    const sign = candidateRadius >= geometry.radius ? 1 : -1;
    return { kind: 'radial', sign, distance: Math.abs(candidateRadius - geometry.radius), signedDistance: sign * Math.abs(candidateRadius - geometry.radius), originalRadius: geometry.radius, targetRadius: candidateRadius };
  }
  const [start, end] = line.vertices;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const normal = { x: -(end.y - start.y) / length, y: (end.x - start.x) / length };
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const signedDistance = (candidate.x - midpoint.x) * normal.x + (candidate.y - midpoint.y) * normal.y;
  return { kind: 'parallel', sign: signedDistance < 0 ? -1 : 1, distance: Math.abs(signedDistance), signedDistance, normal };
}

export function offsetCatLine(line, candidate, options = {}, idFactory = defaultId) {
  if (line.type !== CAT_LINE_TYPE) throw new Error('Offset requires a CAT Line.');
  const geometry = deriveCatLineGeometry(line);
  const derived = deriveCatOffset(line, candidate);
  const requested = Number(options.distanceInches);
  const distance = (Number.isFinite(requested) && requested > 0 ? requested : derived.distance) * derived.sign;
  if (Math.abs(distance) < .01) throw new Error('Move away from the source line or type a positive Offset distance.');
  const metadata = { ...structuredClone(options.metadata ?? {}), offset: { sourceLineId: line.id, distanceInches: distance } };
  if (geometry.kind === 'arc') {
    const targetRadius = geometry.radius + distance;
    if (targetRadius < .5) throw new Error('Offset distance must be smaller than the inside arc radius.');
    const scale = targetRadius / geometry.radius;
    const move = (source) => ({ x: geometry.center.x + (source.x - geometry.center.x) * scale, y: geometry.center.y + (source.y - geometry.center.y) * scale });
    return createCatLine(move(line.vertices[0]), move(line.vertices[1]), {
      name: options.name ?? 'CAT arc offset', geometry: { kind: 'arc', sagitta: geometry.sagitta * scale }, metadata,
    }, idFactory);
  }
  const [start, end] = line.vertices;
  const normal = derived.normal;
  return createCatLine(
    { x: start.x + normal.x * distance, y: start.y + normal.y * distance },
    { x: end.x + normal.x * distance, y: end.y + normal.y * distance },
    { name: options.name ?? 'CAT offset line', metadata }, idFactory,
  );
}

function infiniteLineIntersection(first, second) {
  const [a, b] = first.vertices; const [c, d] = second.vertices;
  const rx = b.x - a.x; const ry = b.y - a.y; const sx = d.x - c.x; const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-8) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
  return { x: a.x + rx * t, y: a.y + ry * t };
}

function sharedEndpointIndices(first, second, tolerance = .5) {
  for (let a = 0; a < 2; a += 1) for (let b = 0; b < 2; b += 1) if (closeEnough(first.vertices[a], second.vertices[b], tolerance)) return [a, b];
  return null;
}

function replaceLineEndpoint(line, index, position) {
  return { ...line, vertices: line.vertices.map((vertex, vertexIndex) => vertexIndex === index ? { ...vertex, ...position } : vertex), lifecycle: { ...line.lifecycle, revision: Number(line.lifecycle?.revision ?? 0) + 1 } };
}

export function applyCatOffset(document, sourceLineId, candidate, options = {}, idFactory = defaultId) {
  const source = getCatLines(document).find((line) => line.id === sourceLineId);
  if (!source) throw new Error('Offset source CAT Line was not found.');
  let created = offsetCatLine(source, candidate, options, idFactory);
  let objects = [...document.objects];
  const requestedMagnitude = Math.abs(created.metadata.offset.distanceInches);
  const sources = new Map(getCatLines(document).map((line) => [line.id, line]));
  const adjacentOffsets = getCatLines(document).filter((line) => {
    const otherSource = sources.get(line.metadata?.offset?.sourceLineId);
    return otherSource && Math.abs(Math.abs(Number(line.metadata.offset.distanceInches)) - requestedMagnitude) < .01 && sharedEndpointIndices(source, otherSource);
  });
  adjacentOffsets.forEach((existing) => {
    if (deriveCatLineGeometry(created).kind !== 'line' || deriveCatLineGeometry(existing).kind !== 'line') return;
    const otherSource = sources.get(existing.metadata.offset.sourceLineId);
    const sourceShared = sharedEndpointIndices(source, otherSource);
    const intersection = infiniteLineIntersection(created, existing);
    if (!sourceShared || !intersection) return;
    created = replaceLineEndpoint(created, sourceShared[0], intersection);
    const updatedExisting = replaceLineEndpoint(existing, sourceShared[1], intersection);
    objects = objects.map((object) => object.id === existing.id ? updatedExisting : object);
  });
  objects.push(created);
  return { document: { ...document, objects }, line: created, distanceInches: requestedMagnitude };
}

function closeEnough(a, b, tolerance) { return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance; }
function polygonArea(vertices) { return Math.abs(vertices.reduce((sum, vertex, index) => { const next = vertices[(index + 1) % vertices.length]; return sum + vertex.x * next.y - next.x * vertex.y; }, 0)) / 2; }
function polygonCentroid(vertices) {
  const signed = vertices.reduce((sum, vertex, index) => { const next = vertices[(index + 1) % vertices.length]; return sum + vertex.x * next.y - next.x * vertex.y; }, 0) / 2;
  if (Math.abs(signed) < 1e-8) return { x: vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length, y: vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length };
  let x = 0; let y = 0;
  vertices.forEach((vertex, index) => { const next = vertices[(index + 1) % vertices.length]; const cross = vertex.x * next.y - next.x * vertex.y; x += (vertex.x + next.x) * cross; y += (vertex.y + next.y) * cross; });
  return { x: x / (6 * signed), y: y / (6 * signed) };
}

export function deriveCatBoundaries(document, tolerance = .5) {
  const lines = getCatLines(document);
  const unused = new Set(lines.map((line) => line.id));
  const results = [];
  while (unused.size) {
    const seed = lines.find((line) => unused.has(line.id));
    const component = [];
    const queue = [seed]; unused.delete(seed.id);
    while (queue.length) {
      const line = queue.shift(); component.push(line);
      const endpoints = line.vertices;
      lines.filter((candidate) => unused.has(candidate.id) && candidate.vertices.some((p) => endpoints.some((q) => closeEnough(p, q, tolerance)))).forEach((candidate) => { unused.delete(candidate.id); queue.push(candidate); });
    }
    if (component.length < 3) continue;
    const nodes = [];
    const nodeFor = (p) => { let index = nodes.findIndex((node) => closeEnough(node.point, p, tolerance)); if (index < 0) { index = nodes.length; nodes.push({ point: point(p), links: [] }); } return index; };
    component.forEach((line) => { const a = nodeFor(line.vertices[0]); const b = nodeFor(line.vertices[1]); nodes[a].links.push({ line, other: b, reverse: false }); nodes[b].links.push({ line, other: a, reverse: true }); });
    if (nodes.some((node) => node.links.length !== 2)) continue;
    const ordered = []; let nodeIndex = 0; let previousLineId = null;
    do {
      const link = nodes[nodeIndex].links.find((entry) => entry.line.id !== previousLineId);
      if (!link || ordered.some((entry) => entry.line.id === link.line.id)) break;
      ordered.push(link); previousLineId = link.line.id; nodeIndex = link.other;
    } while (nodeIndex !== 0 && ordered.length <= component.length);
    if (nodeIndex !== 0 || ordered.length !== component.length) continue;
    const sampled = [];
    ordered.forEach((entry, index) => {
      const geometry = deriveCatLineGeometry(entry.line);
      const points = entry.reverse ? [...geometry.points].reverse() : geometry.points;
      sampled.push(...(index ? points.slice(1) : points));
    });
    if (closeEnough(sampled[0], sampled.at(-1), tolerance)) sampled.pop();
    const areaSquareInches = polygonArea(sampled);
    if (areaSquareInches < 1) continue;
    const sortedIds = component.map((line) => line.id).sort();
    results.push({ id: `cat-boundary:${sortedIds.join('|')}`, lineIds: sortedIds, segments: ordered.map((entry) => ({ lineId: entry.line.id, reverse: entry.reverse, sagitta: Number(entry.line.geometry?.sagitta ?? 0) })), vertices: sampled, corners: ordered.map((entry) => point(entry.reverse ? entry.line.vertices[1] : entry.line.vertices[0])), areaSquareInches, centroid: polygonCentroid(sampled) });
  }
  return results;
}

export function createCatMeasurement(start, end, options = {}, idFactory = defaultId) {
  validatePoints(start, end);
  const id = idFactory('cat-measure');
  return {
    type: CAT_MEASUREMENT_TYPE,
    schemaVersion: CAT_OBJECT_SCHEMA_VERSION,
    id,
    name: options.name ?? 'CAT measuring tape',
    start: point(start),
    end: point(end),
    lifecycle: { phase: 'annotation', revision: 1 },
  };
}

export function createCatNote(anchor, text = '', options = {}, idFactory = defaultId) {
  if (![anchor?.x, anchor?.y].every(Number.isFinite)) throw new Error('CAT Note requires a valid arrow point.');
  const id = idFactory('cat-note');
  return {
    type: CAT_NOTE_TYPE,
    schemaVersion: CAT_OBJECT_SCHEMA_VERSION,
    id,
    name: options.name ?? 'CAT construction note',
    anchor: point(anchor),
    labelOffset: options.labelOffset ? point(options.labelOffset) : { x: 42, y: -34 },
    text: String(text).trim(),
    audioDataUrl: options.audioDataUrl ?? null,
    lifecycle: { phase: 'annotation', revision: 1 },
  };
}

export function updateCatNote(note, patch = {}) {
  if (note.type !== CAT_NOTE_TYPE) throw new Error('A CAT Note is required.');
  return {
    ...note,
    text: patch.text === undefined ? note.text : String(patch.text).trim(),
    audioDataUrl: patch.audioDataUrl === undefined ? note.audioDataUrl : patch.audioDataUrl,
    labelOffset: patch.labelOffset ? point(patch.labelOffset) : note.labelOffset,
    lifecycle: { ...note.lifecycle, revision: Number(note.lifecycle?.revision ?? 0) + 1 },
  };
}

export function deriveCatMeasurement(measurement) {
  const horizontal = measurement.end.x - measurement.start.x;
  const vertical = measurement.end.y - measurement.start.y;
  return {
    horizontal,
    vertical,
    horizontalDistance: Math.abs(horizontal),
    verticalDistance: Math.abs(vertical),
    pointToPointDistance: Math.hypot(horizontal, vertical),
    corner: { x: measurement.end.x, y: measurement.start.y },
    midpoint: { x: (measurement.start.x + measurement.end.x) / 2, y: (measurement.start.y + measurement.end.y) / 2 },
  };
}

export function resolveCatLineEndpoint(start, toward, length) {
  if (![start?.x, start?.y, toward?.x, toward?.y, length].every(Number.isFinite) || length <= 0) {
    throw new Error('CAT Line requires a valid direction and positive length.');
  }
  const dx = toward.x - start.x;
  const dy = toward.y - start.y;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude < .0001) return { x: start.x + length, y: start.y };
  return { x: start.x + dx / magnitude * length, y: start.y + dy / magnitude * length };
}

function lineIntersection(start, end, cutter) {
  const rx = end.x - start.x;
  const ry = end.y - start.y;
  const sx = cutter.end.x - cutter.start.x;
  const sy = cutter.end.y - cutter.start.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-8) return null;
  const qx = cutter.start.x - start.x;
  const qy = cutter.start.y - start.y;
  const lineT = (qx * sy - qy * sx) / denominator;
  const cutterT = (qx * ry - qy * rx) / denominator;
  if (cutterT < -1e-8 || cutterT > 1 + 1e-8) return null;
  return { lineT, point: { x: start.x + rx * lineT, y: start.y + ry * lineT } };
}

function projectParameter(start, end, candidate) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  return ((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSquared;
}

const TAU = Math.PI * 2;
const normalizeAngle = (angle) => ((angle % TAU) + TAU) % TAU;
const directedTravel = (from, to, direction) => normalizeAngle((to - from) * direction);

function intersectionGeometry(value) {
  if (value?.type === CAT_LINE_TYPE) {
    const geometry = deriveCatLineGeometry(value);
    return geometry.kind === 'arc'
      ? { ...geometry, type: 'arc', start: value.vertices[0], end: value.vertices[1] }
      : { type: 'line', start: value.vertices[0], end: value.vertices[1] };
  }
  if (value?.start && value?.end) return { type: 'line', start: value.start, end: value.end };
  throw new Error('A CAT Line or construction segment is required.');
}

function lineCircleIntersections(line, circle) {
  const dx = line.end.x - line.start.x; const dy = line.end.y - line.start.y;
  const fx = line.start.x - circle.center.x; const fy = line.start.y - circle.center.y;
  const a = dx * dx + dy * dy; const b = 2 * (fx * dx + fy * dy); const c = fx * fx + fy * fy - circle.radius * circle.radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -1e-8) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  return [...new Set([(-b - root) / (2 * a), (-b + root) / (2 * a)].map((value) => Math.round(value * 1e10) / 1e10))]
    .map((t) => ({ x: line.start.x + dx * t, y: line.start.y + dy * t }));
}

function circleCircleIntersections(first, second) {
  const dx = second.center.x - first.center.x; const dy = second.center.y - first.center.y; const distance = Math.hypot(dx, dy);
  if (distance < 1e-8 && Math.abs(first.radius - second.radius) < 1e-8) throw new Error('The two arcs follow the same circumference and do not define one intersection.');
  if (distance > first.radius + second.radius + 1e-8 || distance < Math.abs(first.radius - second.radius) - 1e-8 || distance < 1e-8) return [];
  const along = (first.radius * first.radius - second.radius * second.radius + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, first.radius * first.radius - along * along));
  const base = { x: first.center.x + dx / distance * along, y: first.center.y + dy / distance * along };
  const normal = { x: -dy / distance, y: dx / distance };
  const results = [{ x: base.x + normal.x * height, y: base.y + normal.y * height }];
  if (height > 1e-8) results.push({ x: base.x - normal.x * height, y: base.y - normal.y * height });
  return results;
}

function geometryIntersections(firstValue, secondValue) {
  const first = intersectionGeometry(firstValue); const second = intersectionGeometry(secondValue);
  if (first.type === 'line' && second.type === 'line') {
    const intersection = lineIntersection(first.start, first.end, second);
    return intersection ? [intersection.point] : [];
  }
  if (first.type === 'line') return lineCircleIntersections(first, second);
  if (second.type === 'line') return lineCircleIntersections(second, first);
  return circleCircleIntersections(first, second);
}

function arcProgress(geometry, candidate) {
  const direction = Math.sign(geometry.sweep) || 1;
  const startAngle = Math.atan2(geometry.start.y - geometry.center.y, geometry.start.x - geometry.center.x);
  const angle = Math.atan2(candidate.y - geometry.center.y, candidate.x - geometry.center.x);
  return directedTravel(startAngle, angle, direction) / Math.abs(geometry.sweep);
}

function liesOnFiniteGeometry(value, candidate) {
  const geometry = intersectionGeometry(value);
  if (geometry.type === 'line') { const t = projectParameter(geometry.start, geometry.end, candidate); return t >= -1e-7 && t <= 1 + 1e-7; }
  const progress = arcProgress(geometry, candidate);
  return progress >= -1e-7 && progress <= 1 + 1e-7;
}

function updateCatArc(line, start, end, sweep) {
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  if (chord < .5 || Math.abs(sweep) < 1e-5 || Math.abs(sweep) >= TAU - 1e-5) throw new Error('The resulting CAT arc is not valid.');
  const sagitta = -(chord / 2) * Math.tan(sweep / 4);
  return {
    ...line,
    vertices: [{ ...line.vertices[0], ...point(start) }, { ...line.vertices[1], ...point(end) }],
    geometry: { kind: 'arc', sagitta },
    lifecycle: { ...line.lifecycle, revision: Number(line.lifecycle?.revision ?? 0) + 1 },
  };
}

export function trimCatLine(line, clickPoint, cutters = []) {
  if (line.type !== CAT_LINE_TYPE) throw new Error('Trim requires a CAT Line.');
  const geometry = intersectionGeometry(line);
  const intersections = cutters.flatMap((cutter) => geometryIntersections(line, cutter).filter((candidate) => liesOnFiniteGeometry(line, candidate) && liesOnFiniteGeometry(cutter, candidate)));
  if (!intersections.length) throw new Error('No crossing line was found inside this CAT Line or arc.');
  const parameter = (candidate) => geometry.type === 'arc' ? arcProgress(geometry, candidate) : projectParameter(geometry.start, geometry.end, candidate);
  const clickT = geometry.type === 'arc' ? arcProgress(geometry, clickPoint) : projectParameter(geometry.start, geometry.end, clickPoint);
  const intersection = intersections.map((candidate) => ({ point: candidate, lineT: parameter(candidate) })).filter((entry) => entry.lineT > 1e-6 && entry.lineT < 1 - 1e-6).sort((a, b) => Math.abs(a.lineT - clickT) - Math.abs(b.lineT - clickT))[0];
  if (!intersection) throw new Error('No crossing line was found inside this CAT Line or arc.');
  const trimStart = clickT <= intersection.lineT;
  if (geometry.type === 'arc') {
    const remainingSweep = geometry.sweep * (trimStart ? 1 - intersection.lineT : intersection.lineT);
    return trimStart ? updateCatArc(line, intersection.point, geometry.end, remainingSweep) : updateCatArc(line, geometry.start, intersection.point, remainingSweep);
  }
  const [start, end] = line.vertices;
  return {
    ...line,
    vertices: trimStart
      ? [{ ...start, ...intersection.point }, end]
      : [start, { ...end, ...intersection.point }],
    lifecycle: { ...line.lifecycle, revision: Number(line.lifecycle?.revision ?? 0) + 1 },
  };
}

export function extendCatLineToLine(line, target, clickPoint) {
  if (line.type !== CAT_LINE_TYPE || target?.type !== CAT_LINE_TYPE) throw new Error('Extend requires two CAT Lines.');
  if (line.id === target.id) throw new Error('Choose a different CAT Line as the intersection reference.');
  const geometry = intersectionGeometry(line);
  const [start, end] = line.vertices;
  const extendStart = Math.hypot(clickPoint.x - start.x, clickPoint.y - start.y) <= Math.hypot(clickPoint.x - end.x, clickPoint.y - end.y);
  const intersections = geometryIntersections(line, target);
  if (geometry.type === 'arc') {
    const direction = Math.sign(geometry.sweep) || 1;
    const startAngle = Math.atan2(start.y - geometry.center.y, start.x - geometry.center.x);
    const endAngle = Math.atan2(end.y - geometry.center.y, end.x - geometry.center.x);
    const candidates = intersections.map((candidate) => {
      const angle = Math.atan2(candidate.y - geometry.center.y, candidate.x - geometry.center.x);
      const travel = extendStart ? directedTravel(startAngle, angle, -direction) : directedTravel(endAngle, angle, direction);
      return { point: candidate, travel };
    }).filter((entry) => entry.travel > 1e-6 && Math.abs(geometry.sweep) + entry.travel < TAU - 1e-5).sort((a, b) => a.travel - b.travel);
    if (!candidates.length) throw new Error(`The CAT arc does not reach the selected line by extending its ${extendStart ? 'start' : 'end'} along the same circumference.`);
    const intersection = candidates[0];
    const sweep = geometry.sweep + direction * intersection.travel;
    return extendStart ? updateCatArc(line, intersection.point, end, sweep) : updateCatArc(line, start, intersection.point, sweep);
  }
  const candidates = intersections.map((candidate) => ({ point: candidate, lineT: projectParameter(start, end, candidate) }));
  const valid = extendStart ? candidates.filter((entry) => entry.lineT < -1e-6).sort((a, b) => b.lineT - a.lineT) : candidates.filter((entry) => entry.lineT > 1 + 1e-6).sort((a, b) => a.lineT - b.lineT);
  if (!valid.length) throw new Error(`The selected lines do not intersect beyond the ${extendStart ? 'start' : 'end'} of the first line.`);
  const intersection = valid[0];
  return {
    ...line,
    vertices: extendStart
      ? [{ ...start, ...intersection.point }, end]
      : [start, { ...end, ...intersection.point }],
    lifecycle: { ...line.lifecycle, revision: Number(line.lifecycle?.revision ?? 0) + 1 },
  };
}

export function extendCatLine(line, clickPoint, cutters = []) {
  const results = cutters.map((cutter) => {
    const target = cutter.type === CAT_LINE_TYPE ? cutter : createCatLine(cutter.start, cutter.end, {}, () => cutter.id ?? 'temporary-cutter');
    try { return extendCatLineToLine(line, target, clickPoint); } catch { return null; }
  }).filter(Boolean);
  if (!results.length) throw new Error('No line intersection was found in the selected extension direction.');
  const endpoint = Math.hypot(clickPoint.x - line.vertices[0].x, clickPoint.y - line.vertices[0].y) <= Math.hypot(clickPoint.x - line.vertices[1].x, clickPoint.y - line.vertices[1].y) ? 0 : 1;
  return results.sort((a, b) => Math.hypot(a.vertices[endpoint].x - line.vertices[endpoint].x, a.vertices[endpoint].y - line.vertices[endpoint].y) - Math.hypot(b.vertices[endpoint].x - line.vertices[endpoint].x, b.vertices[endpoint].y - line.vertices[endpoint].y))[0];
}

export function getCatLines(document) {
  return document.objects.filter((object) => object.type === CAT_LINE_TYPE);
}

export function getCatMeasurements(document) {
  return document.objects.filter((object) => object.type === CAT_MEASUREMENT_TYPE);
}

export function getCatNotes(document) {
  return document.objects.filter((object) => object.type === CAT_NOTE_TYPE);
}

export function getCatSnapObjects(document) {
  const lines = getCatLines(document).map((line) => ({ ...line, snapSource: 'cat', snapPriority: 1 }));
  const measurements = getCatMeasurements(document).map((measurement) => ({
    type: CAT_MEASUREMENT_TYPE,
    id: measurement.id,
    snapSource: 'cat',
    snapPriority: 2,
    vertices: [
      { id: `${measurement.id}:start`, ...measurement.start },
      { id: `${measurement.id}:end`, ...measurement.end },
    ],
    edges: [],
  }));
  return [...lines, ...measurements];
}
import { circularArc } from '../../core/geometry/circular-arc.js';
