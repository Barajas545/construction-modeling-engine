import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, upsertObject } from '../src/core/document/project-document.js';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { createOneDriveClient } from '../src/core/storage/onedrive-client.js';
import { createOneDriveSync } from '../src/core/storage/onedrive-sync.js';
import { createFakeDrive, createMemoryStorage } from './helpers/fake-onedrive.js';

const now = '2026-09-22T12:00:00.000Z';
const FOLDER = 'CME/Projects/CME-000001 — Smith Backyard Deck';

function project(name = 'Smith Backyard Deck', id = 'project-1') {
  const document = createProjectDocument({ id, name, now });
  return upsertObject(document, createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }]), now);
}

function harness(options = {}) {
  const fake = createFakeDrive(options);
  const client = createOneDriveClient({ getToken: fake.getToken, fetch: fake.fetch, sleep: async () => {} });
  const storage = createMemoryStorage();
  return { fake, client, storage, sync: createOneDriveSync({ client, storage, now: () => now }) };
}

test('the first save provisions the whole CME tree and writes the project file', async () => {
  const { fake, sync } = harness({ folders: [] });
  const result = await sync.saveProject(project());

  assert.equal(result.status, 'saved');
  assert.equal(result.document.projectNumber, 1);
  assert.equal(result.paths.projectFile, `${FOLDER}/project.cme.json`);
  for (const folder of [
    'CME', 'CME/Projects', 'CME/Templates', 'CME/Templates/Materials', 'CME/Templates/Assemblies',
    FOLDER, `${FOLDER}/Exports/Plans`, `${FOLDER}/Exports/Takeoffs`, `${FOLDER}/Exports/DCR Sales Hub`,
    `${FOLDER}/Attachments/Photos`, `${FOLDER}/Attachments/Audio`,
  ]) assert.ok(fake.has(folder), `expected OneDrive folder ${folder}`);

  const written = JSON.parse(fake.read(`${FOLDER}/project.cme.json`));
  assert.equal(written.name, 'Smith Backyard Deck');
  assert.equal(written.projectNumber, 1);
  assert.equal(written.objects.length, 1);
});

test('the project file is written before the subfolder tree is provisioned', async () => {
  const { fake, sync } = harness({ folders: [] });
  await sync.saveProject(project());
  const writes = fake.drive.requests.filter((r) => (r.method === 'PUT' && r.verb === 'content') || (r.method === 'POST' && r.verb === 'children'));
  const fileWrite = writes.findIndex((r) => r.method === 'PUT');
  const exportsFolder = writes.findIndex((r) => r.method === 'POST' && r.path.endsWith('Exports'));
  assert.ok(fileWrite >= 0 && exportsFolder >= 0);
  // An interrupted save must never leave a numbered folder holding no project.
  assert.ok(fileWrite < exportsFolder, 'project.cme.json should be written before Exports/ is created');
});

test('the subfolder tree is provisioned once, not on every autosave', async () => {
  const { fake, sync } = harness({ folders: [] });
  const first = await sync.saveProject(project());
  const afterFirst = fake.drive.requests.length;
  await sync.saveProject(first.document);
  const secondSaveRequests = fake.drive.requests.length - afterFirst;
  assert.equal(secondSaveRequests, 1, 'a repeat autosave should be a single upload');
  assert.equal(fake.drive.requests.filter((r) => r.method === 'POST' && r.verb === 'children').length,
    fake.folderList().length, 'no folder should be created twice');
});

test('a project folder deleted in OneDrive is rebuilt rather than losing the edit', async () => {
  const { fake, sync } = harness({ folders: [] });
  const first = await sync.saveProject(project());
  for (const folder of [...fake.drive.folders].filter((f) => f.startsWith(FOLDER))) fake.drive.folders.delete(folder);
  fake.drive.files.delete(`${FOLDER}/project.cme.json`);

  const again = await sync.saveProject(first.document);
  assert.equal(again.status, 'saved');
  assert.ok(fake.read(`${FOLDER}/project.cme.json`), 'the project should be rewritten into a rebuilt folder');
});

