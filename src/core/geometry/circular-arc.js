// Signed sagitta is measured along the left normal of the endpoint chord.
export function circularArc(start, end, sagitta, tolerance = 1 / 64) {
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  if (!Number.isFinite(chord) || chord < 1e-8 || !Number.isFinite(sagitta) || Math.abs(sagitta) < 1e-5) return null;
  const normal = { x: -(end.y - start.y) / chord, y: (end.x - start.x) / chord };
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const h = sagitta;
  const offset = (h * h - chord * chord / 4) / (2 * h);
  const center = { x: midpoint.x + normal.x * offset, y: midpoint.y + normal.y * offset };
  const apex = { x: midpoint.x + normal.x * h, y: midpoint.y + normal.y * h };
  const radius = Math.abs((h * h + chord * chord / 4) / (2 * h));
  const sweep = -4 * Math.atan(2 * h / chord);
  const angle = Math.atan2(start.y - center.y, start.x - center.x);
  const step = Math.min(Math.PI / 24, 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / radius))));
  const count = Math.max(2, Math.ceil(Math.abs(sweep) / Math.max(step, 1e-5)));
  if (count > 2048) throw new Error('Arc is too large to model at this precision.');
  const points = Array.from({ length: count + 1 }, (_, i) => i === 0 ? { ...start } : i === count ? { ...end } : {
    x: center.x + radius * Math.cos(angle + sweep * i / count),
    y: center.y + radius * Math.sin(angle + sweep * i / count),
  });
  return { chord, normal, midpoint, center, apex, radius, sagitta: h, centerOffset: Math.abs(offset), sweep, points, length: radius * Math.abs(sweep) };
}

export function getBoundaryArc(boundary, edgeId) {
  const root = boundary?.edges?.find((edge) => edge.id === edgeId)?.metadata?.archLineId ?? edgeId;
  const record = boundary?.metadata?.archLines?.[root];
  if (!record) return null;
  const start = boundary.vertices.find((p) => p.id === record.startVertexId);
  const end = boundary.vertices.find((p) => p.id === record.endVertexId);
  if (!start || !end) return null;
  const geometry = circularArc(start, end, record.sagitta);
  return geometry ? { ...geometry, id: root, record, start, end } : null;
}
