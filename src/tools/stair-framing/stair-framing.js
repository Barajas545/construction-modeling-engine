import { getStairCoveringStyle } from '../stairs/stair-covering.js';

export const STAIR_FRAMING_STOCK_LENGTHS_FEET = Object.freeze([8, 10, 12, 16, 20]);
export const DEFAULT_STAIR_STRINGER_SPACING_INCHES = 12;
export const PICTURE_FRAME_STRINGER_INSET_INCHES = 6.5;

// DCR layout/estimating recipe, not a structural approval. Offsets are axes
// measured from each stair edge; split the center bay without moving the pair.
function stringerOffsets(width, spacing, pictureFrame) {
  if (!Number.isFinite(width) || width <= 0) return [];
  const inset = Math.min(PICTURE_FRAME_STRINGER_INSET_INCHES, width / 2);
  const anchors = [...new Set(pictureFrame ? [0, inset, width - inset, width] : [0, width])];
  const offsets = [0];
  for (let i = 1; i < anchors.length; i += 1) {
    const start = anchors[i - 1];
    const length = anchors[i] - start;
    const bays = Math.max(1, Math.ceil(length / spacing));
    for (let bay = 1; bay <= bays; bay += 1) offsets.push(start + length * bay / bays);
  }
  return offsets;
}

function planLinearStock(requiredInches, stockLengths = STAIR_FRAMING_STOCK_LENGTHS_FEET) {
  const requiredFeet = Math.max(0, Number(requiredInches) || 0) / 12;
  if (!requiredFeet) return [];
  const lengths = [...stockLengths].map(Number).filter((value) => Number.isInteger(value) && value > 0).sort((a, b) => a - b);
  const target = Math.ceil(requiredFeet);
  const limit = target + Math.max(...lengths);
  const plans = Array(limit + 1).fill(null);
  plans[0] = [];
  for (let total = 1; total <= limit; total += 1) {
    lengths.forEach((length) => {
      const previous = plans[total - length];
      if (!previous) return;
      const candidate = [...previous, length].sort((a, b) => a - b);
      const current = plans[total];
      if (!current || candidate.length < current.length) plans[total] = candidate;
    });
  }
  for (let total = target; total <= limit; total += 1) if (plans[total]) return plans[total];
  return [];
}

function continuousStockLength(requiredInches, stockLengths = STAIR_FRAMING_STOCK_LENGTHS_FEET) {
  const requiredFeet = Math.max(0, Number(requiredInches) || 0) / 12;
  return [...stockLengths].map(Number).filter((value) => value >= requiredFeet).sort((a, b) => a - b)[0] ?? null;
}

export function deriveStairFraming(stair, options = {}) {
  const widthInches = Math.max(0, Number(stair?.dimensions?.width) || 0);
  const totalRiseInches = Math.max(0, Number(stair?.dimensions?.totalRise) || 0);
  const totalRunInches = Math.max(0, Number(stair?.dimensions?.totalRun) || 0);
  const maximumSpacingInches = Math.max(1, Number(options.maximumSpacingInches) || DEFAULT_STAIR_STRINGER_SPACING_INCHES);
  const pictureFrame = getStairCoveringStyle(stair) === 'picture-frame';
  const stringerOffsetsInches = stringerOffsets(widthInches, maximumSpacingInches, pictureFrame);
  const stringerCount = stringerOffsetsInches.length;
  const internalStringerCount = Math.max(0, stringerCount - 2);
  const actualSpacingInches = stringerOffsetsInches.reduce((max, offset, i) => i ? Math.max(max, offset - stringerOffsetsInches[i - 1]) : max, 0);
  const stringerLengthInches = Math.hypot(totalRunInches, totalRiseInches);
  const stringerStockLengthFeet = continuousStockLength(stringerLengthInches, options.stockLengthsFeet);
  const ledgerStockPieces = planLinearStock(widthInches, options.stockLengthsFeet);
  const lowerMembers = pictureFrame && stringerCount > 0 ? [
    { role: 'lower-closure', material: '2×8 PT', lengthInches: widthInches, stockLengthFeet: continuousStockLength(widthInches, options.stockLengthsFeet) },
    { role: 'bottom-tie', material: '2×4 PT', lengthInches: widthInches, stockLengthFeet: continuousStockLength(widthInches, options.stockLengthsFeet) },
  ] : [];
  const reviewReasons = [];
  if (stringerCount > 0 && !stringerStockLengthFeet) reviewReasons.push('Continuous stair stringer exceeds available stock.');
  if (lowerMembers.some((member) => !member.stockLengthFeet)) reviewReasons.push('Full-width stair closure / bottom tie exceeds available stock.');
  if (pictureFrame && widthInches > 0 && widthInches <= 13) reviewReasons.push('Stair is too narrow for two distinct stringers at 6.5 inches from each edge.');
  return {
    stairId: stair?.id ?? null,
    material: '2×12 PT',
    widthInches,
    totalRiseInches,
    totalRunInches,
    maximumSpacingInches,
    pictureFrame,
    stringerOffsetsInches,
    lowerMembers,
    actualSpacingInches,
    stringerCount,
    sideStringerCount: stringerCount ? 2 : 0,
    internalStringerCount,
    stringerLengthInches,
    stringerStockLengthFeet,
    ledgerLengthInches: widthInches,
    ledgerStockPieces,
    needsReview: reviewReasons.length > 0,
    reviewReason: reviewReasons.join(' ') || null,
  };
}

