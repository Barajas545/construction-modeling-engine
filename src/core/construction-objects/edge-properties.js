export const EDGE_PROPERTY_SCHEMA_VERSION = 1;

export function createEdgeProperties(overrides = {}) {
  return {
    classification: {
      relationship: 'unassigned',
      exterior: true,
      ...overrides.classification,
    },
    finishes: {
      fascia: false,
      pictureFrame: false,
      ...overrides.finishes,
    },
    safety: {
      railing: 'unassigned',
      ...overrides.safety,
    },
    existingConditions: {
      demolition: false,
      ...overrides.existingConditions,
    },
    attachments: { ...overrides.attachments },
    custom: { ...overrides.custom },
  };
}

export function mergeEdgeProperties(current = {}, patch = {}) {
  const base = createEdgeProperties(current);
  return Object.fromEntries(Object.keys(base).map((group) => [group, { ...base[group], ...(patch[group] ?? {}) }]));
}

export function normalizeBoundaryEdge(edge) {
  return {
    type: 'boundary-edge',
    schemaVersion: EDGE_PROPERTY_SCHEMA_VERSION,
    ...edge,
    properties: createEdgeProperties(edge.properties),
    metadata: { ...edge.metadata },
  };
}
