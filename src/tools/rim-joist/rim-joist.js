import { distance } from '../../core/geometry/vector.js';
import { getBoundaryArc } from '../../core/geometry/circular-arc.js';
import { planBeamStock } from '../beam/beam.js';
import { dominantBoundaryJoistSize } from '../ledger/ledger.js';

export const RIM_JOIST_SCHEMA_VERSION = 1;
export const RIM_JOIST_SIZE_PRESETS = Object.freeze([
  { id: '2x6', widthInches: 2, depthInches: 6, label: '2×6 PT' },
  { id: '2x8', widthInches: 2, depthInches: 8, label: '2×8 PT' },
  { id: '2x10', widthInches: 2, depthInches: 10, label: '2×10 PT' },
  { id: '2x12', widthInches: 2, depthInches: 12, label: '2×12 PT' },
]);

export function normalizeRimJoist(value = {}) {
  const inheritedFromJoistField = Boolean(value?.inheritedFromJoistField);
  if (!value || value.enabled === false) return { enabled: false, preset: '2x6', widthInches: 2, depthInches: 6, treatment: 'PT', customLabel: '', plyCount: 1, inheritedFromJoistField };
  const widthInches = Number(value.widthInches);
  const depthInches = Number(value.depthInches);
  const preset = RIM_JOIST_SIZE_PRESETS.find((entry) => entry.widthInches === widthInches && entry.depthInches === depthInches)
    ?? RIM_JOIST_SIZE_PRESETS.find((entry) => entry.id === value.preset);
  const customLabel = String(value.customLabel ?? '').trim();
  if (value.preset === 'custom' || (!preset && customLabel)) {
    return { enabled: true, preset: 'custom', widthInches: null, depthInches: null, treatment: String(value.treatment ?? 'PT').trim() || 'PT', customLabel, plyCount: Number(value.plyCount) === 2 ? 2 : 1, inheritedFromJoistField };
  }
  const selected = preset ?? RIM_JOIST_SIZE_PRESETS[0];
  return { enabled: true, preset: selected.id, widthInches: selected.widthInches, depthInches: selected.depthInches, treatment: String(value.treatment ?? 'PT').trim() || 'PT', customLabel: '', plyCount: Number(value.plyCount) === 2 ? 2 : 1, inheritedFromJoistField };
}

export function rimJoistLabel(value) {
  const normalized = normalizeRimJoist(value);
  if (normalized.preset === 'custom') return normalized.customLabel || `Custom rim joist · ${normalized.treatment}`;
  return `${normalized.widthInches}×${normalized.depthInches} ${normalized.treatment}`;
}

export function createRimJoistProperty(overrides = {}) {
  return normalizeRimJoist({ enabled: true, preset: '2x6', widthInches: 2, depthInches: 6, treatment: 'PT', plyCount: 1, ...overrides });
}

export function describeRimJoistTakeoff(document) {
  const groups = new Map();
  (document.objects ?? []).filter((object) => object.type === 'deck-boundary').forEach((boundary) => {
    const vertices = new Map(boundary.vertices.map((vertex) => [vertex.id, vertex]));
    const processedArcs = new Set();
    boundary.edges.forEach((edge) => {
      const arc = getBoundaryArc(boundary, edge.id);
      if (arc && (edge.id !== arc.id || processedArcs.has(arc.id))) return;
      if (arc) processedArcs.add(arc.id);
      const rim = normalizeRimJoist(edge.properties?.attachments?.rimJoist);
      if (!rim.enabled) return;
      const start = vertices.get(edge.startVertexId);
      const end = vertices.get(edge.endVertexId);
      if (!start || !end) return;
      const label = arc ? dominantBoundaryJoistSize(document, boundary.id) : rimJoistLabel(rim);
      const materialKey = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      planBeamStock(arc?.length ?? distance(start, end)).byLength.forEach(({ lengthFeet, quantity }) => {
        const key = `${materialKey}:${lengthFeet}:${rim.plyCount}`;
        const group = groups.get(key) ?? { label, lengthFeet, plyCount: rim.plyCount, quantity: 0, sourceObjectIds: [], curved: false };
        group.quantity += quantity * rim.plyCount;
        group.sourceObjectIds.push(arc?.id ?? edge.id);
        group.curved ||= Boolean(arc);
        groups.set(key, group);
      });
    });
  });
  return [...groups.entries()].map(([key, group]) => ({
    kind: 'count',
    id: `auto:framing:rim-joist:${key}`,
    category: 'framing',
    description: `${group.label}${group.curved ? ' curved' : ''} rim joist / flush beam`,
    specification: `${group.lengthFeet} ft stock · ${group.plyCount === 2 ? 'double joist' : 'single joist'}${group.curved ? ' · arc length; bending/lamination review' : ''}`,
    quantity: group.quantity,
    stockLengthFeet: group.lengthFeet,
    sourceObjectIds: [...new Set(group.sourceObjectIds)],
    confidence: 'preliminary',
  }));
}
