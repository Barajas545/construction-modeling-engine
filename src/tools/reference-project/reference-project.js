import { createSalesHubStepOnePayload } from '../../core/integrations/dcr-sales-hub.js';
import { createTakeoffExport } from '../takeoff/takeoff.js';

export const REFERENCE_SCHEMA = 'com.dcr.cme.reference-project';
export const PROJECT_TYPES = ['new-deck', 'resurface', 'deck-expansion', 'partial-rebuild'];
export const COMPLEXITIES = ['standard', 'moderate', 'complex'];
const round = (n) => Math.round(n * 100) / 100;
const number = (v) => v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v);

export function referenceDefaults(document) {
  return { kind: 'design', projectType: '', complexity: '', city: '', stateCode: 'CA',
    secondaryAreaSF: '', completedDate: '', referencePrice: '', totalManHours: '',
    actualMaterialCost: '', actualLaborCost: '', actualOtherCost: '',
    deckingManufacturer: '', productLine: '', terrain: '', access: '',
    evidence: '', verifiedBy: '', notes: '', confirmed: false,
    ...document.referenceProject };
}

export function assessReference(document, metadata, quantities, now = new Date().toISOString()) {
  const errors = [];
  if (!document.name?.trim()) errors.push('Enter a project name.');
  if (!(quantities.decking.squareFeet > 0)) errors.push('Create a Deck Boundary with a positive area.');
  if (!PROJECT_TYPES.includes(metadata.projectType)) errors.push('Select the project type.');
  if (!COMPLEXITIES.includes(metadata.complexity)) errors.push('Select the project complexity.');
  const framing = number(metadata.secondaryAreaSF);
  if (framing == null) errors.push('Enter the framing area in SF (0 if no new framing).');
  if (framing != null && framing > quantities.decking.squareFeet) errors.push('Framing area cannot exceed this sketch’s decking area.');
  if (metadata.projectType === 'resurface' && framing !== 0) errors.push('Resurface references use 0 SF of new framing.');
  if (metadata.kind === 'historical') {
    if (!(number(metadata.referencePrice) > 0)) errors.push('Enter the final sale price of the completed work.');
    const date = String(metadata.completedDate ?? '');
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > now.slice(0, 10)) errors.push('Enter a valid completion date, no later than today.');
    if (!metadata.city?.trim()) errors.push('Enter the project city.');
    if (!metadata.evidence?.trim()) errors.push('Identify the final invoice or job closeout record.');
    if (!metadata.verifiedBy?.trim()) errors.push('Enter who verified the completed project.');
    if (metadata.confirmed !== true) errors.push('Confirm the quantities and final sale price represent completed DCR work.');
  }
  if (!['design', 'historical'].includes(metadata.kind)) errors.push('Choose a reference classification.');
  return { canExport: errors.length === 0, historicalReady: metadata.kind === 'historical' && errors.length === 0, errors };
}

export function createReferenceProjectExport(document, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const metadata = { ...referenceDefaults(document), ...options.metadata };
  const context = options.takeoffContext ?? {};
  const railingRuns = (context.railingGeometries ?? []).map((g) => ({
    id: g.railing.id, system: g.railing.settings?.system ?? 'unassigned', lengthInches: g.length,
  }));
  const scope = createSalesHubStepOnePayload(document, { now, railingRuns });
  const qualification = assessReference(document, metadata, scope.quantities, now);
  if (!qualification.canExport) throw new Error(qualification.errors.join(' '));
  const historical = qualification.historicalReady;
  const price = historical ? number(metadata.referencePrice) : null;
  const takeoff = createTakeoffExport(document, { ...context, now, includePrices: true, mode: 'detailed' });
  const active = takeoff.lines.filter((line) => line.quantity > 0);
  const missing = active.filter((line) => line.unitPrice == null);
  const known = round(active.reduce((sum, line) => sum + (line.subtotal ?? 0), 0));
  const actualCosts = Object.fromEntries(['actualMaterialCost', 'actualLaborCost', 'actualOtherCost'].map((key) => [key, historical ? number(metadata[key]) : null]));
  const costsComplete = Object.values(actualCosts).every((value) => value != null);
  return {
    schema: REFERENCE_SCHEMA, schemaVersion: 1, exportedAt: now,
    source: { application: 'CME', projectId: document.id, projectUpdatedAt: document.updatedAt,
      referenceId: `CME-${document.id}`, classification: historical ? 'completed-dcr-project' : 'design-reference' },
    qualification: { ...qualification, verification: historical ? 'user-attested' : 'not-applicable',
      comparisonPending: 'DCR must compare project type and similarity (at least 60%) with the target estimate.',
      requiresDcrImporter: true },
    // Exact field names consumed by dcr-portal estimates.js / SalesReferenceProjects.
    salesReferenceProject: {
      projectRef: `CME-${document.id}`, projectName: document.name, trade: 'deck',
      projectType: metadata.projectType, complexity: metadata.complexity,
      refStatus: historical ? 'completed' : 'draft', activeAsReference: historical, isSample: false,
      city: metadata.city.trim(), stateCode: metadata.stateCode.trim(),
      completedDate: historical ? metadata.completedDate : null,
      primaryAreaSF: scope.quantities.decking.squareFeet, secondaryAreaSF: number(metadata.secondaryAreaSF),
      railingLF: scope.quantities.railing.linearFeet, stairs: scope.quantities.stairs.count,
      referencePrice: price, costPerPrimaryUnit: price == null ? null : round(price / scope.quantities.decking.squareFeet),
      totalManHours: historical ? number(metadata.totalManHours) : null,
      deckingManufacturer: metadata.deckingManufacturer.trim(), productLine: metadata.productLine.trim(),
      notes: metadata.notes.trim(), picturesJson: '[]',
    },
    quantities: { ...scope.quantities, framing: { squareFeet: number(metadata.secondaryAreaSF), source: 'user-confirmed-scope' } },
    site: { terrain: metadata.terrain, access: metadata.access },
    financials: { currency: 'USD', referencePriceBasis: 'final-sale-price',
      costPerPrimaryUnitBasis: 'final-sale-price / decking-SF; legacy DCR field is not actual job cost',
      estimatedMaterials: { knownSubtotal: known, unpricedLineCount: missing.length,
        allActiveLinesPriced: active.length > 0 && missing.length === 0,
        total: active.length > 0 && missing.length === 0 ? known : null },
      actualCosts: { ...actualCosts, total: costsComplete ? round(Object.values(actualCosts).reduce((a, b) => a + b, 0)) : null },
    },
    evidence: { recordReference: historical ? metadata.evidence.trim() : null,
      verifiedBy: historical ? metadata.verifiedBy.trim() : null, confirmed: historical },
    takeoff,
    model: JSON.parse(JSON.stringify({ ...document, referenceProject: metadata })),
  };
}