export function describeStairFramingTakeoff(document, options = {}) {
  const stairs = (document?.objects ?? []).filter((object) => object.type === 'stair');
  const stringers = new Map();
  const ledgers = new Map();
  const overlength = [];
  const lowerGroups = new Map();
  stairs.forEach((stair) => {
    const framing = deriveStairFraming(stair, options);
    framing.lowerMembers.forEach((member) => {
      const key = `${member.role}:${member.stockLengthFeet ?? `review:${stair.id}`}`;
      const group = lowerGroups.get(key) ?? { ...member, quantity: 0, sourceObjectIds: [] };
      group.quantity += 1;
      group.sourceObjectIds.push(stair.id);
      lowerGroups.set(key, group);
    });
    if (framing.stringerStockLengthFeet) {
      const key = framing.stringerStockLengthFeet;
      const group = stringers.get(key) ?? { quantity: 0, sourceObjectIds: [] };
      group.quantity += framing.stringerCount;
      group.sourceObjectIds.push(stair.id);
      stringers.set(key, group);
    } else if (framing.stringerCount) {
      overlength.push({ stair, framing });
    }
    framing.ledgerStockPieces.forEach((lengthFeet) => {
      const group = ledgers.get(lengthFeet) ?? { quantity: 0, sourceObjectIds: [] };
      group.quantity += 1;
      group.sourceObjectIds.push(stair.id);
      ledgers.set(lengthFeet, group);
    });
  });
  const lines = [...stringers.entries()].map(([lengthFeet, group]) => ({
    kind: 'count',
    id: `auto:stairs:stringer:${lengthFeet}`,
    category: 'framing',
    description: '2×12 PT stair stringer',
    specification: `${lengthFeet} ft stock · sides + internal at 12″ maximum; pictureframe supports at 6.5″ from edges`,
    quantity: group.quantity,
    stockLengthFeet: lengthFeet,
    sourceObjectIds: [...new Set(group.sourceObjectIds)],
    confidence: 'preliminary',
  }));
  lines.push(...[...ledgers.entries()].map(([lengthFeet, group]) => ({
    kind: 'count',
    id: `auto:stairs:ledger:${lengthFeet}`,
    category: 'framing',
    description: '2×12 PT stair ledger / header',
    specification: `${lengthFeet} ft stock · one measured header per stair`,
    quantity: group.quantity,
    stockLengthFeet: lengthFeet,
    sourceObjectIds: [...new Set(group.sourceObjectIds)],
    confidence: 'preliminary',
  })));
  lines.push(...overlength.map(({ stair, framing }) => ({
    kind: 'count',
    id: `auto:stairs:stringer:review:${stair.id}`,
    category: 'framing',
    description: '2×12 PT stair stringer · REVIEW',
    specification: `${(framing.stringerLengthInches / 12).toFixed(2)} ft continuous length exceeds available stock`,
    quantity: framing.stringerCount,
    sourceObjectIds: [stair.id],
    confidence: 'review',
  })));
  lines.push(...[...lowerGroups.entries()].map(([key, group]) => ({
    kind: 'count', id: `auto:stairs:${key}`, category: 'framing',
    description: `${group.material} stair ${group.role === 'lower-closure' ? 'lower riser closure' : 'bottom tie / sole plate'}${group.stockLengthFeet ? '' : ' · REVIEW'}`,
    specification: group.stockLengthFeet
      ? `${group.stockLengthFeet} ft stock · one full stair-width piece per pictureframe stair`
      : `${(group.lengthInches / 12).toFixed(2)} ft continuous width exceeds available stock`,
    quantity: group.quantity, stockLengthFeet: group.stockLengthFeet,
    sourceObjectIds: [...new Set(group.sourceObjectIds)], confidence: group.stockLengthFeet ? 'preliminary' : 'review',
  })));
  return lines;
}
