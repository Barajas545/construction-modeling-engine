import { createDeckBoundary } from '../deck-boundary/deck-boundary.js';
import { setArchLineSagitta } from '../arch-line/arch-line.js';

export function convertCatBoundaryToDeckBoundary(catBoundary, options = {}) {
  if (!catBoundary?.corners || catBoundary.corners.length < 3) throw new Error('A closed CAT Boundary is required.');
  const edgeIds = catBoundary.segments.map((segment) => `edge-${crypto.randomUUID()}`);
  let boundary = createDeckBoundary(catBoundary.corners, {
    name: options.name ?? 'Deck boundary from CAT',
    edgeIds,
    metadata: { tags: ['converted-from-cat'], sourceCatLineIds: [...catBoundary.lineIds] },
  });
  catBoundary.segments.forEach((segment, index) => {
    if (Math.abs(segment.sagitta) < .01) return;
    boundary = setArchLineSagitta(boundary, edgeIds[index], segment.reverse ? -segment.sagitta : segment.sagitta);
  });
  return boundary;
}
