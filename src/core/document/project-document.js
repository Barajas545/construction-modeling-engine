export const PROJECT_SCHEMA = 'com.dcr.cme.project';

export function createProjectDocument(options = {}) {
  const now = options.now ?? new Date().toISOString();
  return {
    schema: PROJECT_SCHEMA,
    schemaVersion: 1,
    id: options.id ?? crypto.randomUUID(),
    name: options.name ?? 'Untitled deck',
    units: 'imperial',
    createdAt: now,
    updatedAt: now,
    objects: [],
  };
}

export function upsertObject(document, object, now = new Date().toISOString()) {
  const index = document.objects.findIndex((entry) => entry.id === object.id);
  const objects = [...document.objects];
  if (index >= 0) objects[index] = object;
  else objects.push(object);
  return { ...document, updatedAt: now, objects };
}

export function serializeProject(document) {
  return JSON.stringify(document, null, 2);
}

export function parseProject(serialized) {
  const document = JSON.parse(serialized);
  if (document.schema !== PROJECT_SCHEMA || document.schemaVersion !== 1 || !Array.isArray(document.objects)) {
    throw new Error('Unsupported CME project document.');
  }
  return document;
}
