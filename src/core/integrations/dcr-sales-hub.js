export const SALES_HUB_STEP_ONE_SCHEMA = 'com.dcr.sales-hub.step-1.cme';
export const SALES_HUB_STEP_ONE_VERSION = 1;
export const SALES_HUB_MESSAGE_TYPE = 'dcr.cme.step1.ready';

const round = (value, precision = 2) => Number(Number(value).toFixed(precision));
const squareFeet = (squareInches) => round((Number(squareInches) || 0) / 144);
const linearFeet = (inches) => round((Number(inches) || 0) / 12);

export function createSalesHubStepOnePayload(document, options = {}) {
  const deckAreas = document.objects
    .filter((object) => object.type === 'deck-boundary')
    .map((boundary) => ({
      boundaryId: boundary.id,
      name: boundary.name ?? 'Deck area',
      squareFeet: squareFeet(boundary.computed?.areaSquareInches),
      downLevelInches: Number(boundary.metadata?.levelDownInches ?? 0),
    }));
  const railingRuns = (options.railingRuns ?? []).map((run) => ({
    railingId: run.id,
    type: run.system ?? 'unassigned',
    linearFeet: linearFeet(run.lengthInches),
  }));
  const railingByType = Object.entries(railingRuns.reduce((totals, run) => {
    totals[run.type] = (totals[run.type] ?? 0) + run.linearFeet;
    return totals;
  }, {})).map(([type, total]) => ({ type, linearFeet: round(total) }));
  const stairs = document.objects.filter((object) => object.type === 'stair');

  return {
    schema: SALES_HUB_STEP_ONE_SCHEMA,
    schemaVersion: SALES_HUB_STEP_ONE_VERSION,
    exportedAt: options.now ?? new Date().toISOString(),
    opportunityId: options.opportunityId ?? null,
    sketch: {
      projectId: document.id,
      projectName: document.name,
      modelSchema: document.schema,
      modelSchemaVersion: document.schemaVersion,
      workflowStage: document.workflow?.stage ?? 'field-capture',
      updatedAt: document.updatedAt,
    },
    quantities: {
      decking: {
        squareFeet: round(deckAreas.reduce((total, area) => total + area.squareFeet, 0)),
        areaCount: deckAreas.length,
        areas: deckAreas,
      },
      railing: {
        linearFeet: round(railingRuns.reduce((total, run) => total + run.linearFeet, 0)),
        runCount: railingRuns.length,
        byType: railingByType,
        runs: railingRuns,
      },
      stairs: { count: stairs.length },
    },
  };
}

export function createSalesHubStepOneMessage(payload) {
  return { type: SALES_HUB_MESSAGE_TYPE, schemaVersion: SALES_HUB_STEP_ONE_VERSION, payload };
}

export function parseSalesHubLaunchContext(search = '') {
  const parameters = new URLSearchParams(search);
  const opportunityId = parameters.get('cmeOpportunityId');
  const requestedOrigin = parameters.get('cmeSalesHubOrigin');
  let targetOrigin = null;
  if (requestedOrigin) {
    try {
      const url = new URL(requestedOrigin);
      if (['https:', 'http:'].includes(url.protocol) && url.origin === requestedOrigin) targetOrigin = url.origin;
    } catch { /* Ignore malformed launch context. */ }
  }
  return { opportunityId, targetOrigin, connected: Boolean(opportunityId && targetOrigin) };
}
