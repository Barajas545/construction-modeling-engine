import { circularArc, getBoundaryArc } from '../../core/geometry/circular-arc.js';
import { isEdgeLocked, validateDeckBoundary, withComputedProperties } from '../deck-boundary/deck-boundary.js';

export function archLineBlockReason(document, boundary, edgeId) {
  const arc = getBoundaryArc(boundary, edgeId);
  const edge = arc?.record.originalEdge ?? boundary?.edges.find((entry) => entry.id === edgeId);
  if (!edge) return 'Select a deck boundary edge.';
  if (isEdgeLocked(boundary, edgeId)) return 'Unlock the edge before using Arch line.';
  if (edge.role === 'house' || (!arc && edge.properties?.attachments?.rimJoist?.enabled) || edge.properties?.attachments?.stairId
    || !['unassigned', 'none'].includes(edge.properties?.safety?.railing ?? 'unassigned')) return 'Remove the straight ledger, rim, stair or railing relationship before curving this edge.';
  const ids = new Set(arc ? boundary.edges.filter((e) => e.metadata?.archLineId === arc.id).map((e) => e.id) : [edgeId]);
  for (const other of document?.objects ?? []) {
    if (other.id === boundary.id || /layer$/.test(other.type)) continue;
    const serialized = JSON.stringify(other);
    if ([...ids].some((id) => serialized.includes(JSON.stringify(id)))) return 'This edge anchors another object. Detach that object before changing the edge to an arc.';
  }
  return null;
}

export function straightenArchLine(boundary, edgeId) {
  const arc = getBoundaryArc(boundary, edgeId);
  if (!arc) return boundary;
  const vertices = boundary.vertices.filter((vertex) => vertex.archLineId !== arc.id).map((v, order) => ({ ...v, order }));
  const edges = boundary.edges.filter((edge) => !edge.metadata?.archLineId || edge.id === arc.id || edge.metadata.archLineId !== arc.id)
    .map((edge) => edge.id === arc.id ? structuredClone(arc.record.originalEdge) : edge);
  const archLines = { ...boundary.metadata.archLines };
  delete archLines[arc.id];
  return withComputedProperties({ ...boundary, vertices, edges, metadata: { ...boundary.metadata, archLines } });
}

export function setArchLineSagitta(boundary, edgeId, sagitta) {
  if (isEdgeLocked(boundary, edgeId)) throw new Error('Unlock this edge before curving it.');
  const old = getBoundaryArc(boundary, edgeId);
  const root = old?.id ?? edgeId;
  const base = straightenArchLine(boundary, root);
  const index = base.edges.findIndex((edge) => edge.id === root);
  if (index < 0) throw new Error('Boundary edge was not found.');
  const start = base.vertices[index];
  const end = base.vertices[(index + 1) % base.vertices.length];
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  if (!Number.isFinite(sagitta)) throw new Error('Arc offset must be a finite number.');
  if (Math.abs(sagitta) > chord / 2 + 1e-8) throw new Error('Arch line supports arcs up to a semicircle.');
  const arc = circularArc(start, end, sagitta);
  if (!arc) return base;
  const originalEdge = base.edges[index];
  const internal = arc.points.slice(1, -1).map((p, i) => ({ x: p.x, y: p.y, elevation: start.elevation, id: `${root}:arc-node:${i}`, archLineId: root }));
  const vertices = [...base.vertices.slice(0, index + 1), ...internal, ...base.vertices.slice(index + 1)].map((v, order) => ({ ...v, order }));
  const chain = [start, ...internal, end];
  const edges = chain.slice(0, -1).map((p, i) => ({ ...structuredClone(originalEdge), id: i === 0 ? root : `${root}:arc-segment:${i}`,
    startVertexId: p.id, endVertexId: chain[i + 1].id,
    metadata: { ...originalEdge.metadata, archLineId: root },
    properties: { ...originalEdge.properties, custom: { ...originalEdge.properties.custom, orientationConstraint: null, geometricConstraint: null } } }));
  const next = withComputedProperties({ ...base, vertices, edges: [...base.edges.slice(0, index), ...edges, ...base.edges.slice(index + 1)],
    metadata: { ...base.metadata, archLines: { ...base.metadata?.archLines, [root]: { schemaVersion: 1, startVertexId: start.id, endVertexId: end.id, sagitta, originalEdge } } } });
  const validation = validateDeckBoundary(next);
  if (!validation.valid) throw new Error(validation.issues.find((issue) => issue.severity === 'error').message);
  return next;
}

export function dragArchLine(boundary, edgeId, point) {
  const arc = getBoundaryArc(boundary, edgeId);
  const index = boundary.edges.findIndex((edge) => edge.id === edgeId);
  const start = arc?.start ?? boundary.vertices[index];
  const end = arc?.end ?? boundary.vertices[(index + 1) % boundary.vertices.length];
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  const h = ((point.x - (start.x + end.x) / 2) * -(end.y - start.y) + (point.y - (start.y + end.y) / 2) * (end.x - start.x)) / chord;
  return setArchLineSagitta(boundary, arc?.id ?? edgeId, Math.max(-chord / 2, Math.min(chord / 2, Math.round(h * 16) / 16)));
}
