import { formatFeetInches, formatInches } from '../../core/units/length.js';
import { deriveStairCovering, STAIR_COVERING_STYLES } from './stair-covering.js';

// Shared by annotation and object selection; contains no application state.
export function renderStairCoveringControls(stair) {
  const covering = deriveStairCovering(stair);
  const pictureFrame = covering.style === 'picture-frame';
  const stripSummary = pictureFrame
    ? `Inner ${formatInches(covering.innerStripLengthInches)} + frame ${formatInches(covering.widthInches)} + 2 × ${formatInches(covering.treadDepthInches)} returns · 45° frame cuts`
    : `2 × ${formatInches(covering.widthInches)} square-shoulder strips per tread · 90° cuts`;
  return `<div class="field full"><label for="stair-covering-style">Stair type / covering</label><select id="stair-covering-style">${STAIR_COVERING_STYLES.map((entry) => `<option value="${entry.value}" ${entry.value === covering.style ? 'selected' : ''}>${entry.label}</option>`).join('')}</select></div><div class="context-note">${stripSummary}<br>Fascia: each riser = stair width; each side = ${formatFeetInches(covering.sideLengthInches, .25)} (${pictureFrame ? 'slope' : 'total run'} + 16″).<br>Net takeoff: ${covering.squareShoulderLinearFeet.toFixed(2)} LF square-shoulder · ${(covering.riserFasciaLinearFeet + covering.sideFasciaLinearFeet).toFixed(2)} LF fascia. Waste added in Takeoff.</div>`;
}