test('project numbers continue from the folders already in OneDrive', async () => {
  const { sync } = harness({ folders: ['CME', 'CME/Projects', 'CME/Projects/CME-000123 — Older deck', 'CME/Projects/Archive'] });
  const result = await sync.saveProject(project());
  assert.equal(result.document.projectNumber, 124);
  assert.equal(result.paths.folder, 'CME/Projects/CME-000124 — Smith Backyard Deck');
});

test('a saved project keeps its number across later saves', async () => {
  const { sync, fake } = harness({ folders: [] });
  const first = await sync.saveProject(project());
  const second = await sync.saveProject({ ...first.document, updatedAt: now });
  assert.equal(second.document.projectNumber, 1);
  const projectFolders = fake.folderList().filter((f) => f.startsWith('CME/Projects/CME-') && f.split('/').length === 3);
  assert.deepEqual(projectFolders, [FOLDER], 'no duplicate project folder');
});

test('renaming a project renames its OneDrive folder and keeps the contents', async () => {
  const { sync, fake } = harness({ folders: [] });
  const first = await sync.saveProject(project());
  await sync.saveExport(first.document, 'takeoff', { content: '{"lines":[]}', extension: 'json', contentType: 'application/json' });

  const renamed = await sync.saveProject({ ...first.document, name: 'Smith Rear Deck' });
  const folder = 'CME/Projects/CME-000001 — Smith Rear Deck';
  assert.equal(renamed.paths.folder, folder);
  assert.ok(fake.has(`${folder}/project.cme.json`));
  assert.ok(!fake.has(FOLDER), 'the old folder should not linger');
  assert.equal(fake.drive.files.size, 2, 'the takeoff export should move with the folder');
});

test('a project changed in OneDrive by another device is reported as a conflict, not overwritten', async () => {
  const { sync, fake } = harness({ folders: [] });
  const first = await sync.saveProject(project());

  // Another device saves a different version straight into the drive.
  fake.drive.files.set(`${FOLDER}/project.cme.json`, { content: JSON.stringify({ ...first.document, name: 'Edited elsewhere' }), eTag: '"99"' });

  const result = await sync.saveProject({ ...first.document, name: 'My local edit' });
  assert.equal(result.status, 'conflict');
  assert.equal(result.remote.name, 'Edited elsewhere');
  assert.equal(JSON.parse(fake.read(`${FOLDER}/project.cme.json`)).name, 'Edited elsewhere', 'the remote copy must survive');
  // A rejected save must leave the drive untouched, including the folder name.
  assert.ok(fake.has(FOLDER), 'the folder must not be renamed by a save that was refused');
  assert.ok(!fake.has('CME/Projects/CME-000001 — My local edit'));
});

test('a conflict can be resolved by explicitly overwriting the remote copy', async () => {
  const { sync, fake } = harness({ folders: [] });
  const first = await sync.saveProject(project());
  fake.drive.files.set(`${FOLDER}/project.cme.json`, { content: JSON.stringify(first.document), eTag: '"99"' });

  const resolved = await sync.overwriteRemote({ ...first.document, name: 'Smith Backyard Deck' });
  assert.equal(resolved.status, 'saved');
  assert.equal(JSON.parse(fake.read(`${FOLDER}/project.cme.json`)).name, 'Smith Backyard Deck');
});

test('exports land in their own folders and never overwrite an earlier export', async () => {
  const { sync, fake } = harness({ folders: [] });
  const document = (await sync.saveProject(project())).document;

  const plan = await sync.saveExport(document, 'plan', { content: 'PDF', extension: 'pdf', contentType: 'application/pdf', prefix: 'plan' });
  const takeoff = await sync.saveExport(document, 'takeoff', { content: '{}', extension: 'json', contentType: 'application/json', prefix: 'takeoff' });
  const stepOne = await sync.saveExport(document, 'sales-hub', { content: '{}', extension: 'json', contentType: 'application/json', prefix: 'step-1' });

  assert.equal(plan.path, `${FOLDER}/Exports/Plans/2026-09-22-1200-plan.pdf`);
  assert.equal(takeoff.path, `${FOLDER}/Exports/Takeoffs/2026-09-22-1200-takeoff.json`);
  assert.equal(stepOne.path, `${FOLDER}/Exports/DCR Sales Hub/2026-09-22-1200-step-1.json`);
  assert.equal(fake.read(plan.path), 'PDF');

  await assert.rejects(() => sync.saveExport(document, 'invoices', { content: 'x' }), /Unsupported CME export destination/);
});

