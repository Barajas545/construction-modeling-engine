import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, upsertObject, parseProject, serializeProject } from '../src/core/document/project-document.js';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { addManualTakeoffLine } from '../src/tools/takeoff/takeoff.js';
import { createReferenceProjectExport, referenceDefaults } from '../src/tools/reference-project/reference-project.js';

const now = '2026-09-14T12:00:00.000Z';
function project() {
  let p = createProjectDocument({ id: 'test-project', name: 'Reference deck', now });
  p = upsertObject(p, createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }]));
  return addManualTakeoffLine(p, { category: 'custom', description: 'Extra board', quantity: 2, unitPrice: 50 });
}
const design = { kind: 'design', projectType: 'new-deck', complexity: 'standard', secondaryAreaSF: 100 };
const historical = { ...design, kind: 'historical', city: 'San Luis Obispo', referencePrice: 15000,
  completedDate: '2026-08-31', evidence: 'Final invoice DCR-123', verifiedBy: 'Estimator', confirmed: true };

test('design exports preserve model and adjusted material data without inventing history', () => {
  const p = project();
  const result = createReferenceProjectExport(p, { metadata: { ...design, referencePrice: 10000 }, now });
  assert.equal(result.salesReferenceProject.primaryAreaSF, 100);
  assert.equal(result.salesReferenceProject.referencePrice, null);
  assert.equal(result.salesReferenceProject.costPerPrimaryUnit, null);
  assert.equal(result.salesReferenceProject.activeAsReference, false);
  assert.equal(result.salesReferenceProject.refStatus, 'draft');
  assert.equal(result.financials.estimatedMaterials.knownSubtotal, 100);
  assert.equal(result.financials.actualCosts.total, null);
  assert.ok(result.takeoff.lines.some((l) => l.origin === 'manual' && l.quantity === 2 && l.unitPrice === 50));
  assert.equal(parseProject(serializeProject(result.model)).id, p.id);
  result.model.objects[0].name = 'changed';
  assert.notEqual(p.objects[0].name, 'changed');
});

test('completed references map final sale price to DCR legacy rate separately from actual costs', () => {
  const result = createReferenceProjectExport(project(), { now, metadata: { ...historical, actualMaterialCost: 3000, actualLaborCost: 4000, actualOtherCost: 0 } });
  assert.equal(result.salesReferenceProject.costPerPrimaryUnit, 150);
  assert.equal(result.salesReferenceProject.referencePrice, 15000);
  assert.equal(result.financials.actualCosts.total, 7000);
  assert.equal(result.salesReferenceProject.refStatus, 'completed');
  assert.equal(result.qualification.verification, 'user-attested');
  assert.equal(result.qualification.requiresDcrImporter, true);
  assert.equal(result.salesReferenceProject.totalManHours, null);
});

test('incomplete or invalid completed projects cannot silently qualify', () => {
  for (const patch of [{ confirmed: false }, { evidence: '' }, { verifiedBy: '' }, { city: '' }, { referencePrice: '' }, { referencePrice: -5 }, { completedDate: '2027-01-01' }, { completedDate: '2026-02-30' }, { secondaryAreaSF: '' }, { secondaryAreaSF: 101 }, { complexity: '' }]) {
    assert.throws(() => createReferenceProjectExport(project(), { now, metadata: { ...historical, ...patch } }));
  }
  assert.throws(() => createReferenceProjectExport(createProjectDocument(), { now, metadata: design }));
});

test('resurface scope and geometry quantities are explicit; defaults survive project roundtrip', () => {
  const p = project();
  p.referenceProject = { ...design, projectType: 'resurface', secondaryAreaSF: 0 };
  const options = { now, takeoffContext: { railingGeometries: [] } };
  const exported = createReferenceProjectExport(parseProject(serializeProject(p)), options);
  assert.equal(exported.salesReferenceProject.secondaryAreaSF, 0);
  assert.equal(exported.salesReferenceProject.stairs, 0);
  assert.equal(exported.salesReferenceProject.projectRef, `CME-${p.id}`);
  assert.equal(referenceDefaults(exported.model).projectType, 'resurface');
  assert.throws(() => createReferenceProjectExport(p, { ...options, metadata: { secondaryAreaSF: 50 } }));
});
