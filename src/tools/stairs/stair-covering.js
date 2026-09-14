// DCR estimating recipes, not structural or manufacturer installation rules.
export const DEFAULT_STAIR_TREAD_DEPTH = 11;
export const STAIR_COVERING_STYLES = Object.freeze([
  { value: 'picture-frame', label: 'Pictureframe stairs' },
  { value: 'square-cut', label: 'Square cut stairs' },
]);
export const STAIR_BOARD_WIDTH_INCHES = 5.5;
export const STAIR_SIDE_CUT_ALLOWANCE_INCHES = 16;
export const STAIR_RISER_FASCIA_STOCK_FEET = Object.freeze([12, 16]);

// Plan only riser cuts. Try both stock caps so buying one longer board can
// replace two shorter boards, without assuming a riser can be spliced.
export function planStairRiserFasciaStock(coverings, { wastePercent = 10, stockLengthsFeet = STAIR_RISER_FASCIA_STOCK_FEET } = {}) {
  const stock = [...new Set(stockLengthsFeet.map(Number))].filter((length) => Number.isFinite(length) && length > 0).sort((a, b) => a - b);
  if (!stock.length) throw new Error('Riser fascia requires at least one commercial stock length.');
  const cuts = coverings.flatMap((covering) => covering.fasciaCuts
    .filter((cut) => cut.role === 'riser' && cut.lengthInches > 0)
    .flatMap((cut) => Array.from({ length: cut.quantity }, () => ({ lengthFeet: cut.lengthInches / 12, stairId: covering.stairId }))));
  const oversized = cuts.filter((cut) => cut.lengthFeet > stock.at(-1));
  const supported = cuts.filter((cut) => cut.lengthFeet <= stock.at(-1)).sort((a, b) => b.lengthFeet - a.lengthFeet);
  if (!supported.length) return { pieces: [], oversized };
  const net = supported.reduce((sum, cut) => sum + cut.lengthFeet, 0);
  const waste = Number.isFinite(Number(wastePercent)) ? Math.max(0, Number(wastePercent)) : 10;
  const target = net * (1 + waste / 100);
  const candidates = stock.filter((cap) => cap >= supported[0].lengthFeet).map((cap) => {
    const bins = [];
    for (const cut of supported) {
      const bin = bins.filter((entry) => entry.usedFeet + cut.lengthFeet <= cap + 1e-8)
        .sort((a, b) => b.usedFeet - a.usedFeet)[0];
      if (bin) { bin.usedFeet += cut.lengthFeet; bin.cuts.push(cut); }
      else bins.push({ usedFeet: cut.lengthFeet, cuts: [cut] });
    }
    const pieces = bins.map((bin) => ({ ...bin, stockLengthFeet: stock.find((length) => length + 1e-8 >= bin.usedFeet) }));
    let purchased = pieces.reduce((sum, piece) => sum + piece.stockLengthFeet, 0);
    // Even at zero configured waste, an exact net-stock match advances to
    // the next available purchase increment to leave a cutting allowance.
    while (purchased + 1e-8 < target || purchased <= net + 1e-8) {
      const upgrades = pieces.map((piece) => ({ piece, next: stock.find((length) => length > piece.stockLengthFeet) }))
        .filter((entry) => entry.next).sort((a, b) => (a.next - a.piece.stockLengthFeet) - (b.next - b.piece.stockLengthFeet));
      const upgrade = upgrades[0];
      if (upgrade && upgrade.next - upgrade.piece.stockLengthFeet <= stock[0]) {
        purchased += upgrade.next - upgrade.piece.stockLengthFeet;
        upgrade.piece.stockLengthFeet = upgrade.next;
      } else {
        pieces.push({ usedFeet: 0, cuts: [], stockLengthFeet: stock[0] });
        purchased += stock[0];
      }
    }
    return { pieces, purchased };
  }).sort((a, b) => a.purchased - b.purchased || a.pieces.length - b.pieces.length);
  return { pieces: candidates[0].pieces, oversized };
}

export function getStairCoveringStyle(stair) {
  const style = stair?.covering?.style;
  return STAIR_COVERING_STYLES.some((entry) => entry.value === style) ? style : 'picture-frame';
}

export function setStairCoveringStyle(stair, style) {
  if (!STAIR_COVERING_STYLES.some((entry) => entry.value === style)) throw new Error('Select a supported stair covering type.');
  return {
    ...stair,
    covering: { ...stair.covering, schemaVersion: 1, style },
    lifecycle: { ...stair.lifecycle, revision: (stair.lifecycle?.revision ?? 1) + 1 },
  };
}

export function deriveStairCovering(stair) {
  const positive = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const width = positive(stair?.dimensions?.width);
  const risers = Math.floor(positive(stair?.dimensions?.riserCount ?? stair?.dimensions?.stepCount));
  const treads = Math.floor(positive(stair?.dimensions?.treadCount ?? Math.max(0, risers - 1)));
  const run = positive(stair?.dimensions?.totalRun);
  const rise = positive(stair?.dimensions?.totalRise);
  const treadDepth = positive(stair?.dimensions?.treadDepth ?? (treads && run ? run / treads : DEFAULT_STAIR_TREAD_DEPTH));
  const style = getStairCoveringStyle(stair);
  const pictureFrame = style === 'picture-frame';
  const treadCuts = pictureFrame
    ? [
        { role: 'inner', lengthInches: Math.max(0, width - 2 * STAIR_BOARD_WIDTH_INCHES), quantity: treads, cutAngle: 90 },
        { role: 'picture-frame-front', lengthInches: width, quantity: treads, cutAngle: 45 },
        { role: 'picture-frame-return', lengthInches: treadDepth, quantity: 2 * treads, cutAngle: 45 },
      ]
    : [{ role: 'square-cut-tread', lengthInches: width, quantity: 2 * treads, cutAngle: 90 }];
  const sideLengthInches = (pictureFrame ? Math.hypot(run, rise) : run) + STAIR_SIDE_CUT_ALLOWANCE_INCHES;
  const fasciaCuts = [
    { role: 'riser', lengthInches: width, quantity: risers },
    { role: 'side', lengthInches: sideLengthInches, quantity: width > 0 && treads > 0 ? 2 : 0 },
  ];
  const netFeet = (cuts) => cuts.reduce((sum, cut) => sum + cut.lengthInches * cut.quantity, 0) / 12;
  return {
    stairId: stair?.id, style, widthInches: width, treadDepthInches: treadDepth,
    treadCount: treads, riserCount: risers, treadCuts, fasciaCuts,
    innerStripLengthInches: pictureFrame ? Math.max(0, width - 11) : width,
    outerFrameLengthInches: pictureFrame ? width + 2 * treadDepth : width,
    sideLengthInches,
    squareShoulderLinearFeet: netFeet(treadCuts),
    riserFasciaLinearFeet: netFeet(fasciaCuts.filter((cut) => cut.role === 'riser')),
    sideFasciaLinearFeet: netFeet(fasciaCuts.filter((cut) => cut.role === 'side')),
  };
}
