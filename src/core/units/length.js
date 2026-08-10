export const INCHES_PER_FOOT = 12;

export function formatFeetInches(totalInches, precision = 1) {
  if (!Number.isFinite(totalInches)) return '—';
  const rounded = Math.round(Math.abs(totalInches) / precision) * precision;
  const feet = Math.floor(rounded / INCHES_PER_FOOT);
  const inches = rounded - feet * INCHES_PER_FOOT;
  const sign = totalInches < 0 ? '−' : '';
  const inchText = Number.isInteger(inches) ? inches.toFixed(0) : inches.toFixed(1);
  return `${sign}${feet}′ ${inchText}″`;
}

export function squareInchesToSquareFeet(area) {
  return area / (INCHES_PER_FOOT * INCHES_PER_FOOT);
}

export function formatSquareFeet(areaInSquareInches) {
  return `${squareInchesToSquareFeet(areaInSquareInches).toLocaleString(undefined, { maximumFractionDigits: 1 })} sq ft`;
}
