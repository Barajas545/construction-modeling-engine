const HIDDEN_KEY = 'boundaryVisibilityHidden';

export function isDeckBoundaryVisible(boundary) {
  return boundary?.metadata?.[HIDDEN_KEY] !== true;
}

export function isCatLineVisible(line) {
  return line?.metadata?.[HIDDEN_KEY] !== true;
}

export function isCatBoundaryVisible(document, region) {
  const ids = new Set(region?.lineIds ?? []);
  const lines = document.objects.filter((object) => ids.has(object.id));
  return !lines.length || lines.some(isCatLineVisible);
}

export function setDeckBoundaryVisibility(document, boundaryId, visible) {
  return {
    ...document,
    objects: document.objects.map((object) => object.type === 'deck-boundary' && object.id === boundaryId
      ? { ...object, metadata: { ...object.metadata, [HIDDEN_KEY]: !visible } }
      : object),
  };
}

export function setCatBoundaryVisibility(document, region, visible) {
  const ids = new Set(region?.lineIds ?? []);
  return {
    ...document,
    objects: document.objects.map((object) => ids.has(object.id)
      ? { ...object, metadata: { ...object.metadata, [HIDDEN_KEY]: !visible } }
      : object),
  };
}

export function showAllBoundaries(document) {
  return {
    ...document,
    objects: document.objects.map((object) => {
      if (object.type !== 'deck-boundary' && object.type !== 'cat-construction-line') return object;
      if (!object.metadata?.[HIDDEN_KEY]) return object;
      const metadata = { ...object.metadata };
      delete metadata[HIDDEN_KEY];
      return { ...object, metadata };
    }),
  };
}
