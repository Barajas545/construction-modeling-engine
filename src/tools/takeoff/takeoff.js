import { distance } from '../../core/geometry/vector.js';
import { getBoundaryArc } from '../../core/geometry/circular-arc.js';
import { DCR_DEFAULT_POST_BASE } from '../../core/standards/dcr-construction-standard.js';
import { deriveDeckBoardingSegments, getDeckBoarding } from '../deck-boarding/deck-boarding.js';
import { getFramingLayer } from '../../core/annotations/framing-layer.js';
import { describeTakeoff as describeBeams } from '../beam/beam.js';
import { deriveAllBeamGeometries } from '../beam/beam-geometry.js';
import { describeTakeoff as describeJoists } from '../joist-group/joist-group.js';
import { describeJoistBlockingTakeoff } from '../joist-blocking/joist-blocking.js';
import { describeTakeoff as describePosts, getPosts } from '../post-footing/post-footing.js';
import { describeRimJoistTakeoff } from '../rim-joist/rim-joist.js';
import { describeLedgerTakeoff } from '../ledger/ledger.js';
import { describeStairFramingTakeoff } from '../stair-framing/stair-framing.js';
import { getStairVertices } from '../stairs/stair.js';
import { deriveStairCovering, planStairRiserFasciaStock } from '../stairs/stair-covering.js';
import { analyzeRailingGeometries } from '../railing/railing.js';

export const TAKEOFF_SCHEMA_VERSION = 1;

export const TAKEOFF_CATEGORIES = [
  { id: 'decking', label: 'Decking & trim' },
  { id: 'stairs', label: 'Stairs' },
  { id: 'railing', label: 'Railing' },
  { id: 'framing', label: 'Framing' },
  { id: 'hardware', label: 'Fasteners & hardware' },
  { id: 'protection', label: 'Protection & finishes' },
  { id: 'custom', label: 'Custom materials' },
];

const defaultId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const round = (value, precision = 2) => Number(Number(value ?? 0).toFixed(precision));
export const WILD_HOG_HANDRAIL_STOCK_FEET = Object.freeze([8, 10, 12, 16, 20]);

export function planWildHogHandrailStock(geometry, stockLengths = WILD_HOG_HANDRAIL_STOCK_FEET) {
  const panelCount = Math.max(0, Math.floor(Number(geometry?.sectionCount ?? 0)));
  const runFeet = Math.max(0, Number(geometry?.length ?? 0)) / 12;
  if (!panelCount || !runFeet) return [];
  const panelSpanFeet = runFeet / panelCount;
  const lengths = [...new Set(stockLengths.map(Number).filter((length) => Number.isFinite(length) && length > 0))].sort((a, b) => a - b);
  const plans = Array(panelCount + 1).fill(null);
  plans[0] = { pieces: [], purchasedFeet: 0 };
  for (let covered = 1; covered <= panelCount; covered += 1) {
    for (let previous = 0; previous < covered; previous += 1) {
      const requiredFeet = panelSpanFeet * (covered - previous);
      const stockLength = lengths.find((length) => length + 1e-8 >= requiredFeet);
      if (!stockLength || !plans[previous]) continue;
      const candidate = { pieces: [...plans[previous].pieces, stockLength], purchasedFeet: plans[previous].purchasedFeet + stockLength };
      const current = plans[covered];
      if (!current || candidate.purchasedFeet < current.purchasedFeet - 1e-8 || (Math.abs(candidate.purchasedFeet - current.purchasedFeet) < 1e-8 && candidate.pieces.length < current.pieces.length)) plans[covered] = candidate;
    }
  }
  return plans[panelCount]?.pieces ?? [];
}

export function createTakeoffState(overrides = {}) {
  return {
    schemaVersion: TAKEOFF_SCHEMA_VERSION,
    settings: {
      wastePercent: 10,
      fieldBoardWidthInches: 5.5,
      fieldBoardGapInches: 0.1875,
      fieldBoardStockFeet: 16,
      squareEdgeStockFeet: 16,
      fasciaStockFeet: 12,
      ledgerScrewsPerFoot: 5,
      ledgerScrewBoxQuantity: 50,
      ...overrides.settings,
    },
    overrides: { ...overrides.overrides },
    manualLines: [...(overrides.manualLines ?? [])],
  };
}

