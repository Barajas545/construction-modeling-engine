import { polygonArea } from '../../core/geometry/vector.js';
import { offsetSelectedEdges } from '../../core/geometry/polygon-offset.js';
import { MAX_RISER_HEIGHT, MIN_RISER_HEIGHT, PREFERRED_MIN_RISER_HEIGHT, solveStairLayout } from '../stairs/stair.js';

export const PYRAMID_STAIR_TYPE = 'pyramid-stair';
export const PYRAMID_STAIR_SCHEMA_VERSION = 1;
// Two, three and four decking boards laid across the tread with their gaps. These sit
// outside the 10–11″ stair clamp on purpose: a pyramid step is a walking platform you
// stand on, not a stair tread you pass over, so the stair recipe does not govern it.
export const TREAD_DEPTH_PRESETS = Object.freeze([11, 16.8, 22.5]);
// A tread narrower than one 5.5″ decking board cannot be built or stood on, so the floor
// sits just above a single board — below this the ring is a reveal, not a step.
export const MIN_PYRAMID_TREAD_DEPTH = 6;
// A ceiling rather than a code limit: box steps are routinely built far deeper than a
// walking tread, so this only catches a mistyped dimension. Raise it if a real step needs it.
export const MAX_PYRAMID_TREAD_DEPTH = 48;

const defaultId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const failure = (reason) => ({ ok: false, reason });
const copyRing = (vertices) => vertices.map(({ x, y }) => ({ x: Number(x), y: Number(y) }));

// Stepping edges arrive as ids because the UI selects edges, but the offset primitive
// works in indices. Boundary edges are index-parallel with vertices, so the lookup is
// positional and the result is re-sorted into boundary order for stable output.
function resolveSteppingEdges(boundary, steppingEdgeIds) {
  const edges = boundary.edges;
  const unique = [...new Set(Array.isArray(steppingEdgeIds) ? steppingEdgeIds : [])];
  const resolved = unique.map((edgeId) => ({ edgeId, index: edges.findIndex((edge) => edge.id === edgeId) }));
  const missing = resolved.find((entry) => entry.index < 0);
  if (missing) return failure(`Stepping edge "${missing.edgeId}" is not an edge of this deck boundary.`);
  const ordered = resolved.sort((a, b) => a.index - b.index);
  return { ok: true, indices: ordered.map((entry) => entry.index), edgeIds: ordered.map((entry) => entry.edgeId) };
}

function measureFootprint(vertices) {
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  return {
    widthInches: Math.max(...xs) - Math.min(...xs),
    depthInches: Math.max(...ys) - Math.min(...ys),
    areaSquareInches: polygonArea(vertices),
  };
}

