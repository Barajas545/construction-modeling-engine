const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderReferenceProjectDialog(metadata, quantities, assessment) {
  const input = (key, label, type = 'text') => `<label>${label}<input name="${key}" type="${type}" value="${esc(metadata[key])}" ${type === 'number' ? 'min="0" step="0.01"' : ''}></label>`;
  const select = (key, label, choices) => `<label>${label}<select name="${key}"><option value="">Select…</option>${choices.map(([value, title]) => `<option value="${value}" ${metadata[key] === value ? 'selected' : ''}>${title}</option>`).join('')}</select></label>`;
  const historical = metadata.kind === 'historical';
  return `<dialog class="reference-dialog" aria-labelledby="reference-title"><form id="reference-form">
    <header><div><div class="eyebrow">DCR project library</div><h1 id="reference-title">Export as reference project</h1></div><button type="button" class="button ghost" data-action="close-reference" aria-label="Close reference export">×</button></header>
    <p>Export an editable CME model, detailed materials, quantities, and reference information in one JSON file. Import into DCR will require an adapter; this export does not send data to DCR.</p>
    <div class="reference-metrics">Decking <strong>${quantities.decking.squareFeet} SF</strong> · Railing <strong>${quantities.railing.linearFeet} LF</strong> · Stair assemblies <strong>${quantities.stairs.count}</strong></div>
    <div class="reference-grid">
    ${select('kind', 'Reference classification', [['design', 'Design / estimated reference'], ['historical', 'Completed DCR project']])}
    ${select('projectType', 'Project type', [['new-deck', 'New deck'], ['resurface', 'Resurface'], ['deck-expansion', 'Deck expansion'], ['partial-rebuild', 'Partial rebuild']])}
    ${select('complexity', 'Complexity', [['standard', 'Standard'], ['moderate', 'Moderate'], ['complex', 'Complex']])}
    ${input('secondaryAreaSF', 'New / replaced framing area · SF', 'number')}
    ${input('city', 'City')}${input('stateCode', 'State')}
    ${select('terrain', 'Terrain · optional', [['flat', 'Flat'], ['slope', 'Slope'], ['hillside', 'Hillside']])}
    ${select('access', 'Access · optional', [['easy', 'Easy'], ['moderate', 'Moderate'], ['difficult', 'Difficult']])}
    ${input('deckingManufacturer', 'Decking manufacturer · optional')}${input('productLine', 'Product line / color · optional')}
    </div>
    <p>For expansion or partial rebuild, enter only the new or replaced framing area. Resurface uses 0 SF. Decking and railing quantities include hidden objects.</p>
    ${historical ? `<h2>Completed work and financial evidence</h2><p>Final sale price is what DCR charged for this scope. Actual job costs and estimated material prices are separate.</p><div class="reference-grid">
      ${input('completedDate', 'Completion date', 'date')}${input('referencePrice', 'Final sale price · USD', 'number')}
      ${input('totalManHours', 'Actual total man-hours · optional', 'number')}${input('verifiedBy', 'Verified by')}
      ${input('evidence', 'Final invoice / closeout ID or link')}${input('actualMaterialCost', 'Actual material cost · USD · optional', 'number')}
      ${input('actualLaborCost', 'Actual labor cost · USD · optional', 'number')}${input('actualOtherCost', 'Other actual costs · USD · optional', 'number')}
      </div><label class="reference-confirm"><input type="checkbox" name="confirmed" ${metadata.confirmed ? 'checked' : ''}>I confirm this is completed DCR work and the sketch quantities, framing scope, and final sale price match the completed scope.</label>` : '<p class="reference-notice">Design references retain estimated material prices. They remain inactive for DCR historical pricing until completed-work information is supplied.</p>'}
    <label>Scope, inclusions, exclusions and estimator notes<textarea name="notes" rows="3">${esc(metadata.notes)}</textarea></label>
    <div id="reference-assessment" aria-live="polite">${renderReferenceAssessment(assessment)}</div>
    <footer><button type="button" class="button ghost" data-action="save-reference-details">Save details</button><button type="submit" class="button primary">Download reference JSON</button></footer>
    </form></dialog>`;
}

export function renderReferenceAssessment(assessment) {
  return assessment.errors.length ? `<strong>Needed before export</strong><ul>${assessment.errors.map((error) => `<li>${esc(error)}</li>`).join('')}</ul>`
    : `<strong>${assessment.historicalReady ? 'Completed-project information ready · DCR similarity review still applies.' : 'Ready as a design reference · excluded from historical pricing.'}</strong>`;
}