export function getTakeoffState(document) {
  return createTakeoffState(document.takeoff ?? {});
}

export function setTakeoffState(document, takeoff) {
  return { ...document, takeoff: createTakeoffState(takeoff), updatedAt: new Date().toISOString() };
}

function boundaryEdgeLength(boundary, edge) {
  const byId = new Map(boundary.vertices.map((vertex) => [vertex.id, vertex]));
  const start = byId.get(edge.startVertexId);
  const end = byId.get(edge.endVertexId);
  return start && end ? distance(start, end) : 0;
}

function finishLengths(boundary, finish) {
  const processedArcs = new Set();
  return boundary.edges.reduce((lengths, edge) => {
    if (!edge.properties?.finishes?.[finish]) return lengths;
    const arc = getBoundaryArc(boundary, edge.id);
    if (arc) {
      if (processedArcs.has(arc.id)) return lengths;
      processedArcs.add(arc.id);
      lengths.curved += arc.length;
    } else lengths.straight += boundaryEdgeLength(boundary, edge);
    return lengths;
  }, { straight: 0, curved: 0 });
}

function purchaseLine({ id, category, description, specification, requiredLinearFeet = 0, stockLengthFeet, sourceObjectIds = [], confidence = 'calculated' }, settings) {
  const wasteMultiplier = 1 + settings.wastePercent / 100;
  return {
    id,
    category,
    description,
    specification,
    stockLengthFeet,
    calculatedQuantity: Math.ceil(requiredLinearFeet * wasteMultiplier / stockLengthFeet),
    quantity: Math.ceil(requiredLinearFeet * wasteMultiplier / stockLengthFeet),
    unit: 'ea',
    unitPrice: null,
    requiredLinearFeet: round(requiredLinearFeet),
    wastePercent: settings.wastePercent,
    origin: 'auto',
    confidence,
    sourceObjectIds,
  };
}

function countLine({ id, category, description, specification, quantity, unit = 'ea', stockLengthFeet = null, sourceObjectIds = [], confidence = 'calculated' }) {
  return { id, category, description, specification, stockLengthFeet, calculatedQuantity: Math.ceil(quantity), quantity: Math.ceil(quantity), unit, unitPrice: null, requiredLinearFeet: null, wastePercent: 0, origin: 'auto', confidence, sourceObjectIds };
}

function descriptorLines(descriptors) {
  return descriptors.map((descriptor) => countLine(descriptor));
}

function pointKey(point, tolerance = 1) {
  return `${Math.round(point.x / tolerance)}:${Math.round(point.y / tolerance)}`;
}

function deriveFramingTakeoff(document) {
  const layer = getFramingLayer(document);
  const beams = descriptorLines(describeBeams(document));
  const joists = descriptorLines(describeJoists(document));
  const explicitDescriptors = describePosts(document).filter((line) => !['auto:framing:post', 'auto:hardware:post-base', 'auto:framing:concrete-bag'].includes(line.id));
  const explicitPosts = getPosts(document);
  const uniquePostLocations = new Map(explicitPosts.map((post) => [pointKey(post.at), { point: post.at, sourceId: post.id }]));
  deriveAllBeamGeometries(document, layer.settings).forEach((geometry) => {
    geometry.posts.forEach((post) => uniquePostLocations.set(pointKey(post), { point: post, sourceId: geometry.beam.id }));
  });
  const postLocations = [...uniquePostLocations.values()];
  const sourceObjectIds = [...new Set(postLocations.map((entry) => entry.sourceId))];
  const postCount = postLocations.length;
  const cutsPerStock = Math.max(1, Math.floor(layer.settings.postStockFeet / layer.settings.postCutFeet));
  const posts = postCount ? [
    countLine({ id: 'auto:framing:post-stock', category: 'framing', description: `4×4×${layer.settings.postStockFeet} post stock`, specification: `${postCount} posts · ${cutsPerStock} cuts per stock`, quantity: Math.ceil(postCount / cutsPerStock), sourceObjectIds, confidence: 'preliminary' }),
    countLine({ id: 'auto:hardware:post-base', category: 'hardware', description: DCR_DEFAULT_POST_BASE.description, specification: 'One per post · model/size to match post', quantity: postCount, sourceObjectIds, confidence: 'preliminary' }),
    countLine({ id: 'auto:framing:concrete-bag', category: 'framing', description: 'Concrete 60lb bag', specification: `${layer.settings.concreteBagsPerFooting} bags per footing`, quantity: postCount * layer.settings.concreteBagsPerFooting, sourceObjectIds, confidence: 'preliminary' }),
  ] : [];
  const blocking = descriptorLines(describeJoistBlockingTakeoff(document));
  const ledgers = descriptorLines(describeLedgerTakeoff(document));
  return [...ledgers, ...beams, ...joists, ...blocking, ...descriptorLines(explicitDescriptors), ...posts];
}

