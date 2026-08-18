import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, upsertObject } from '../src/core/document/project-document.js';
import { createSalesHubStepOneMessage, createSalesHubStepOnePayload, parseSalesHubLaunchContext, SALES_HUB_MESSAGE_TYPE } from '../src/core/integrations/dcr-sales-hub.js';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';

test('creates a versioned Step 1 payload with deck, railing, and stair quantities', () => {
  let project = createProjectDocument({ id: 'project-1', name: 'Backyard deck', now: '2026-08-18T00:00:00.000Z' });
  project = upsertObject(project, createDeckBoundary([{ x: 0, y: 0 }, { x: 144, y: 0 }, { x: 144, y: 120 }, { x: 0, y: 120 }], {}, () => 'boundary-1'));
  project = upsertObject(project, { type: 'stair', id: 'stair-1' });
  const payload = createSalesHubStepOnePayload(project, {
    opportunityId: 'opportunity-42',
    now: '2026-08-18T00:10:00.000Z',
    railingRuns: [
      { id: 'rail-1', system: 'wild-hog', lengthInches: 120 },
      { id: 'rail-2', system: 'trex', lengthInches: 60 },
    ],
  });
  assert.equal(payload.opportunityId, 'opportunity-42');
  assert.equal(payload.quantities.decking.squareFeet, 120);
  assert.equal(payload.quantities.railing.linearFeet, 15);
  assert.equal(payload.quantities.stairs.count, 1);
  assert.equal(createSalesHubStepOneMessage(payload).type, SALES_HUB_MESSAGE_TYPE);
});

test('accepts only a complete trusted launch origin for future Sales Hub messaging', () => {
  assert.deepEqual(parseSalesHubLaunchContext('?cmeOpportunityId=opp-1&cmeSalesHubOrigin=https%3A%2F%2Fsales.dcr.test'), {
    opportunityId: 'opp-1', targetOrigin: 'https://sales.dcr.test', connected: true,
  });
  assert.equal(parseSalesHubLaunchContext('?cmeOpportunityId=opp-1&cmeSalesHubOrigin=javascript%3Aalert(1)').connected, false);
});