test('field attachments are filed under Photos and Audio', async () => {
  const { sync, fake } = harness({ folders: [] });
  const document = (await sync.saveProject(project())).document;

  const photo = await sync.saveAttachment(document, 'photo', { content: 'JPEG', extension: 'jpg', contentType: 'image/jpeg', prefix: 'site' });
  const audio = await sync.saveAttachment(document, 'audio', { content: 'WEBM', extension: 'webm', contentType: 'audio/webm', prefix: 'note' });

  assert.equal(photo.path, `${FOLDER}/Attachments/Photos/2026-09-22-1200-site.jpg`);
  assert.equal(audio.path, `${FOLDER}/Attachments/Audio/2026-09-22-1200-note.webm`);
  assert.equal(fake.read(photo.path), 'JPEG');
});

test('a project saved on one device reopens on another with its number intact', async () => {
  const first = harness({ folders: [] });
  const saved = await first.sync.saveProject(project());

  // A second device, with its own empty sync bookkeeping, shares the drive.
  const second = createOneDriveSync({
    client: createOneDriveClient({ getToken: first.fake.getToken, fetch: first.fake.fetch, sleep: async () => {} }),
    storage: createMemoryStorage(),
    now: () => now,
  });

  const listed = await second.listProjects();
  assert.deepEqual(listed, [{ number: 1, name: 'Smith Backyard Deck', folderName: 'CME-000001 — Smith Backyard Deck', lastModified: null }]);

  const reopened = await second.openProject(listed[0].folderName);
  assert.equal(reopened.id, saved.document.id);
  assert.equal(reopened.projectNumber, 1);
  assert.equal(reopened.objects.length, 1);

  // Having read the current version, the second device may now save over it.
  assert.equal((await second.saveProject({ ...reopened, name: 'Smith Backyard Deck' })).status, 'saved');
});

test('sync bookkeeping survives a page reload', async () => {
  const fake = createFakeDrive({ folders: [] });
  const storage = createMemoryStorage();
  const build = () => createOneDriveSync({
    client: createOneDriveClient({ getToken: fake.getToken, fetch: fake.fetch, sleep: async () => {} }),
    storage, now: () => now,
  });

  const saved = await build().saveProject(project());
  // A fresh controller reading the same storage must not re-number the project.
  const reloaded = await build().saveProject({ ...saved.document, projectNumber: null });
  assert.equal(reloaded.document.projectNumber, 1);
  assert.equal(fake.folderList().filter((f) => /CME-\d{6}/.test(f) && f.split('/').length === 3).length, 1);
});

test('an offline save reports the failure instead of pretending it synced', async () => {
  const offline = createOneDriveSync({
    client: createOneDriveClient({ getToken: async () => 't', fetch: async () => { throw new TypeError('Failed to fetch'); }, sleep: async () => {} }),
    storage: createMemoryStorage(),
    now: () => now,
  });
  await assert.rejects(() => offline.saveProject(project()), (error) => {
    assert.equal(error.kind, 'offline');
    assert.match(error.message, /stayed saved on this device/);
    return true;
  });
});

test('describeLocation reports where a project lives for the sync status line', async () => {
  const { sync } = harness({ folders: [] });
  const saved = await sync.saveProject(project());
  const location = sync.describeLocation(saved.document);
  assert.equal(location.number, 'CME-000001');
  assert.equal(location.folder, FOLDER);
  assert.equal(sync.describeLocation(project('Unsaved', 'project-2')), null);
});