export function solvePyramidStair({ boundary, steppingEdgeIds, totalRise, treadDepth, previousRiserCount } = {}) {
  const vertices = boundary?.vertices ?? [];
  if (vertices.length < 3) return failure('A pyramid stair needs a closed deck boundary with at least three corners.');
  if ((boundary.edges?.length ?? 0) !== vertices.length) return failure('Deck boundary edges are out of step with its corners.');

  const stepping = resolveSteppingEdges(boundary, steppingEdgeIds);
  if (!stepping.ok) return failure(stepping.reason);
  if (!stepping.indices.length) return failure('Select at least one boundary edge for the pyramid to step down from.');

  const depth = Number(treadDepth);
  if (!Number.isFinite(depth)) return failure('Tread depth must be a number.');
  if (depth < MIN_PYRAMID_TREAD_DEPTH) return failure(`Each pyramid tread must be at least ${MIN_PYRAMID_TREAD_DEPTH} inches deep.`);
  if (depth > MAX_PYRAMID_TREAD_DEPTH) return failure(`A tread deeper than ${MAX_PYRAMID_TREAD_DEPTH} inches is past what this tool models — check the dimension.`);

  const rise = Number(totalRise);
  if (!Number.isFinite(rise) || rise <= 0) return failure('Enter a positive total rise.');
  // Riser only. solveStairLayout clamps tread depth to 10–11″ and derives its run from that
  // clamp, which every pyramid preset deliberately breaks, so its treadDepth and totalRun
  // are discarded here and the run comes from the ring offsets instead.
  const layout = solveStairLayout(rise, { previousRiserCount });
  if (!layout) return failure(`No equal riser layout fits a ${rise} inch rise within ${MIN_RISER_HEIGHT}″–${MAX_RISER_HEIGHT}″ risers.`);

  const { riserCount, riserHeight } = layout;
  // The bottom riser steps onto grade, and grade is not a box, so the rings stop one
  // short of the riser count.
  const ringCount = riserCount - 1;
  const base = copyRing(vertices);
  const rings = [];
  for (let index = 0; index < ringCount; index += 1) {
    // Every ring is a full closed polygon rather than an annulus: the boxes stack
    // smaller-on-top, so each one is the drawn boundary pushed out on the stepping
    // edges alone. Ring 0 is that boundary untouched.
    let ringVertices = base;
    if (index > 0) {
      const offset = offsetSelectedEdges(base, stepping.indices, index * depth);
      if (!offset?.ok) return failure(`Step ${index + 1} cannot step out ${index * depth} inches: ${offset?.reason ?? 'the boundary shape refused the offset'}.`);
      if (!Array.isArray(offset.vertices) || offset.vertices.length < 3) return failure(`Step ${index + 1} stepped out to an open shape.`);
      ringVertices = offset.vertices;
    }
    rings.push({
      index,
      elevation: -(index + 1) * riserHeight,
      treadDepth: depth,
      vertices: copyRing(ringVertices),
      areaSquareInches: polygonArea(ringVertices),
    });
  }

  const warnings = [];
  if (layout.usesExtendedRiserRange) warnings.push(`Risers are under ${PREFERRED_MIN_RISER_HEIGHT} inches; confirm the shallow rise is intended.`);
  if (depth < TREAD_DEPTH_PRESETS[0]) warnings.push(`Treads are shallower than the ${TREAD_DEPTH_PRESETS[0]} inch preset, so a step holds less than two deck boards.`);
  if (stepping.indices.length === 1) warnings.push('One stepping edge produces a straight run rather than a wrapping pyramid.');

  return {
    ok: true,
    riserCount,
    riserHeight,
    ringCount,
    totalRise: rise,
    treadDepth: depth,
    steppingEdgeIds: stepping.edgeIds,
    rings,
    // The widest ring is the last one, so the footprint is read off the bottom box.
    footprint: measureFootprint(rings[rings.length - 1].vertices),
    warnings,
  };
}

export function createPyramidStair(boundary, solution, options = {}, idFactory = defaultId) {
  if (!solution?.ok) throw new Error(solution?.reason ?? 'Solve a valid pyramid stair before creating one.');
  const reviewReason = solution.warnings.length ? solution.warnings.join(' ') : null;
  return {
    type: PYRAMID_STAIR_TYPE,
    schemaVersion: PYRAMID_STAIR_SCHEMA_VERSION,
    id: idFactory('pyramid-stair'),
    name: options.name ?? 'Pyramid stairs',
    host: { boundaryId: boundary.id },
    dimensions: {
      totalRise: solution.totalRise,
      riserCount: solution.riserCount,
      riserHeight: solution.riserHeight,
      ringCount: solution.ringCount,
      treadDepth: solution.treadDepth,
      footprint: { ...solution.footprint },
    },
    steppingEdgeIds: [...solution.steppingEdgeIds],
    // Rings are copied out of the solution so the pyramid owns its geometry outright and
    // never shares vertex objects with the boundary it was solved against.
    geometry: {
      schemaVersion: 1,
      ownership: 'pyramid-stair',
      rings: solution.rings.map((ring) => ({ ...ring, vertices: copyRing(ring.vertices) })),
    },
    lifecycle: { phase: 'established', revision: 1, needsReview: Boolean(reviewReason), reviewReason },
  };
}
