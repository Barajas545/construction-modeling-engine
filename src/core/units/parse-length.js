const MM_PER_INCH = 25.4;

export function parseConstructionLength(value) {
  const input = String(value).trim().toLowerCase().replace(/,/g, '');
  if (!input) return null;
  const feetInches = input.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)(?:\s*(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/);
  if (feetInches) return Number(feetInches[1]) * 12 + Number(feetInches[2] ?? 0);
  const millimeters = input.match(/^([+-]?\d+(?:\.\d+)?)\s*mm$/);
  if (millimeters) return Number(millimeters[1]) / MM_PER_INCH;
  const meters = input.match(/^([+-]?\d+(?:\.\d+)?)\s*m$/);
  if (meters) return Number(meters[1]) * 1000 / MM_PER_INCH;
  const inches = input.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)$/);
  if (inches) return Number(inches[1]);
  const bare = input.match(/^([+-]?\d+(?:\.\d+)?)$/);
  return bare ? Number(bare[1]) * 12 : null;
}