export function deriveAutomaticTakeoff(document, options = {}) {
  const state = getTakeoffState(document);
  const settings = state.settings;
  const boundaries = document.objects.filter((object) => object.type === 'deck-boundary');
  const stairs = document.objects.filter((object) => object.type === 'stair');
  const pitch = settings.fieldBoardWidthInches + settings.fieldBoardGapInches;
  const fieldLinearFeet = boundaries.reduce((sum, boundary) => {
    const localStairs = stairs.filter((stair) => stair.host?.boundaryId === boundary.id);
    if (getDeckBoarding(boundary)) {
      const exclusions = localStairs.map((stair) => getStairVertices(boundary, stair)).filter((polygon) => polygon.length === 4);
      return sum + deriveDeckBoardingSegments(boundary, exclusions, { pitch }).reduce((total, segment) => total + distance(segment.start, segment.end), 0) / 12;
    }
    const stairArea = localStairs.reduce((total, stair) => total + Number(stair.dimensions?.width ?? 0) * Number(stair.dimensions?.totalRun ?? 0), 0);
    const fieldArea = Math.max(0, Number(boundary.computed?.areaSquareInches ?? 0) - stairArea);
    return sum + (pitch > 0 ? fieldArea / pitch / 12 : 0);
  }, 0);
  const lines = [];
  if (fieldLinearFeet > 0) lines.push(purchaseLine({ id: 'auto:decking:grooved-field', category: 'decking', description: 'Grooved field decking', specification: `${settings.fieldBoardStockFeet} ft board`, requiredLinearFeet: fieldLinearFeet, stockLengthFeet: settings.fieldBoardStockFeet, sourceObjectIds: boundaries.map((boundary) => boundary.id), confidence: 'preliminary' }, settings));

  const pictureFrameLengths = boundaries.reduce((total, boundary) => {
    const lengths = finishLengths(boundary, 'pictureFrame');
    return { straight: total.straight + lengths.straight, curved: total.curved + lengths.curved };
  }, { straight: 0, curved: 0 });
  const pictureFrameLF = pictureFrameLengths.straight / 12;
  if (pictureFrameLF > 0) lines.push(purchaseLine({ id: 'auto:decking:square-picture-frame', category: 'decking', description: 'Square-edge picture frame', specification: `${settings.squareEdgeStockFeet} ft board`, requiredLinearFeet: pictureFrameLF, stockLengthFeet: settings.squareEdgeStockFeet, sourceObjectIds: boundaries.map((boundary) => boundary.id) }, settings));
  const curvedPictureFrameLF = pictureFrameLengths.curved / 12;
  if (curvedPictureFrameLF > 0) lines.push(purchaseLine({ id: 'auto:decking:square-picture-frame-curved', category: 'decking', description: 'Heat-bent square-edge picture frame decking', specification: `${settings.squareEdgeStockFeet} ft composite board · curved layout; heat-bending fabrication review`, requiredLinearFeet: curvedPictureFrameLF, stockLengthFeet: settings.squareEdgeStockFeet, sourceObjectIds: boundaries.map((boundary) => boundary.id), confidence: 'review' }, settings));

  const fasciaLF = boundaries.reduce((sum, boundary) => {
    const lengths = finishLengths(boundary, 'fascia');
    return sum + lengths.straight + lengths.curved;
  }, 0) / 12;
  if (fasciaLF > 0) lines.push(purchaseLine({ id: 'auto:decking:fascia', category: 'decking', description: 'Fascia board', specification: `${settings.fasciaStockFeet} ft fascia`, requiredLinearFeet: fasciaLF, stockLengthFeet: settings.fasciaStockFeet, sourceObjectIds: boundaries.map((boundary) => boundary.id) }, settings));

  const ledgerEdges = boundaries.flatMap((boundary) => boundary.edges
    .filter((edge) => (edge.role === 'house' || edge.properties?.classification?.relationship === 'house-attachment') && edge.properties?.attachments?.ledger !== false)
    .map((edge) => ({ boundary, edge })));
  const ledgerLinearFeet = ledgerEdges.reduce((sum, entry) => sum + boundaryEdgeLength(entry.boundary, entry.edge), 0) / 12;
  if (ledgerLinearFeet > 0) {
    const screwsPerFoot = Math.max(0, Number(settings.ledgerScrewsPerFoot) || 0);
    const boxQuantity = Math.max(1, Math.floor(Number(settings.ledgerScrewBoxQuantity) || 50));
    const requiredScrews = Math.ceil(ledgerLinearFeet * screwsPerFoot);
    const boxes = Math.ceil(requiredScrews / boxQuantity);
    lines.push(countLine({
      id: 'auto:hardware:ledger-sdws-5-box',
      category: 'hardware',
      description: 'Simpson Strong-Tie SDWS Timber Screw 5″',
      specification: `${boxQuantity} pcs/box · ${requiredScrews} required at ${screwsPerFoot}/LF · ${boxes * boxQuantity - requiredScrews} spare`,
      quantity: boxes,
      unit: 'box',
      sourceObjectIds: ledgerEdges.map((entry) => entry.edge.id),
      confidence: 'preliminary',
    }));
  }

  const coverings = stairs.map(deriveStairCovering);
  const riserPlan = planStairRiserFasciaStock(coverings, { wastePercent: settings.wastePercent, stockLengthsFeet: settings.stairRiserFasciaStockFeet });
  const riserGroups = new Map();
  riserPlan.pieces.forEach((piece) => {
    const group = riserGroups.get(piece.stockLengthFeet) ?? { quantity: 0, netFeet: 0, cuts: [], sourceObjectIds: new Set() };
    group.quantity += 1;
    group.netFeet += piece.usedFeet;
    group.cuts.push(...piece.cuts);
    piece.cuts.forEach((cut) => group.sourceObjectIds.add(cut.stairId));
    if (!piece.cuts.length) coverings.filter((entry) => entry.riserFasciaLinearFeet > 0).forEach((entry) => group.sourceObjectIds.add(entry.stairId));
    riserGroups.set(piece.stockLengthFeet, group);
  });
  for (const [stockLengthFeet, group] of [...riserGroups].sort(([a], [b]) => a - b)) {
    const lengths = [...new Set(group.cuts.map((cut) => cut.lengthFeet))];
    const cutSummary = lengths.length === 1 ? `${group.cuts.length} risers × ${round(lengths[0])} ft` : `${group.cuts.length} riser cuts`;
    lines.push({
      ...countLine({ id: `auto:stairs:fascia-risers:${stockLengthFeet}`, category: 'stairs', description: 'Stair riser fascia',
        specification: `${stockLengthFeet} ft board · ${cutSummary} · ${round(group.netFeet)} LF net · risers only; cutting reserve included`,
        quantity: group.quantity, stockLengthFeet, sourceObjectIds: [...group.sourceObjectIds], confidence: 'review' }),
      requiredLinearFeet: round(group.netFeet), wastePercent: settings.wastePercent,
    });
  }
  if (riserPlan.oversized.length) lines.push({
    ...countLine({ id: 'auto:stairs:fascia-risers:review', category: 'stairs', description: 'Stair riser fascia · REVIEW',
      specification: 'Riser width exceeds available fascia stock; choose special stock or review joints',
      quantity: riserPlan.oversized.length, sourceObjectIds: [...new Set(riserPlan.oversized.map((cut) => cut.stairId))], confidence: 'review' }),
    requiredLinearFeet: round(riserPlan.oversized.reduce((sum, cut) => sum + cut.lengthFeet, 0)),
  });
  for (const recipe of [
    { key: 'squareShoulderLinearFeet', id: 'square-shoulder-treads', description: 'Square-shoulder stair tread decking', stock: settings.squareEdgeStockFeet, note: 'Pictureframe inner + front + returns / square cut 2 strips per tread' },
    { key: 'sideFasciaLinearFeet', id: 'fascia-sides', description: 'Stair side fascia', stock: settings.fasciaStockFeet, note: 'Two sides; pictureframe slope / square cut run; +16 in per side included' },
  ]) {
    const sources = coverings.filter((entry) => entry[recipe.key] > 0);
    if (!sources.length) continue;
    lines.push(purchaseLine({
      id: `auto:stairs:${recipe.id}`, category: 'stairs', description: recipe.description,
      specification: `${recipe.stock} ft board · ${recipe.note} · LF allowance; verify cutting plan`,
      requiredLinearFeet: sources.reduce((sum, entry) => sum + entry[recipe.key], 0),
      stockLengthFeet: recipe.stock, sourceObjectIds: sources.map((entry) => entry.stairId), confidence: 'review',
    }, settings));
  }
  lines.push(...descriptorLines(describeStairFramingTakeoff(document)));

  const rawRailingGeometries = options.railingGeometries ?? [];
  const railingAnalysis = rawRailingGeometries.every((geometry) => geometry?.start && geometry?.end && Array.isArray(geometry.posts))
    ? analyzeRailingGeometries(rawRailingGeometries, options.railingCornerSettings)
    : { geometries: rawRailingGeometries, estimatedPostCount: rawRailingGeometries.reduce((sum, geometry) => sum + Number(geometry.postCount ?? 0), 0) };
  const wildHog = railingAnalysis.geometries.filter((geometry) => (geometry.railing?.settings?.system ?? 'wild-hog') === 'wild-hog');
  const panelCount = wildHog.reduce((sum, geometry) => sum + Number(geometry.sectionCount ?? 0), 0);
  const railingIds = wildHog.map((geometry) => geometry.railing.id);
  if (panelCount > 0) {
    lines.push(countLine({ id: 'auto:railing:wild-hog-panel', category: 'railing', description: 'Wild Hog panel', specification: 'Panel', quantity: panelCount, sourceObjectIds: railingIds }));
    lines.push(countLine({ id: 'auto:railing:wild-hog-track', category: 'railing', description: '6 ft. Wild Hog Black Aluminum Hog Track Kit', specification: 'Complete 6 ft kit · 1 kit per railing panel', quantity: panelCount, sourceObjectIds: railingIds }));
    const handrailStock = new Map();
    wildHog.forEach((geometry) => {
      planWildHogHandrailStock(geometry).forEach((lengthFeet) => {
        const group = handrailStock.get(lengthFeet) ?? { quantity: 0, sourceObjectIds: [] };
        group.quantity += 1;
        group.sourceObjectIds.push(geometry.railing.id);
        handrailStock.set(lengthFeet, group);
      });
    });
    lines.push(...[...handrailStock.entries()].sort(([a], [b]) => a - b).map(([lengthFeet, group]) => countLine({
      id: `auto:railing:wild-hog-handrail:${lengthFeet}`,
      category: 'railing',
      description: '2×6 DW handrail',
      specification: `2×6×${lengthFeet} · continuous across panels; joints land at posts`,
      quantity: group.quantity,
      stockLengthFeet: lengthFeet,
      sourceObjectIds: [...new Set(group.sourceObjectIds)],
    })));
    lines.push(countLine({ id: 'auto:railing:wild-hog-support', category: 'railing', description: 'Panel support', specification: '2×4×8 · top and bottom', quantity: panelCount * 2, sourceObjectIds: railingIds }));
    const requiredPostCount = options.railingPostCount ?? railingAnalysis.estimatedPostCount;
    lines.push(countLine({
      id: 'auto:railing:wild-hog-post',
      category: 'railing',
      description: 'Railing post stock',
      specification: `4×4×10 · 2 cuts at 5 ft · ${requiredPostCount} posts required`,
      quantity: Math.ceil(requiredPostCount / 2),
      stockLengthFeet: 10,
      sourceObjectIds: railingIds,
    }));
  }
  lines.push(...deriveFramingTakeoff(document));
  lines.push(...descriptorLines(describeRimJoistTakeoff(document)));
  return lines;
}

