import { formatFeetInches, formatInches, formatSquareFeet } from '../../core/units/length.js';
import { TREAD_DEPTH_PRESETS } from './pyramid-stair.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

// Re-exported so the dialog and the solver can never disagree about the presets.
// 16.8″ and 22.5″ are three and four decking boards with their gaps.
export const PYRAMID_TREAD_PRESETS = TREAD_DEPTH_PRESETS;

/** Reads the solver result through one place so a shifted solver contract shows a dash,
 *  never a silent `undefined` or `$NaN` in the estimator's footprint numbers. */
function readSolution(solution) {
  const layout = solution.layout ?? solution;
  const footprint = solution.footprint ?? solution;
  const riserCount = num(layout.riserCount);
  return {
    riserCount,
    riserHeight: num(layout.riserHeight),
    // The last step lands on grade, so boxes = risers − 1 when the solver does not say.
    boxCount: num(solution.ringCount) ?? (Array.isArray(solution.rings) ? solution.rings.length : null) ?? (riserCount === null ? null : riserCount - 1),
    width: num(footprint.widthInches ?? footprint.width),
    depth: num(footprint.depthInches ?? footprint.depth),
    area: num(footprint.areaSquareInches ?? footprint.area),
  };
}

/** The live block inside the dialog; app.js re-renders only this on input. */
export function renderPyramidSummary(solution) {
  if (!solution || solution.ok === false) {
    return `<strong>No pyramid yet</strong><p class="pyramid-summary-reason">${esc(solution?.reason ?? 'Enter a total rise to size the steps.')}</p>`;
  }
  const facts = readSolution(solution);
  const row = (label, value) => `<div class="pyramid-summary-row"><span>${label}</span><strong>${value}</strong></div>`;
  return `<strong>Footprint at grade</strong>
    ${row('Risers', facts.riserCount ?? '—')}
    ${row('Riser height · exact', formatInches(facts.riserHeight, 3))}
    ${row('Stacked boxes', facts.boxCount ?? '—')}
    ${row('Footprint · width × depth', `${formatFeetInches(facts.width, .25)} × ${formatFeetInches(facts.depth, .25)}`)}
    ${facts.area === null ? '' : row('Footprint area', formatSquareFeet(facts.area))}`;
}

export function renderPyramidStairDialog(draft, boundaryEdges, solution) {
  const blocked = !solution || solution.ok === false;
  const treadDepth = num(draft.treadDepth);
  const selected = new Set(draft.steppingEdgeIds ?? []);
  const presets = PYRAMID_TREAD_PRESETS.map((depth) => `<button type="button" class="button ${Number(draft.treadPreset) === depth ? 'active-constraint' : ''}" data-action="set-pyramid-tread" data-tread="${depth}">${formatInches(depth)}</button>`).join('');
  // The host edge is listed so the estimator can see the full boundary, but it meets the
  // deck and can never step, so it is shown locked rather than hidden.
  const edges = (boundaryEdges ?? []).map((edge) => `<label class="reference-confirm pyramid-edge${edge.isHostEdge ? ' locked' : ''}"><input type="checkbox" name="steppingEdge" value="${esc(edge.id)}" data-edge-id="${esc(edge.id)}" ${!edge.isHostEdge && selected.has(edge.id) ? 'checked' : ''} ${edge.isHostEdge ? 'disabled' : ''}><strong>${esc(edge.label)}</strong><small> · ${formatFeetInches(edge.lengthInches, .25)}${edge.isHostEdge ? ' · meets the deck' : ''}</small>${edge.isHostEdge ? '<b class="object-badge">Deck side</b>' : ''}</label>`).join('');
  return `<dialog class="pyramid-dialog reference-dialog" aria-labelledby="pyramid-title"><form id="pyramid-form">
    <header><div><div class="eyebrow">CME stair tools</div><h1 id="pyramid-title">Pyramid steps</h1></div><button type="button" class="button ghost" data-action="close-pyramid" aria-label="Close pyramid steps">×</button></header>
    <p>Each ring is a full box, stacked smaller on top, stepping out on every side you select. The last step down lands on grade and is not a box.</p>
    <div class="reference-grid">
    <label>Total rise · deck surface to grade · inches<input name="totalRise" type="number" min="0" step="0.25" value="${esc(draft.totalRise)}"></label>
    <label>Tread depth · custom · inches<input name="treadDepth" type="number" min="1" step="0.1" value="${esc(draft.treadDepth)}"></label>
    </div>
    <div class="pyramid-presets context-actions context-actions-3">${presets}</div>
    <p class="context-note">16.8″ and 22.5″ are three and four decking boards with their gaps, so a tread takes whole boards with no rips. Each ring steps out ${formatInches(treadDepth)} per selected side.</p>
    <h2>Stepping sides</h2>
    <p>Every selected side steps out by the tread depth, so the footprint grows on that side with each box.</p>
    ${edges ? `<div class="pyramid-edges">${edges}</div>` : '<p class="pyramid-edges empty">This boundary has no edges to step.</p>'}
    <div id="pyramid-summary" class="pyramid-summary reference-metrics" aria-live="polite">${renderPyramidSummary(solution)}</div>
    <footer><button type="button" class="button ghost" data-action="close-pyramid">Cancel</button><button type="submit" class="button primary" ${blocked ? 'disabled' : ''}>Create pyramid steps</button></footer>
    </form></dialog>`;
}
