export const CAT_LINE_TYPE = 'cat-construction-line';
export const CAT_MEASUREMENT_TYPE = 'cat-measurement';
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
    lifecycle: { phase: 'reference', revision: 1 },
  };
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

export function getCatLines(document) {
  return document.objects.filter((object) => object.type === CAT_LINE_TYPE);
}

export function getCatMeasurements(document) {
  return document.objects.filter((object) => object.type === CAT_MEASUREMENT_TYPE);
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