export function getEffectiveTakeoffLines(document, options = {}) {
  const state = getTakeoffState(document);
  const automatic = deriveAutomaticTakeoff(document, options).map((line) => {
    const override = state.overrides[line.id] ?? {};
    return { ...line, ...override, calculatedQuantity: line.calculatedQuantity, origin: override.quantity !== undefined ? 'adjusted' : 'auto' };
  });
  return [...automatic, ...state.manualLines.map((line) => ({ ...line, origin: 'manual', calculatedQuantity: null }))];
}

export function updateTakeoffLine(document, lineId, patch) {
  const state = getTakeoffState(document);
  const manualIndex = state.manualLines.findIndex((line) => line.id === lineId);
  if (manualIndex >= 0) {
    const manualLines = [...state.manualLines];
    manualLines[manualIndex] = { ...manualLines[manualIndex], ...patch };
    return setTakeoffState(document, { ...state, manualLines });
  }
  return setTakeoffState(document, { ...state, overrides: { ...state.overrides, [lineId]: { ...(state.overrides[lineId] ?? {}), ...patch } } });
}

export function resetTakeoffLine(document, lineId) {
  const state = getTakeoffState(document);
  const { [lineId]: removed, ...overrides } = state.overrides;
  return setTakeoffState(document, { ...state, overrides });
}

export function addManualTakeoffLine(document, input, idFactory = defaultId) {
  const state = getTakeoffState(document);
  const quantity = Number(input.quantity);
  if (!input.description?.trim() || !Number.isFinite(quantity) || quantity <= 0) throw new Error('Enter a material description and quantity greater than zero.');
  const line = {
    id: idFactory('takeoff-line'),
    category: TAKEOFF_CATEGORIES.some((category) => category.id === input.category) ? input.category : 'custom',
    description: input.description.trim(),
    specification: input.specification?.trim() ?? '',
    stockLengthFeet: Number(input.stockLengthFeet) || null,
    quantity,
    unit: input.unit ?? 'ea',
    unitPrice: Number.isFinite(Number(input.unitPrice)) && input.unitPrice !== '' ? Number(input.unitPrice) : null,
    requiredLinearFeet: null,
    wastePercent: 0,
    origin: 'manual',
    confidence: 'user',
    sourceObjectIds: [],
  };
  return setTakeoffState(document, { ...state, manualLines: [...state.manualLines, line] });
}

export function removeManualTakeoffLine(document, lineId) {
  const state = getTakeoffState(document);
  return setTakeoffState(document, { ...state, manualLines: state.manualLines.filter((line) => line.id !== lineId) });
}

export function createTakeoffExport(document, options = {}) {
  const includePrices = options.includePrices === true;
  const detailedLines = getEffectiveTakeoffLines(document, options);
  const exportMode = options.mode === 'consolidated' ? 'consolidated' : 'detailed';
  const sourceLines = exportMode === 'consolidated' ? consolidateTakeoffLines(detailedLines) : detailedLines;
  const lines = sourceLines.map((line) => {
    const exported = { id: line.id, category: line.category, description: line.description, specification: line.specification, calculatedQuantity: line.calculatedQuantity, quantity: line.quantity, unit: line.unit, requiredLinearFeet: line.requiredLinearFeet, origin: line.origin, confidence: line.confidence, sourceObjectIds: line.sourceObjectIds };
    if (includePrices) { exported.unitPrice = line.unitPrice; exported.subtotal = line.unitPrice == null ? null : round(line.quantity * line.unitPrice); }
    return exported;
  });
  return { schema: 'com.dcr.cme.takeoff', schemaVersion: 1, project: { id: document.id, name: document.name }, generatedAt: options.now ?? new Date().toISOString(), pricingIncluded: includePrices, mode: exportMode, summary: { materialLineCount: lines.length, adjustedLineCount: lines.filter((line) => line.origin === 'adjusted').length, manualLineCount: lines.filter((line) => line.origin === 'manual').length }, lines };
}

function constructionRole(description = '') {
  const text = String(description).toLowerCase();
  if (text.includes('stair stringer')) return 'Stair stringer';
  if (text.includes('stair lower riser closure')) return 'Stair lower riser closure';
  if (text.includes('stair bottom tie')) return 'Stair bottom tie / sole plate';
  if (text.includes('stair ledger') || text.includes('stair header')) return 'Stair ledger / header';
  if (text.includes('joist blocking')) return 'Joist blocking';
  if (text.includes('rim joist') || text.includes('flush beam')) return 'Rim / flush';
  if (text.includes('ledger')) return 'Ledger';
  if (text.includes('joist')) return 'Joist';
  if (text.includes('beam')) return 'Beam';
  return null;
}

function lumberBase(description = '') {
  return String(description)
    .replace(/\bstair lower riser closure\b|\bstair bottom tie\s*\/\s*sole plate\b/gi, '')
    .replace(/\bstair ledger\s*\/\s*header\b|\bstair stringer\b|\bjoist blocking\b|\bcurved\b|\brim joist\s*\/\s*flush beam\b|\brim joist\b|\bflush beam\b|\bledger\b|\bjoist\b|\bbeam\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Produces a purchasing view: identical stock is grouped regardless of the
 * construction role that generated it. The detailed Takeoff remains unchanged.
 */
export function consolidateTakeoffLines(lines = []) {
  const groups = new Map();
  lines.forEach((line) => {
    const role = constructionRole(line.description);
    const base = role && line.stockLengthFeet ? lumberBase(line.description) : String(line.description ?? '').trim();
    const stock = Number(line.stockLengthFeet) || null;
    const key = [base.toLowerCase(), stock ?? '', String(line.unit ?? 'ea').toLowerCase(), stock ? '' : String(line.specification ?? '').trim().toLowerCase()].join('|');
    const group = groups.get(key) ?? {
      ...line,
      id: `consolidated:${groups.size + 1}`,
      category: role && stock ? 'framing' : line.category,
      description: role && stock ? `${base} lumber` : line.description,
      specification: stock ? `${stock} ft stock` : line.specification,
      calculatedQuantity: 0,
      quantity: 0,
      requiredLinearFeet: 0,
      origin: 'consolidated',
      sourceObjectIds: [],
      sourceRoles: [],
      allCalculated: true,
      allRequiredLinearFeet: true,
      allPriced: true,
      pricedSubtotal: 0,
    };
    const quantity = Number(line.quantity) || 0;
    group.quantity += quantity;
    if (line.calculatedQuantity != null && Number.isFinite(Number(line.calculatedQuantity))) group.calculatedQuantity += Number(line.calculatedQuantity);
    else group.allCalculated = false;
    if (line.requiredLinearFeet != null && Number.isFinite(Number(line.requiredLinearFeet))) group.requiredLinearFeet += Number(line.requiredLinearFeet);
    else group.allRequiredLinearFeet = false;
    if (line.unitPrice == null) group.allPriced = false;
    else group.pricedSubtotal += quantity * Number(line.unitPrice);
    group.sourceObjectIds.push(...(line.sourceObjectIds ?? []));
    if (role) group.sourceRoles.push(role);
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => {
    const sourceRoles = [...new Set(group.sourceRoles)];
    const specification = sourceRoles.length
      ? `${group.specification} · combined: ${sourceRoles.join(', ')}`
      : group.specification;
    const result = {
      ...group,
      specification,
      quantity: round(group.quantity),
      calculatedQuantity: group.allCalculated ? round(group.calculatedQuantity) : null,
      requiredLinearFeet: group.allRequiredLinearFeet ? round(group.requiredLinearFeet) : null,
      unitPrice: group.allPriced && group.quantity ? round(group.pricedSubtotal / group.quantity) : null,
      sourceObjectIds: [...new Set(group.sourceObjectIds)],
      confidence: group.confidence === 'calculated' ? 'calculated' : 'preliminary',
    };
    delete result.sourceRoles;
    delete result.allCalculated;
    delete result.allRequiredLinearFeet;
    delete result.allPriced;
    delete result.pricedSubtotal;
    return result;
  });
}
